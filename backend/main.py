"""
RailGuard V2 - Hybrid AI Backend (Local Edition)
2-Stage AI Pipeline: YOLOv8 (Fast Filter) → Gemini 1.5 Flash (Verification)
Database: SQLite (Local)
Storage: Local File System
Real-time: Server-Sent Events (SSE)
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime
from ultralytics import YOLO
import google.generativeai as genai
import os
from typing import Optional, AsyncGenerator
import cv2
import numpy as np
from PIL import Image
import io
import json
import asyncio
from sse_starlette.sse import EventSourceResponse

# ==================== CONFIGURATION ====================
app = FastAPI(title="RailGuard V2 - Local Edition", version="2.1.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment Variables
GEMINI_API_KEY = "AIzaSyCCf6XzNxnj9p4TWBkJaD9WAubTbShBFRM"

# Local Storage Configuration
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage", "alerts")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)

# Initialize Database (SQLite for local development)
DATABASE_URL = "sqlite+aiosqlite:///./railguard.db"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# SQLAlchemy Base
Base = declarative_base()

# Initialize Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.5-pro')

# Initialize YOLOv8 Nano Model
print("[YOLO] Loading YOLOv8 Nano model...")
yolo_model = YOLO('yolov8n.pt')
print("[YOLO] Model loaded successfully")

# Local file storage (no AWS S3)
print(f"[STORAGE] Using local storage: {LOCAL_STORAGE_DIR}")

# Mount static files for serving images
storage_parent = os.path.join(os.path.dirname(__file__), "storage")
app.mount("/storage", StaticFiles(directory=storage_parent), name="storage")

# SSE Event Queue for real-time updates
alert_queue: asyncio.Queue = asyncio.Queue()

# Classes of Interest for Railway Safety
DANGER_CLASSES = {
    0: "Person", 1: "Bicycle", 2: "Car", 3: "Motorcycle",
    5: "Bus", 7: "Truck", 14: "Bird", 15: "Cat",
    16: "Dog", 17: "Horse", 18: "Sheep", 19: "Cow"
}

# ==================== DATABASE MODELS ====================

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    trigger_reason = Column(String(50))
    yolo_flag = Column(String(20))
    yolo_detections = Column(Text)
    yolo_confidence = Column(Float)
    gemini_status = Column(String(20))
    gemini_reason = Column(Text)
    gemini_confidence = Column(Float)
    final_status = Column(String(20))
    image_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== DATABASE INITIALIZATION ====================

async def init_db():
    """Create tables if they don't exist"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[DATABASE] Tables created/verified")

# ==================== HELPER FUNCTIONS ====================

def stage1_yolo_detection(image_bytes: bytes) -> dict:
    """Stage 1: YOLOv8 Fast Object Detection"""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        results = yolo_model(img, conf=0.25, verbose=False)
        
        detections = []
        max_confidence = 0.0
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                confidence = float(box.conf[0])
                
                if cls_id in DANGER_CLASSES:
                    detections.append({
                        "class_id": cls_id,
                        "class_name": DANGER_CLASSES[cls_id],
                        "confidence": confidence,
                        "bbox": box.xyxy[0].tolist()
                    })
                    max_confidence = max(max_confidence, confidence)
        
        flag = "DANGER" if len(detections) > 0 else "SAFE"
        print(f"[YOLO] Stage 1 Complete: {flag} | Detections: {len(detections)}")
        
        return {
            "flag": flag,
            "detections": detections,
            "confidence": max_confidence,
            "detection_count": len(detections)
        }
        
    except Exception as e:
        print(f"[ERROR] YOLO detection failed: {str(e)}")
        return {
            "flag": "DANGER",
            "detections": [],
            "confidence": 0.0,
            "detection_count": 0,
            "error": str(e)
        }


