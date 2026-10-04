import paho.mqtt.client as mqtt
import json
import os
from database import init_db, insert_sensor_data, update_device_status, insert_control_log

# ===== CONFIG — อ่านจากไฟล์ .env (ไม่เขียน Key ไว้ในโค้ดตรงๆ) =====
# วิธีสร้างไฟล์ .env: copy .env.example แล้วเปลี่ยนชื่อ และใส่ค่าของจริง
def load_env(filepath='.env'):
    env = {}
    if os.path.exists(filepath):
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    env[key.strip()] = val.strip()
    return env

_env         = load_env()
MQTT_BROKER  = _env.get('MQTT_BROKER', 'localhost')
MQTT_PORT    = int(_env.get('MQTT_PORT', 1883))
MQTT_USER    = _env.get('MQTT_USER', '')
MQTT_PASS    = _env.get('MQTT_PASS', '')

# ===== RUNTIME STATE =====
# เก็บสถานะการทำงาน ณ ปัจจุบัน
device_online   = {}    # {"sensor_node": True/False}
control_mode    = "AUTO"  # "AUTO" หรือ "MANUAL" (Gateway เป็น Authority ของ Auto)
commanded_state = "OFF"   # สถานะที่ Gateway สั่งไป
actual_state    = "OFF"   # สถานะที่ Actuator รายงานกลับมาจริงๆ

# ===== Store-and-Forward Queue =====
# ข้อมูลที่รับมาแต่ยังส่งต่อไม่ได้ (ตอนนี้เราเก็บลง SQLite ตลอด ซึ่งคือ Store-and-Forward โดยธรรมชาติ)
pending_records = []

# สร้างฐานข้อมูลเตรียมไว้
init_db()

# ===== MQTT CALLBACKS =====
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[GATEWAY] ✅ Connected to MQTT Broker")
        # แจ้งสถานะ Gateway ONLINE
        client.publish("pkru/gateway/status", "ONLINE", retain=True)
        # Subscribe รับข้อมูลทุกอย่างในโปรเจกต์
        client.subscribe("pkru/iot/#")
        client.subscribe("pkru/dashboard/mode")  # รับคำสั่งเปลี่ยน Mode จาก Dashboard
    else:
        print(f"[GATEWAY] ❌ Connection failed: {rc}")

def on_disconnect(client, userdata, rc):
    print(f"[GATEWAY] ⚠️  Disconnected from MQTT Broker (rc={rc})")

def on_message(client, userdata, msg):
    global control_mode, actual_state

    topic   = msg.topic
    payload = msg.payload.decode('utf-8')

    parts = topic.split('/')
    if len(parts) < 3:
        return

    # --- รับ Sensor Data ---
    if len(parts) >= 4:
        device_id = parts[2]
        msg_type  = parts[3]

        # Device กลับมา ONLINE (ส่ง Heartbeat มา)
        if msg_type == 'status':
            online = (payload == "ONLINE")
            device_online[device_id] = online
            status_str = "ONLINE" if online else "OFFLINE"
            print(f"[STATUS] {device_id} → {status_str}")
            update_device_status(device_id, status_str)

        elif msg_type == 'data':
            try:
                data  = json.loads(payload)
                temp  = data.get('temp')
                humi  = data.get('humi')
                light = data.get('light')

                # ===== DATA VALIDATION =====
                quality = validate_data(temp, humi, light)
                print(f"[DATA] {device_id} | temp={temp} humi={humi} light={light} | quality={quality}")

                # บันทึกลง SQLite ทันที (นี่คือ Store-and-Forward: เก็บไว้ก่อนเสมอ)
                insert_sensor_data(device_id, temp, humi, light, quality)

                # อัปเดตสถานะ Device เป็น ONLINE (เพราะมีข้อมูลเข้ามา)
                if device_id not in device_online or not device_online[device_id]:
                    device_online[device_id] = True
                    update_device_status(device_id, "ONLINE")

                # ===== AUTO CONTROL (Rule Engine with Hysteresis) =====
                if control_mode == "AUTO" and quality == "VALID" and temp is not None:
                    auto_control(client, device_id, temp)

            except (json.JSONDecodeError, TypeError) as e:
                print(f"[ERROR] JSON parse error: {e}")

        elif msg_type == 'state':
            # State Feedback จาก Actuator (Control Verification)
            actual_state = payload
            print(f"[VERIFY] Commanded={commanded_state} | Actual={actual_state}")
            if commanded_state != actual_state:
                print("[VERIFY] ⚠️  State MISMATCH! Actuator may have failed.")
            insert_control_log(device_id, commanded_state, actual_state)

    # --- รับคำสั่งเปลี่ยน Mode จาก Dashboard (Manual/Auto) ---
    if topic == "pkru/dashboard/mode":
        control_mode = payload  # "AUTO" หรือ "MANUAL"
        print(f"[MODE] Control mode changed to: {control_mode}")

# ===== VALIDATION FUNCTION =====
def validate_data(temp, humi, light):
    if temp is None or humi is None or light is None:
        return "INVALID"  # Missing Field
    if not isinstance(temp, (int, float)) or not isinstance(humi, (int, float)):
        return "INVALID"  # Wrong Type
    if temp != temp or humi != humi:
        return "INVALID"  # NaN check
    if temp == -99 or humi == -99:
        return "INVALID"  # Sentinel Value
    if not (-40 <= temp <= 125) or not (0 <= humi <= 100):
        return "INVALID"  # Out of range
    return "VALID"

# ===== AUTO CONTROL (Hysteresis) =====
def auto_control(client, device_id, temp):
    global commanded_state
    if temp > 35:
        if commanded_state != "ON":
            print(f"[AUTO] 🔥 TEMP={temp}°C > 35 → FAN ON")
            commanded_state = "ON"
            client.publish("pkru/iot/actuator_node/cmd", "ON")
    elif temp < 30:
        if commanded_state != "OFF":
            print(f"[AUTO] ❄️  TEMP={temp}°C < 30 → FAN OFF")
            commanded_state = "OFF"
            client.publish("pkru/iot/actuator_node/cmd", "OFF")
    # 30 <= temp <= 35: Keep previous state (Hysteresis)

# ===== MQTT CLIENT SETUP =====
client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)

# LWT: ถ้า Gateway หลุดกะทันหัน Broker จะส่งข้อความนี้แทน
client.will_set("pkru/gateway/status", payload="OFFLINE", qos=1, retain=True)

client.on_connect    = on_connect
client.on_disconnect = on_disconnect
client.on_message    = on_message

print("[GATEWAY] 🚀 Starting IoT Gateway...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_forever()
