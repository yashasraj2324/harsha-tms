"""
Test script to simulate ESP32-CAM sending images to the backend
This will test the complete AI pipeline:
1. YOLOv8 object detection
2. Gemini AI verification (if needed)
3. Database storage
4. Local image saving
5. SSE real-time updates
"""

import requests
import os
from PIL import Image, ImageDraw, ImageFont
import io

# Backend URL
BACKEND_URL = "http://192.168.111.84:8000"

def create_test_image_with_object():
    """Create a test image with a simple object (simulating a car/obstacle)"""
    # Create a 640x480 image (VGA resolution like ESP32-CAM)
    img = Image.new('RGB', (640, 480), color='lightgray')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple "car" shape (rectangle with wheels)
    # Car body
    draw.rectangle([200, 200, 400, 300], fill='red', outline='darkred', width=3)
    # Wheels
    draw.ellipse([220, 280, 260, 320], fill='black')
    draw.ellipse([360, 280, 400, 320], fill='black')
    # Windows
    draw.rectangle([220, 210, 280, 250], fill='lightblue')
    draw.rectangle([320, 210, 380, 250], fill='lightblue')
    
    # Add text
    draw.text((250, 350), "TEST: Obstacle on Track", fill='black')
    
    # Convert to JPEG bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG', quality=85)
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def create_test_image_empty():
    """Create a test image with no objects (simulating empty track)"""
    img = Image.new('RGB', (640, 480), color='gray')
    draw = ImageDraw.Draw(img)
    
    # Draw railway tracks
    draw.line([100, 480, 250, 0], fill='brown', width=8)
    draw.line([200, 480, 350, 0], fill='brown', width=8)
    draw.line([540, 480, 390, 0], fill='brown', width=8)
    draw.line([440, 480, 290, 0], fill='brown', width=8)
    
    # Add text
    draw.text((220, 450), "TEST: Clear Track", fill='white')
    
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG', quality=85)
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def test_analyze_endpoint(image_bytes, trigger_reason):
    """Test the /analyze endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing /analyze endpoint with trigger: {trigger_reason}")
    print(f"{'='*60}")
    
    try:
        # Prepare the request
        files = {'file': ('test_image.jpg', image_bytes, 'image/jpeg')}
        headers = {'X-Trigger-Reason': trigger_reason}
        
        # Send POST request
        print(f"Sending {len(image_bytes)} bytes to {BACKEND_URL}/analyze...")
        response = requests.post(
            f"{BACKEND_URL}/analyze",
            files=files,
            headers=headers,
            timeout=30
        )
        
        # Check response
        if response.status_code == 200:
            result = response.json()
            print("\n✅ SUCCESS! Pipeline completed:")
            print(f"\n📊 Alert ID: {result.get('alert_id')}")
            print(f"\n🔍 Stage 1 - YOLOv8:")
            yolo = result['pipeline']['stage1_yolo']
            print(f"   Flag: {yolo['flag']}")
            print(f"   Detections: {len(yolo['detections'])}")
            print(f"   Confidence: {yolo['confidence']:.2f}")
            if yolo['detections']:
                for det in yolo['detections']:
                    print(f"   - {det['class_name']}: {det['confidence']:.2f}")
            
            if result['pipeline']['stage2_gemini']:
                print(f"\n🤖 Stage 2 - Gemini AI:")
                gemini = result['pipeline']['stage2_gemini']
                print(f"   Status: {gemini['status']}")
                print(f"   Confidence: {gemini['confidence']:.2f}")
                print(f"   Reason: {gemini['reason'][:100]}...")
            
            print(f"\n🎯 Final Status: {result['final_status']}")
            print(f"📸 Image URL: {result['image_url']}")
            print(f"⏰ Timestamp: {result['timestamp']}")
            
            return result
        else:
            print(f"❌ ERROR: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        return None

def test_status_endpoint():
    """Test the /status endpoint"""
    print(f"\n{'='*60}")
    print("Testing /status endpoint")
    print(f"{'='*60}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/status", timeout=10)
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ System Status: {result['overall_status']}")
            if result['latest_alert']:
                print(f"\n📋 Latest Alert:")
                alert = result['latest_alert']
                print(f"   ID: {alert['id']}")
                print(f"   Trigger: {alert['trigger_reason']}")
                print(f"   Status: {alert['final_status']}")
                print(f"   Timestamp: {alert['timestamp']}")
            print(f"\n📊 Recent Alerts Count: {len(result['recent_alerts'])}")
        else:
            print(f"❌ ERROR: {response.status_code}")
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")

def test_alerts_endpoint():
    """Test the /alerts endpoint"""
    print(f"\n{'='*60}")
    print("Testing /alerts endpoint")
    print(f"{'='*60}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/alerts?limit=10", timeout=10)
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Total Alerts: {result['count']}")
            for i, alert in enumerate(result['alerts'][:3], 1):
                print(f"\n📋 Alert #{i}:")
                print(f"   ID: {alert['id']}")
                print(f"   Trigger: {alert['trigger_reason']}")
                print(f"   YOLO: {alert['yolo_flag']}")
                print(f"   Final: {alert['final_status']}")
                print(f"   Image: {alert['image_url']}")
        else:
            print(f"❌ ERROR: {response.status_code}")
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚂 RailGuard AI Pipeline Test Suite")
    print("="*60)
    
    # Test 1: Image with obstacle (should trigger YOLO + Gemini)
    print("\n\n🧪 TEST 1: Simulating OBSTACLE detection")
    img_with_object = create_test_image_with_object()
    test_analyze_endpoint(img_with_object, "OBSTACLE")
    
    # Test 2: Empty track (should skip Gemini)
    print("\n\n🧪 TEST 2: Simulating VIBRATION on clear track")
    img_empty = create_test_image_empty()
    test_analyze_endpoint(img_empty, "VIBRATION")
    
    # Test 3: Hole detection (should trigger Gemini even without YOLO detections)
    print("\n\n🧪 TEST 3: Simulating HOLE detection")
    test_analyze_endpoint(img_empty, "HOLE")
    
    # Test status and alerts
    print("\n\n")
    test_status_endpoint()
    test_alerts_endpoint()
    
    print("\n\n" + "="*60)
    print("✅ Test suite completed!")
    print("="*60)
    print("\nCheck the backend/storage/alerts/ folder for saved images")
    print("Database: backend/railguard.db")
    print("="*60 + "\n")
