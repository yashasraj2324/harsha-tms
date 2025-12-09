# RailGuard - Quick Setup Guide

## ⚡ Quick Start (5 Minutes)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with backend URL
npm run dev
```

### 3. ESP32-CAM Setup
1. Open `firmware/main.cpp` in Arduino IDE
2. Update WiFi credentials (lines 23-24)
3. Update backend URL (line 27)
4. Select Board: "AI Thinker ESP32-CAM"
5. Upload code

## 🔑 Required API Keys

### Google Gemini API
1. Go to https://makersuite.google.com/app/apikey
2. Create new API key
3. Add to `backend/.env`: `GEMINI_API_KEY=your_key`

### Supabase Setup
1. Create account at https://supabase.com
2. Create new project
3. Go to Settings → API
4. Copy URL and anon key to `backend/.env`
5. Go to SQL Editor, run:
```sql
CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    distance FLOAT,
    vibration BOOLEAN,
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    alert_type VARCHAR(50),
    ai_status VARCHAR(20),
    ai_detection_type VARCHAR(50),
    confidence FLOAT,
    image_url TEXT,
    raw_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
6. Go to Storage → Create bucket "alerts" (Public)

## 🔌 Hardware Wiring (5 Minutes)

```
ESP32-CAM Connections:
├── JSN-SR04T
│   ├── VCC → 5V
│   ├── GND → GND
│   ├── TRIG → GPIO 12
│   └── ECHO → GPIO 13
├── SW-420
│   ├── VCC → 3.3V
│   ├── GND → GND
│   └── DO → GPIO 14
└── Status LED
    ├── Anode → GPIO 2
    └── Cathode → GND (via 220Ω resistor)
```

## ✅ Verification

1. **Backend**: Visit http://localhost:8000 (should see API info)
2. **Frontend**: Visit http://localhost:3000 (should see dashboard)
3. **ESP32**: Check Serial Monitor for "System Ready"

## 🎯 Test the System

1. Place object < 100cm from ultrasonic sensor
2. ESP32 should capture image and upload
3. Backend analyzes with AI
4. Dashboard shows alert within 3 seconds

## 📞 Support

See full documentation in `README.md`