def stage2_gemini_verification(image_bytes: bytes, yolo_result: dict, trigger_reason: str) -> dict:
    """Stage 2: Gemini AI Verification"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        if yolo_result["flag"] == "DANGER" and len(yolo_result["detections"]) > 0:
            detected_objects = ", ".join([d["class_name"] for d in yolo_result["detections"]])
            prompt = f"""
            CRITICAL RAILWAY SAFETY ANALYSIS:
            
            YOLOv8 detected: {detected_objects}
            
            Verify if these detections are REAL THREATS to railway safety.
            
            Analyze for:
            1. Are the detected objects ({detected_objects}) on or near the tracks?
            2. Rail Cracks or structural damage
            3. Missing ballast or track misalignment
            4. Any other obstacles not detected by YOLO
            
            Return ONLY JSON:
            {{
                "status": "DANGER" or "SAFE",
                "reason": "Detailed explanation",
                "confidence": 0.0 to 1.0
            }}
            
            Be CONSERVATIVE - if uncertain, mark as DANGER.
            """
        else:
            prompt = f"""
            CRITICAL RAILWAY SAFETY ANALYSIS:
            
            Sensor Trigger: {trigger_reason}
            YOLOv8 Result: No objects detected
            
            Analyze for hazards YOLO cannot see:
            1. Rail Cracks or fractures
            2. Missing ballast or track bed erosion
            3. Track misalignment or gaps (HOLES)
            4. Structural damage to sleepers
            5. Any subtle defects
            
            Return ONLY JSON:
            {{
                "status": "DANGER" or "SAFE",
                "reason": "Detailed explanation",
                "confidence": 0.0 to 1.0
            }}
            
            Sensor detected "{trigger_reason}" - investigate carefully.
            """
        
        response = gemini_model.generate_content([prompt, image])
        response_text = response.text.strip()
        
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)
        
        if "status" not in result or "reason" not in result:
            raise ValueError("Invalid Gemini response structure")
        
        print(f"[GEMINI] Stage 2 Complete: {result['status']}")
        
        return {
            "status": result["status"],
            "reason": result["reason"],
            "confidence": float(result.get("confidence", 0.5)),
            "raw_response": response_text
        }
        
    except Exception as e:
        print(f"[ERROR] Gemini verification failed: {str(e)}")
        return {
            "status": "DANGER",
            "reason": f"AI verification failed: {str(e)}. Marked as DANGER for safety.",
            "confidence": 0.5,
            "raw_response": str(e)
        }


def save_image_locally(image_bytes: bytes, filename: str) -> str:
    """Save image to local storage"""
    try:
        filepath = os.path.join(LOCAL_STORAGE_DIR, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_bytes)
        
        # Generate relative URL for local access
        url = f"/storage/alerts/{filename}"
        print(f"[LOCAL] Image saved: {filepath}")
        return url
        
    except Exception as e:
        print(f"[ERROR] Local save failed: {str(e)}")
        return ""


# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "RailGuard V2 - Neon DB Edition",
        "status": "operational",
        "version": "2.1.0",
        "database": "Neon DB (Serverless Postgres)",
        "storage": "AWS S3",
        "realtime": "Server-Sent Events (SSE)",
        "ai_pipeline": "YOLOv8 Nano → Gemini 1.5 Flash",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/analyze")
async def analyze_image(
    request: Request,
    file: Optional[UploadFile] = File(None),
    x_trigger_reason: Optional[str] = Header(None)
):
    """2-Stage AI Pipeline Endpoint - Accepts both multipart form and raw JPEG"""
    try:
        # Handle both multipart form data (from test scripts) and raw JPEG (from ESP32)
        if file:
            # Multipart form data
            image_bytes = await file.read()
        else:
            # Raw JPEG data in request body (ESP32-CAM format)
            image_bytes = await request.body()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        trigger_reason = x_trigger_reason or "UNKNOWN"
        print(f"\n[ANALYZE] New request | Trigger: {trigger_reason} | Size: {len(image_bytes)} bytes")
        
        # Stage 1: YOLOv8
        yolo_result = stage1_yolo_detection(image_bytes)
        
        # Stage 2: Gemini (Conditional)
        run_gemini = False
        gemini_result = None
        
        if yolo_result["flag"] == "DANGER":
            print("[PIPELINE] YOLO detected objects → Running Gemini")
            run_gemini = True
        elif trigger_reason == "HOLE":
            print("[PIPELINE] HOLE trigger → Running Gemini")
            run_gemini = True
        
        if run_gemini:
            gemini_result = stage2_gemini_verification(image_bytes, yolo_result, trigger_reason)
            final_status = gemini_result["status"]
            final_reason = gemini_result["reason"]
            final_confidence = gemini_result["confidence"]
        else:
            final_status = "SAFE"
            final_reason = "No objects detected by YOLO, sensor may have triggered on false positive"
            final_confidence = 0.9
        
        # Save to local storage
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{trigger_reason}_{final_status}.jpg"
        image_url = save_image_locally(image_bytes, filename)
        
        # Save to SQLite DB
        async with async_session_maker() as session:
            alert = Alert(
                timestamp=datetime.utcnow(),
                trigger_reason=trigger_reason,
                yolo_flag=yolo_result["flag"],
                yolo_detections=json.dumps(yolo_result["detections"]),
                yolo_confidence=yolo_result["confidence"],
                gemini_status=final_status,
                gemini_reason=final_reason,
                gemini_confidence=final_confidence,
                final_status=final_status,
                image_url=image_url
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            
            alert_id = alert.id
            print(f"[DATABASE] Alert stored: ID {alert_id} | Status: {final_status}")
            
            # Push to SSE queue for real-time updates
            alert_data = {
                "id": alert.id,
                "timestamp": alert.timestamp.isoformat(),
                "trigger_reason": alert.trigger_reason,
                "yolo_flag": alert.yolo_flag,
                "yolo_detections": alert.yolo_detections,
                "yolo_confidence": alert.yolo_confidence,
                "gemini_status": alert.gemini_status,
                "gemini_reason": alert.gemini_reason,
                "gemini_confidence": alert.gemini_confidence,
                "final_status": alert.final_status,
                "image_url": alert.image_url,
                "created_at": alert.created_at.isoformat()
            }
            await alert_queue.put(alert_data)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "alert_id": alert_id,
                "pipeline": {
                    "stage1_yolo": {
                        "flag": yolo_result["flag"],
                        "detections": yolo_result["detections"],
                        "confidence": yolo_result["confidence"]
                    },
                    "stage2_gemini": {
                        "status": final_status,
                        "reason": final_reason,
                        "confidence": final_confidence
                    } if run_gemini else None
                },
                "final_status": final_status,
                "image_url": image_url,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        print(f"[ERROR] Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/status")
async def get_status():
    """Get current system status"""
    try:
        async with async_session_maker() as session:
            # Get latest 10 alerts
            result = await session.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(10)
            )
            alerts = result.scalars().all()
            
            latest_alert = alerts[0] if alerts else None
            overall_status = "SAFE"
            
            if latest_alert:
                time_diff = (datetime.utcnow() - latest_alert.timestamp).total_seconds()
                if time_diff < 300 and latest_alert.final_status == "DANGER":
                    overall_status = "DANGER"
            
            return {
                "overall_status": overall_status,
                "latest_alert": {
                    "id": latest_alert.id,
                    "timestamp": latest_alert.timestamp.isoformat(),
                    "trigger_reason": latest_alert.trigger_reason,
                    "final_status": latest_alert.final_status,
                    "gemini_reason": latest_alert.gemini_reason,
                    "image_url": latest_alert.image_url
                } if latest_alert else None,
                "recent_alerts": [
                    {
                        "id": a.id,
                        "timestamp": a.timestamp.isoformat(),
                        "trigger_reason": a.trigger_reason,
                        "final_status": a.final_status,
                        "image_url": a.image_url
                    } for a in alerts
                ],
                "timestamp": datetime.utcnow().isoformat()
            }
    except Exception as e:
        print(f"[ERROR] Status fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status fetch failed: {str(e)}")


@app.get("/alerts")
async def get_alerts(limit: int = 50):
    """Get recent alerts"""
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(limit)
            )
            alerts = result.scalars().all()
            
            return {
                "alerts": [
                    {
                        "id": a.id,
                        "timestamp": a.timestamp.isoformat(),
                        "trigger_reason": a.trigger_reason,
                        "yolo_flag": a.yolo_flag,
                        "yolo_detections": a.yolo_detections,
                        "yolo_confidence": a.yolo_confidence,
                        "gemini_status": a.gemini_status,
                        "gemini_reason": a.gemini_reason,
                        "gemini_confidence": a.gemini_confidence,
                        "final_status": a.final_status,
                        "image_url": a.image_url,
                        "created_at": a.created_at.isoformat()
                    } for a in alerts
                ],
                "count": len(alerts)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alerts fetch failed: {str(e)}")


@app.get("/events")
async def stream_events():
    """
    Server-Sent Events (SSE) endpoint for real-time alerts
    Replaces Supabase Realtime WebSocket
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                # Wait for new alert
                alert_data = await alert_queue.get()
                
                # Send as SSE event
                yield {
                    "event": "alert",
                    "data": json.dumps(alert_data)
                }
                
        except asyncio.CancelledError:
            print("[SSE] Client disconnected")
    
    return EventSourceResponse(event_generator())


# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("RailGuard V2 - Local Edition Starting...")
    print(f"Database: SQLite (Local)")
    print(f"Storage: Local File System ({LOCAL_STORAGE_DIR})")
    print(f"Real-time: Server-Sent Events (SSE)")
    print(f"YOLOv8 Model: Loaded (yolov8n.pt)")
    print(f"Gemini API: {'Configured' if GEMINI_API_KEY != 'your-gemini-api-key' else 'NOT CONFIGURED'}")
    print("AI Pipeline: YOLOv8 (Stage 1) → Gemini 1.5 Flash (Stage 2)")
    print("=" * 60)
    
    # Initialize database
    await init_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
