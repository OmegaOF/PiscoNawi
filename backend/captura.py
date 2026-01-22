from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import os
import subprocess
import signal
from datetime import datetime
import glob
import threading
import cv2
import time
from typing import Optional
from pydantic import BaseModel
from ultralytics import YOLO
from pydantic import BaseModel

from auth import get_current_user
from db import Usuario

router = APIRouter()

# Global variables to track the running process
capture_process = None
capture_thread = None
camera_active = False
CAPTURA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "storage", "capturas")  # Directory for YOLO captures
CAPTURA_DIR = os.path.normpath(CAPTURA_DIR)

# Load YOLO model for vehicle detection
print("Loading YOLOv8 model...")
model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "yolov8n.pt")
model = YOLO(model_path)

# Try to use Mac GPU acceleration (M1/M2/M3), fallback to CPU if not available
try:
    model.to("mps")
    print("YOLO model loaded and configured for MPS acceleration")
except RuntimeError as e:
    print(f"MPS acceleration not available ({e}), using CPU instead")
    model.to("cpu")
    print("YOLO model loaded and configured for CPU")

class ProcessOutput(BaseModel):
    stdout: str = ""
    stderr: str = ""

def camera_capture_loop():
    """Camera capture loop with YOLO vehicle detection running in a separate thread"""
    global camera_active, model

    print("🚗 Starting vehicle detection capture...")
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Could not open camera")
        camera_active = False
        return

    print("✅ Camera opened successfully!")
    last_capture = 0
    COOLDOWN = 5  # seconds between captures

    while camera_active:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break

        # Run YOLO detection
        results = model(frame, conf=0.5, verbose=False)

        detected = False

        # Process detection results
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]

                # Check if detected object is a vehicle
                if label in ["car", "bus", "truck", "motorbike"]:
                    detected = True
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Draw bounding box and label on frame
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
                    cv2.putText(frame, label, (x1, y1-10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        # Save image if vehicle detected and cooldown period passed
        now = time.time()
        if detected and now - last_capture > COOLDOWN:
            filename = f"{CAPTURA_DIR}/vehicle_{int(now)}.jpg"
            cv2.imwrite(filename, frame)
            print(f"🚗 Vehicle detected! Saved: {filename}")
            last_capture = now

        # Small delay to prevent high CPU usage
        time.sleep(0.1)

    cap.release()
    print("📷 Vehicle detection capture stopped")

class CapturedImage(BaseModel):
    filename: str
    url: str  # HTTP URL to the image
    timestamp: datetime

class CaptureStatus(BaseModel):
    is_running: bool
    process_id: Optional[int] = None

@router.post("/iniciar", response_model=CaptureStatus)
async def iniciar_captura(current_user: Usuario = Depends(get_current_user)):
    global capture_thread, camera_active

    if camera_active:
        raise HTTPException(status_code=400, detail="La captura ya está en ejecución")

    try:
        # Ensure captura directory exists
        os.makedirs(CAPTURA_DIR, exist_ok=True)

        # Start camera capture in a thread
        camera_active = True
        capture_thread = threading.Thread(target=camera_capture_loop, daemon=True)
        capture_thread.start()

        return CaptureStatus(is_running=True, process_id=os.getpid())

    except Exception as e:
        camera_active = False
        raise HTTPException(status_code=500, detail=f"Error al iniciar captura: {str(e)}")

@router.post("/detener", response_model=CaptureStatus)
async def detener_captura(current_user: Usuario = Depends(get_current_user)):
    global capture_thread, camera_active

    if not camera_active:
        return CaptureStatus(is_running=False)

    try:
        # Stop camera capture
        camera_active = False

        # Wait for thread to finish (with timeout)
        if capture_thread and capture_thread.is_alive():
            capture_thread.join(timeout=5)

        return CaptureStatus(is_running=False)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al detener captura: {str(e)}")

@router.get("/estado", response_model=CaptureStatus)
async def obtener_estado_captura(current_user: Usuario = Depends(get_current_user)):
    global camera_active

    return CaptureStatus(is_running=camera_active, process_id=os.getpid() if camera_active else None)

@router.get("/logs", response_model=ProcessOutput)
async def obtener_logs_captura(current_user: Usuario = Depends(get_current_user)):
    global camera_active, CAPTURA_DIR

    # Check if captura directory exists and count files
    if os.path.exists(CAPTURA_DIR):
        image_count = len([f for f in os.listdir(CAPTURA_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))])
        latest_file = ""
        if image_count > 0:
            files = sorted([f for f in os.listdir(CAPTURA_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))],
                          key=lambda x: os.path.getmtime(os.path.join(CAPTURA_DIR, x)), reverse=True)
            latest_file = files[0]
    else:
        image_count = 0
        latest_file = ""

    status_msg = f"Camera active: {camera_active}, Images captured: {image_count}"
    if latest_file:
        status_msg += f", Latest: {latest_file}"

    return ProcessOutput(stdout=status_msg, stderr="")

@router.get("/imagenes", response_model=List[CapturedImage])
async def listar_imagenes_capturadas(current_user: Usuario = Depends(get_current_user)):
    if not os.path.exists(CAPTURA_DIR):
        return []

    # Get all image files from captura directory
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.webp']
    image_files = []

    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(CAPTURA_DIR, ext)))

    captured_images = []
    for filepath in sorted(image_files, key=os.path.getmtime, reverse=True):
        filename = os.path.basename(filepath)
        timestamp = datetime.fromtimestamp(os.path.getmtime(filepath))

        # Return HTTP URL instead of file path
        image_url = f"http://localhost:8000/capturas/{filename}"

        captured_images.append(CapturedImage(
            filename=filename,
            url=image_url,
            timestamp=timestamp
        ))

    return captured_images