# โปรเจกต์จบ (Lab 28 - Integrated IoT Mini Project)

นี่คือไฟล์ระบบทั้งหมดที่รวบรวมไว้สำหรับส่งเป็นชิ้นงานโปรเจกต์จบ ประกอบด้วยฟีเจอร์หลักดังนี้:

## คุณสมบัติของระบบ (Features)
1. **Python IoT Gateway (`gateway.py`)**: 
   - รับข้อมูล JSON จากเซ็นเซอร์ (`pkru/iot/+/data`)
   - ตรวจสอบคุณภาพข้อมูล (Valid, Invalid, Stale)
   - อัปเดตสถานะ Online/Offline อัตโนมัติ (รองรับ LWT)
   - มีระบบ AUTO Mode ควบคุม Actuator ทันทีหากค่าเกินกำหนด
2. **Database (`database.py`)**:
   - บันทึกประวัติค่าเซ็นเซอร์ (Sensor Data)
   - บันทึกสถานะอุปกรณ์ (Device Status)
   - บันทึกประวัติการสั่งงาน (Control Log)
3. **Security & Systemd**:
   - ไฟล์คอนฟิกเปิดระบบรักษาความปลอดภัยให้ MQTT (`mosquitto_secure.conf`)
   - ไฟล์ Service รัน Gateway เบื้องหลังพร้อมระบบ Restart อัตโนมัติ (`iot-gateway.service`)

## วิธีการใช้งาน (สำหรับส่งอาจารย์)
1. ติดตั้งไลบรารี:
   ```bash
   pip3 install -r requirements.txt
   ```
2. รันสคริปต์ Database เพื่อสร้างฐานข้อมูล:
   ```bash
   python3 database.py
   ```
3. รันโปรแกรม Gateway (หรือตั้งเป็น Systemd ให้รันตอนเปิดเครื่อง):
   ```bash
   python3 gateway.py
   ```
