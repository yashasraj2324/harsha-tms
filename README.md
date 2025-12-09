# RailGuard V2 - Hybrid AI Railway Safety System

![Version](https://img.shields.io/badge/Version-2.0.0-blue)
![AI](https://img.shields.io/badge/AI-YOLOv8%20%2B%20Gemini-brightgreen)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

## 🚀 What's New in V2

### **Hybrid AI Architecture**
- **Stage 1:** YOLOv8 Nano for fast object detection (Person, Animals, Vehicles)
- **Stage 2:** Gemini 1.5 Flash for complex hazard verification (Cracks, Structural damage)
- **Conditional Logic:** Gemini runs only when needed (YOLO detections OR HOLE triggers)

### **Enhanced Firmware**
- **Watchdog Timer (WDT):** 5-second timeout prevents system hangs
- **Finite State Machine:** Clean STATE_MONITORING → STATE_DANGER transitions
- **NewPing Logic:** Optimized ultrasonic sensor polling (200ms intervals)

### **Real-time Frontend**
- **Supabase WebSockets:** No polling - instant alert notifications
- **Full-Screen Alert Modal:** Red alert overlay for DANGER status
- **Lucide React Icons:** Premium UI with animated status indicators

---

## 🎯 System Architecture

```
┌─────────────┐
│  ESP32-CAM  │  Sensor: Ultrasonic (HRC Detection)
│   (Edge)    │  Trigger: Distance < 100cm OR > 150cm
└──────┬──────┘
       │ HTTP POST /analyze
       │ Image + Trigger Reason
       ▼
┌─────────────────────────────────────────┐
│         FastAPI Backend (Python)        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  STAGE 1: YOLOv8 Nano (Fast)    │   │
│  │  - Detect: Person, Animals, Cars│   │
│  │  - Output: DANGER or SAFE       │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│             ▼                           │
│  ┌─────────────────────────────────┐   │
│  │  STAGE 2: Gemini 1.5 Flash      │   │
│  │  (Conditional - The Judge)      │   │
│  │  - Verify YOLO detections       │   │
│  │  - Analyze Cracks, Holes        │   │
│  │  - Final Decision: SAFE/DANGER  │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│             ▼                           │
│  ┌─────────────────────────────────┐   │
│  │  Supabase PostgreSQL + Storage  │   │
│  │  - Store alerts with AI results │   │
│  │  - Trigger WebSocket event      │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
       │ WebSocket (Realtime)
       ▼
┌─────────────┐
│  Next.js    │  Supabase Realtime Subscription
│  Dashboard  │  - Instant alert notifications
│  (Frontend) │  - Full-screen DANGER modal
└─────────────┘
```

---

## 📋 2-Stage AI Pipeline Logic

### **When does Gemini run?**

```python
# Condition 1: YOLO detected something
if yolo_result["flag"] == "DANGER":
    run_gemini = True  # Verify if it's a real threat

# Condition 2: Sensor triggered on HOLE (YOLO can't see depth)
elif trigger_reason == "HOLE":
    run_gemini = True  # Analyze track structure

# Otherwise: YOLO says SAFE and not a HOLE
else:
    final_status = "SAFE"  # Skip Gemini (save API costs)
```

### **Why this approach?**

1. **Speed:** YOLOv8 Nano runs in ~50ms (local GPU)
2. **Accuracy:** Gemini verifies complex scenarios (~500ms via API)
3. **Cost-Effective:** Gemini only runs when necessary
4. **Comprehensive:** Catches both objects (YOLO) and structural defects (Gemini)

---

## 🔧 Installation Guide

### **Prerequisites**
- Python 3.9+
- Node.js 18+
- Arduino IDE 2.0+
- Supabase account
- Google Gemini API key

### **1. Download YOLOv8 Model**

```bash
cd backend

# Option 1: Auto-download (recommended)
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Option 2: Manual download
# Download from: https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
# Place in backend/ directory
```

### **2. Backend Setup**

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env:
# - SUPABASE_URL
# - SUPABASE_KEY
# - GEMINI_API_KEY

# Start server
python main.py
```

### **3. Supabase Database Setup**

Run this SQL in Supabase SQL Editor:

```sql
-- Alerts table (V2 schema)
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    trigger_reason VARCHAR(50),
    yolo_flag VARCHAR(20),
    yolo_detections TEXT,
    yolo_confidence FLOAT,
    gemini_status VARCHAR(20),
    gemini_reason TEXT,
    gemini_confidence FLOAT,
    final_status VARCHAR(20),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime
ALTER TABLE alerts REPLICA IDENTITY FULL;

-- Create storage bucket
-- Go to Storage → Create bucket "alerts" → Make Public
```

### **4. Frontend Setup**

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run development server
npm run dev
# Dashboard: http://localhost:3000
```

### **5. ESP32-CAM Firmware**

```bash
# 1. Open firmware/main.cpp in Arduino IDE
# 2. Update WiFi credentials (lines 23-24)
# 3. Update backend URL (line 27)
# 4. Select Board: "AI Thinker ESP32-CAM"
# 5. Upload code
```

---

## 🎮 Usage

### **System States**

#### **STATE_MONITORING (Default)**
- Green LED: ON (solid)
- Polls ultrasonic every 200ms
- **Triggers on:**
  - Distance < 100cm → OBSTACLE
  - Distance > 150cm → HOLE

#### **STATE_DANGER**
- Green LED: OFF
- Flash LED: ON
- Captures UXGA image (1600x1200)
- POSTs to `/analyze` endpoint
- Returns to MONITORING after upload

### **Frontend Behavior**

#### **SAFE Status**
- Green gradient banner
- Checkmark icon
- System active message

#### **DANGER Status**
- Red gradient banner (animated pulse)
- Warning triangle icon
- **Full-screen modal** with:
  - Alert image
  - Trigger reason
  - AI analysis (Gemini)
  - YOLO detections
  - Confidence scores
  - Timestamp

---

## 🧪 Testing the System

### **1. Test YOLO Detection**

```bash
# Place a test image in backend/
curl -X POST http://localhost:8000/analyze \
  -H "X-Trigger-Reason: OBSTACLE" \
  -F "file=@test_person.jpg"

# Expected: YOLO detects "Person" → Gemini verifies
```

### **2. Test HOLE Detection**

```bash
# Image with no objects but structural damage
curl -X POST http://localhost:8000/analyze \
  -H "X-Trigger-Reason: HOLE" \
  -F "file=@test_hole.jpg"

# Expected: YOLO finds nothing → Gemini analyzes structure
```

### **3. Test WebSocket**

1. Open dashboard: `http://localhost:3000`
2. Trigger ESP32 sensor (place object < 100cm)
3. Watch for instant alert (no refresh needed)
4. Full-screen modal should appear for DANGER

---

## 📊 Performance Metrics

| Component | Metric | Value |
|-----------|--------|-------|
| **YOLOv8 Inference** | Latency | ~50ms (GPU) / ~200ms (CPU) |
| **Gemini API** | Latency | ~500ms |
| **Total Pipeline** | End-to-End | ~1-2 seconds |
| **WebSocket** | Alert Delivery | <100ms |
| **ESP32 Upload** | Image Transfer | ~2-3 seconds |

---

## 🔐 Security & Safety

### **Watchdog Timer (WDT)**
- **Timeout:** 5 seconds
- **Action:** System restart on hang
- **Feed Points:** Main loop, after upload

### **Fail-Safe Logic**
- **YOLO fails:** Mark as DANGER
- **Gemini fails:** Mark as DANGER
- **WiFi down:** Log locally, retry on reconnect

### **Production Checklist**
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Use HTTPS for backend (SSL certificate)
- [ ] Rotate API keys regularly
- [ ] Set up monitoring/alerting (Sentry, etc.)
- [ ] Test WDT recovery scenarios

---

## 🐛 Troubleshooting

### **YOLOv8 Model Not Found**
```bash
# Download model
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### **WebSocket Not Connecting**
- Check Supabase URL and Anon Key in `.env.local`
- Verify Realtime is enabled in Supabase dashboard
- Check browser console for errors

### **Gemini API Quota Exceeded**
- Check API usage: https://makersuite.google.com/
- Implement rate limiting in backend
- Cache results for duplicate images

### **ESP32 Watchdog Reset Loop**
- Increase WDT timeout (line 35 in firmware)
- Check WiFi signal strength
- Reduce image quality if upload times out

---

## 📝 API Endpoints

### **POST /analyze**
**2-Stage AI Pipeline**

**Request:**
```bash
curl -X POST http://localhost:8000/analyze \
  -H "X-Trigger-Reason: OBSTACLE" \
  -F "file=@image.jpg"
```

**Response:**
```json
{
  "success": true,
  "alert_id": 123,
  "pipeline": {
    "stage1_yolo": {
      "flag": "DANGER",
      "detections": [{"class_name": "Person", "confidence": 0.89}],
      "confidence": 0.89
    },
    "stage2_gemini": {
      "status": "DANGER",
      "reason": "Person detected on railway track",
      "confidence": 0.95
    }
  },
  "final_status": "DANGER",
  "image_url": "https://...",
  "timestamp": "2024-12-08T20:00:00Z"
}
```

### **GET /status**
**Dashboard Status**

**Response:**
```json
{
  "overall_status": "SAFE",
  "latest_alert": {...},
  "recent_alerts": [...]
}
```

---

## 🎓 Learn More

- **YOLOv8 Docs:** https://docs.ultralytics.com/
- **Gemini API:** https://ai.google.dev/docs
- **Supabase Realtime:** https://supabase.com/docs/guides/realtime
- **ESP32-CAM Guide:** https://randomnerdtutorials.com/esp32-cam-ai-thinker/

---

## 📄 License

MIT License - See LICENSE file

---

## 🙏 Acknowledgments

- **Ultralytics** for YOLOv8
- **Google** for Gemini AI
- **Supabase** for real-time infrastructure
- **Next.js** and **FastAPI** communities

---

**⚠️ SAFETY DISCLAIMER:** This system is for monitoring and alerting purposes only. Do NOT use as the sole safety mechanism for railway operations. Always follow official railway safety protocols.
