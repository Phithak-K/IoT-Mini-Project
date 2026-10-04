#!/bin/bash
# setup_raspberry_pi.sh — รันบน Raspberry Pi เพื่อติดตั้งทุกอย่างในครั้งเดียว
# วิธีใช้: chmod +x setup_raspberry_pi.sh && sudo ./setup_raspberry_pi.sh

set -e
echo "======================================"
echo "  IoT Lab 28 - Raspberry Pi Setup"
echo "======================================"

PROJECT_DIR="/home/pi/Final_IoT_Project"
SERVICE_FILE="iot-gateway.service"

# 1. ติดตั้ง Package ที่จำเป็น
echo "[1/5] Installing packages..."
sudo apt-get update -q
sudo apt-get install -y mosquitto mosquitto-clients python3-pip nodejs npm

# 2. ติดตั้ง Python Libraries
echo "[2/5] Installing Python libraries..."
pip3 install paho-mqtt

# 3. สร้าง MQTT Password File
echo "[3/5] Setting up MQTT security..."
sudo mosquitto_passwd -c /etc/mosquitto/passwd admin
sudo cp "$PROJECT_DIR/mosquitto_secure.conf" /etc/mosquitto/conf.d/secure.conf
sudo systemctl restart mosquitto

# 4. ลงทะเบียน Systemd Service (Auto-start)
echo "[4/5] Registering systemd service..."
sudo cp "$PROJECT_DIR/$SERVICE_FILE" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable iot-gateway.service
sudo systemctl start iot-gateway.service
echo "Service status:"
sudo systemctl status iot-gateway.service --no-pager

# 5. สร้างฐานข้อมูล SQLite
echo "[5/5] Initializing database..."
cd "$PROJECT_DIR"
python3 database.py

echo ""
echo "======================================"
echo "  ✅ Setup Complete!"
echo "  Gateway service is running."
echo "  Check logs: journalctl -u iot-gateway -f"
echo "======================================"
