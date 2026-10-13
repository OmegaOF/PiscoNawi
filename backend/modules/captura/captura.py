from fastapi import APIRouter, HTTPException, Depends
from typing import List
import os
from services.registro import logger
from datetime import datetime
import glob
import threading
import cv2
import time
from typing import Optional
from ultralytics import YOLO
from pydantic import BaseModel

from modules.roles.roles import require_internal_user
from db import Usuario

router = APIRouter()

# Global variables to track the running process
capture_process = None
capture_thread = None
camera_active = False
CAPTURA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../..", "storage", "capturas")  # Directory for YOLO captures
CAPTURA_DIR = os.path.normpath(CAPTURA_DIR)

# Load YOLO model for vehicle detection
logger.debug("Cargando modelo de detección...")
model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "yolov8n.pt")
model = YOLO(model_path)

# Try to use Mac GPU acceleration (M1/M2/M3), fallback to CPU if not available
try:
    model.to("mps")
    logger.debug("Modelo de detección listo (aceleración MPS)")
except RuntimeError as e:
    logger.debug("Aceleración MPS no disponible, se usa CPU")
    model.to("cpu")
    logger.debug("Modelo de detección listo (CPU)")

class ProcessOutput(BaseModel):
    stdout: str = ""
    stderr: str = ""

def _aclarar(frame, factor: float = 1.2):
    """Aumenta el brillo de la imagen un 20 % sin saturar los tonos claros."""
    return cv2.convertScaleAbs(frame, alpha=factor, beta=0)


VERDE = (0, 255, 0)


def _dibujar_marca(frame, x1: int, y1: int, x2: int, etiqueta: str) -> None:
    """Dibuja una línea sobre el techo del vehículo y la etiqueta encima de la línea."""
    alto, ancho = frame.shape[:2]
    esc = max(1.0, ancho / 640)
    grosor = max(2, int(round(2 * esc)))
    escala_texto = 0.6 * esc
    grosor_texto = max(1, int(round(1.6 * esc)))
    margen = max(4, int(round(4 * esc)))

    x1 = max(0, min(x1, ancho - 1))
    x2 = max(0, min(x2, ancho - 1))
    y1 = max(0, min(y1, alto - 1))
    cv2.line(frame, (x1, y1), (x2, y1), VERDE, grosor, cv2.LINE_AA)

    (tw, th), base = cv2.getTextSize(etiqueta, cv2.FONT_HERSHEY_SIMPLEX, escala_texto, grosor_texto)
    caja_alto = th + base + 2 * margen
    arriba = y1 - grosor // 2 - caja_alto
    if arriba < 0:  # sin espacio sobre la línea: la etiqueta va debajo
        arriba = y1 + grosor // 2
    arriba = max(0, min(arriba, alto - caja_alto))
    izq = max(0, min(x1, ancho - (tw + 2 * margen)))

    cv2.rectangle(frame, (izq, arriba), (izq + tw + 2 * margen, arriba + caja_alto), VERDE, -1)
    cv2.putText(frame, etiqueta, (izq + margen, arriba + margen + th),
                cv2.FONT_HERSHEY_SIMPLEX, escala_texto, (255, 255, 255), grosor_texto, cv2.LINE_AA)


def camera_capture_loop():
    """Camera capture loop with YOLO vehicle detection running in a separate thread"""
    global camera_active, model

    logger.debug("Iniciando captura")
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    if not cap.isOpened():
        logger.warning("No se pudo abrir la cámara")
        camera_active = False
        return

    logger.debug("Cámara abierta")
    last_capture = 0
    COOLDOWN = 5  # tiempo de espera netre captura

    while camera_active:
        ret, frame = cap.read()
        if not ret:
            logger.debug("No se pudo leer un cuadro")
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
                if label in ["car"]:
                    detected = True
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Marca: línea sobre el vehículo y etiqueta encima
                    _dibujar_marca(frame, x1, y1, x2, label)

        # Save image if vehicle detected and cooldown period passed
        now = time.time()
        if detected and now - last_capture > COOLDOWN:
            filename = f"{CAPTURA_DIR}/vehicle_{int(now)}.jpg"
            cv2.imwrite(filename, _aclarar(frame), [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            logger.debug("Vehículo detectado: %s", filename)
            last_capture = now

        # Small delay to prevent high CPU usage
        time.sleep(0.1)

    cap.release()
    logger.debug("Captura detenida")

class CapturedImage(BaseModel):
    filename: str
    url: str  # HTTP URL to the image
    timestamp: datetime

class CaptureStatus(BaseModel):
    is_running: bool
    process_id: Optional[int] = None

@router.post("/iniciar", response_model=CaptureStatus)
async def iniciar_captura(current_user: Usuario = Depends(require_internal_user)):
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
async def detener_captura(current_user: Usuario = Depends(require_internal_user)):
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
async def obtener_estado_captura(current_user: Usuario = Depends(require_internal_user)):
    global camera_active

    return CaptureStatus(is_running=camera_active, process_id=os.getpid() if camera_active else None)

@router.get("/logs", response_model=ProcessOutput)
async def obtener_logs_captura(current_user: Usuario = Depends(require_internal_user)):
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
async def listar_imagenes_capturadas(current_user: Usuario = Depends(require_internal_user)):
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

@router.delete("/eliminar/{filename}")
async def eliminar_imagen(filename: str, current_user: Usuario = Depends(require_internal_user)):
    try:
        # Prevent directory traversal attacks
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="Nombre de archivo inválido")

        filepath = os.path.join(CAPTURA_DIR, filename)

        # Verify file is in CAPTURA_DIR
        if not os.path.abspath(filepath).startswith(os.path.abspath(CAPTURA_DIR)):
            raise HTTPException(status_code=400, detail="Ruta de archivo inválida")

        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Imagen no encontrada")

        # Delete the file
        os.remove(filepath)
        return {"message": f"Imagen {filename} eliminada exitosamente"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar imagen: {str(e)}")