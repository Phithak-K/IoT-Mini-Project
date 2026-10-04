import { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { 
  Thermometer, Droplets, Sun, 
  Power, Wifi, AlertTriangle, Fan 
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function App() {
  const [gatewayStatus, setGatewayStatus] = useState('OFFLINE');
  const [actuatorState, setActuatorState] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  // Live Data States
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const [currentHumi, setCurrentHumi] = useState<number | null>(null);
  const [currentLight, setCurrentLight] = useState<number | null>(null);
  const [dataQuality, setDataQuality] = useState('WAITING');
  
  // Historical Data State for Chart
  const [chartData, setChartData] = useState<{time: string, temp: number, humi: number}[]>([]);

  // System States
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);

  useEffect(() => {
    // เปลี่ยนจาก localhost เป็น IP อัตโนมัติ
    let brokerUrl = `ws://${window.location.hostname}:9001`;
    
    // ถ้าหน้าเว็บถูกรันบน GitHub Pages ให้เด้งหน้าต่างถาม IP ของ Raspberry Pi
    if (window.location.hostname.includes('github.io')) {
      const userInput = window.prompt(
        "[GitHub Pages Mode]\nPlease enter your Raspberry Pi IP address or Cloudflare Tunnel URL:\n(e.g., 192.168.1.100)", 
        "192.168.1.100"
      );
      if (userInput) {
        // ถ้ายูสเซอร์กรอกมาเต็มๆ (มี ws://) ก็ใช้เลย ถ้ากรอกมาแค่ตัวเลข IP ก็เติม ws:// ให้
        brokerUrl = userInput.includes('://') ? userInput : `ws://${userInput}:9001`;
      }
    }
    
    const mqttClient = mqtt.connect(brokerUrl);

    mqttClient.on('connect', () => {
      setGatewayStatus('ONLINE');
      // Subscribe เพื่อรับข้อมูลทั้งหมดในโปรเจกต์
      mqttClient.subscribe('pkru/iot/#');
    });

    mqttClient.on('message', (topic, message) => {
      const payload = message.toString();
      
      // ดักจับข้อมูลเซ็นเซอร์
      if (topic.includes('/data')) {
        try {
          const data = JSON.parse(payload);
          if (data.temp && data.humi) {
            setCurrentTemp(data.temp);
            setCurrentHumi(data.humi);
            setCurrentLight(data.light || 0);
            setDataQuality('VALID');
            
            // เพิ่มข้อมูลลงในกราฟ (เก็บย้อนหลัง 20 จุด)
            const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setChartData(prev => {
              const newData = [...prev, { time: timeStr, temp: data.temp, humi: data.humi }];
              if (newData.length > 20) newData.shift();
              return newData;
            });
          }
        } catch (e) {
          setDataQuality('INVALID');
        }
      }
      
      // ดักจับข้อมูลยืนยันจาก Actuator ว่าเปิดหรือปิดอยู่
      if (topic.includes('/state')) {
        setActuatorState(payload === 'ON');
      }
    });

    mqttClient.on('error', () => {
      setGatewayStatus('ERROR / OFFLINE');
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, []);

  // ฟังก์ชันสั่งงาน Actuator (ส่งคำสั่งไปที่ MQTT)
  const toggleActuator = () => {
    if (!client || autoMode) return;
    const command = actuatorState ? 'OFF' : 'ON';
    // สมมติสั่งงานไปที่ Node 002
    client.publish('pkru/iot/actuator_node/cmd', command);
    
    // เรายังไม่เปลี่ยน State ทันที เพราะต้องรอรับ State Feedback จากบอร์ดจริงๆ กลับมาก่อน (Control Verification)
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            IoT Mission Control
          </h1>
          <p className="text-slate-400 mt-1">Lab 28 - Final Project Skeleton (Real-time MQTT)</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
            <Wifi size={18} className={gatewayStatus === 'ONLINE' ? "text-emerald-400" : "text-red-400"} />
            <span className="text-sm font-medium">Gateway: {gatewayStatus}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/50 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <Thermometer className="text-red-400" size={24} />
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${dataQuality === 'VALID' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10'}`}>
              {dataQuality}
            </span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Temperature</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-4xl font-bold">{currentTemp ?? '--'}</h2>
            <span className="text-slate-500 font-medium">°C</span>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/50 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Droplets className="text-blue-400" size={24} />
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${dataQuality === 'VALID' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10'}`}>
              {dataQuality}
            </span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Humidity</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-4xl font-bold">{currentHumi ?? '--'}</h2>
            <span className="text-slate-500 font-medium">%</span>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/50 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Sun className="text-amber-400" size={24} />
            </div>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${dataQuality === 'VALID' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10'}`}>
              {dataQuality}
            </span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Light Level</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-4xl font-bold">{currentLight ?? '--'}</h2>
            <span className="text-slate-500 font-medium">lux</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6">Real-time Telemetry</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#f87171" strokeWidth={3} dot={false} isAnimationActive={false} name="Temp (°C)" />
                <Line yAxisId="left" type="monotone" dataKey="humi" stroke="#60a5fa" strokeWidth={3} dot={false} isAnimationActive={false} name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Actuator Control</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-md ${autoMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                {autoMode ? 'AUTO MODE ON' : 'MANUAL MODE'}
              </span>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center gap-8">
            <div className={`relative flex items-center justify-center w-32 h-32 rounded-full border-4 transition-all duration-500 ${actuatorState ? 'border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.3)]' : 'border-slate-800'}`}>
              <Fan size={64} className={`transition-all duration-1000 ${actuatorState ? 'text-cyan-400 animate-spin' : 'text-slate-600'}`} />
            </div>

            <div className="w-full space-y-4">
              <button 
                onClick={toggleActuator}
                disabled={autoMode || !client}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  autoMode 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : actuatorState 
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25'
                }`}
              >
                <Power size={20} />
                {actuatorState ? 'TURN OFF' : 'TURN ON'}
              </button>

              <button 
                onClick={() => setAutoMode(!autoMode)}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  autoMode
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {autoMode ? 'Disable Auto Mode' : 'Enable Auto Mode'}
              </button>
            </div>
          </div>
          
          {autoMode && (
            <div className="mt-6 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-start gap-3">
              <AlertTriangle className="text-indigo-400 shrink-0" size={20} />
              <p className="text-sm text-indigo-300 leading-relaxed">
                Auto mode active. Python Gateway will control the actuator based on sensor rules.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default App;
