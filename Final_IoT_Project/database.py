import sqlite3

DB_NAME = 'iot_project.db'

def init_db():
    """สร้างตารางทั้งหมดถ้ายังไม่มี"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # 1. ตารางเก็บค่าเซ็นเซอร์ (ตรงตามที่อาจารย์กำหนดใน LAB 28 หัวข้อ 28.17)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_data (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT    NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temp      REAL,
            humi      REAL,
            light     REAL,
            quality   TEXT    -- VALID / INVALID / STALE
        )
    ''')

    # 2. ตารางเก็บสถานะ ONLINE/OFFLINE ของแต่ละ Device
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_status (
            device_id TEXT    PRIMARY KEY,
            status    TEXT,   -- ONLINE / OFFLINE
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 3. ตารางเก็บประวัติการสั่งงาน Actuator (Control Log)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS control_log (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id      TEXT    NOT NULL,
            timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP,
            command        TEXT,  -- ON / OFF
            actuator_state TEXT   -- ON / OFF (State Feedback จาก Actuator จริงๆ)
        )
    ''')

    conn.commit()
    conn.close()
    print("[DB] ✅ Database initialized successfully!")

def insert_sensor_data(device_id, temp, humi, light, quality):
    """บันทึกค่าเซ็นเซอร์ลง SQLite"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensor_data (device_id, temp, humi, light, quality)
        VALUES (?, ?, ?, ?, ?)
    ''', (device_id, temp, humi, light, quality))
    conn.commit()
    conn.close()

def update_device_status(device_id, status):
    """อัปเดตหรือสร้างแถวสถานะ Device"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO device_status (device_id, status, last_seen)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(device_id) DO UPDATE SET
            status    = excluded.status,
            last_seen = CURRENT_TIMESTAMP
    ''', (device_id, status))
    conn.commit()
    conn.close()

def insert_control_log(device_id, command, actuator_state):
    """บันทึกประวัติการสั่งงาน (Command vs Actual State)"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO control_log (device_id, command, actuator_state)
        VALUES (?, ?, ?)
    ''', (device_id, command, actuator_state))
    conn.commit()
    conn.close()

def query_latest(device_id):
    """ตัวอย่าง Query ค่าล่าสุด (LAB 28.18)"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT device_id, temp, humi, light, quality, timestamp
        FROM sensor_data
        WHERE device_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
    ''', (device_id,))
    row = cursor.fetchone()
    conn.close()
    return row

def query_avg_last_5min(device_id):
    """ตัวอย่าง Query AVG/MIN/MAX 5 นาทีล่าสุด (LAB 28.18)"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT
            device_id,
            AVG(temp) AS avg_temp,
            MIN(temp) AS min_temp,
            MAX(temp) AS max_temp
        FROM sensor_data
        WHERE device_id = ?
          AND timestamp >= datetime('now', '-5 minutes')
        GROUP BY device_id
    ''', (device_id,))
    row = cursor.fetchone()
    conn.close()
    return row

if __name__ == '__main__':
    # รันไฟล์นี้ตรงๆ เพื่อสร้างฐานข้อมูลเปล่าๆ เตรียมไว้
    init_db()
    print("[DB] Tables created: sensor_data, device_status, control_log")
