from fastapi import APIRouter, HTTPException, Depends
from typing import List
import os

os.environ.setdefault("OPENCV_LOG_LEVEL", "FATAL")
os.environ.setdefault("OPENCV_VIDEOIO_PRIORITY_MSMF", "0")

import sys
from services.registro import logger
from datetime import datetime
import glob
import threading
import cv2
try:
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)
except Exception:
    pass
import time
from typing import Optional
from ultralytics import YOLO
from pydantic import BaseModel

from concurrent.futures import ThreadPoolExecutor

from starlette.concurrency import run_in_threadpool

from modules.roles.roles import require_internal_user
from db import Usuario

router = APIRouter()

# Global variables to track the running process
capture_process = None
capture_thread = None
camera_active = False
camera_index = int(os.getenv("CAMERA_INDEX", "0"))  # Índice de cámara por defecto
MAX_CAMARAS = int(os.getenv("MAX_CAMARAS", "6"))  # Cuántos índices probar al listar dispositivos
FALLOS_SEGUIDOS_CORTE = 2  # Al sondear, detenerse tras N índices seguidos sin cámara
CACHE_CAMARAS_SEG = int(os.getenv("CACHE_CAMARAS_SEG", "300"))  # Vigencia del listado en memoria
_camaras_cache: List["CameraDevice"] = []
_camaras_cache_ts = 0.0
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


class CameraDevice(BaseModel):
    index: int
    label: str
    available: bool = True


class IniciarCapturaRequest(BaseModel):
    camera_index: Optional[int] = None


def _backend_video() -> int:
    """Elige el sistema de captura adecuado para cada sistema operativo."""
    forzado = os.getenv("VIDEO_BACKEND", "").strip().upper()
    if forzado:
        elegido = getattr(cv2, f"CAP_{forzado}", None)
        if elegido is not None:
            return elegido
        logger.warning("VIDEO_BACKEND no reconocido: %s", forzado)
    if sys.platform.startswith("win"):
        return cv2.CAP_DSHOW      # DirectShow: evita los fallos de MSMF
    if sys.platform == "darwin":
        return cv2.CAP_AVFOUNDATION
    if sys.platform.startswith("linux"):
        return cv2.CAP_V4L2
    return cv2.CAP_ANY


class _SinSalidaNativa:
    """Silencia los mensajes que las librerías nativas escriben en la consola.

    Si el sistema no permite redirigir los descriptores, no interrumpe el proceso:
    simplemente no silencia nada.
    """

    def __enter__(self):
        self._copias = None
        self._nulo = None
        try:
            self._nulo = os.open(os.devnull, os.O_RDWR)
            self._copias = (os.dup(1), os.dup(2))
            os.dup2(self._nulo, 1)
            os.dup2(self._nulo, 2)
        except Exception:
            self._restaurar()
        return self

    def _restaurar(self):
        if self._copias:
            try:
                os.dup2(self._copias[0], 1)
                os.dup2(self._copias[1], 2)
            except Exception:
                pass
            for fd in self._copias:
                try:
                    os.close(fd)
                except Exception:
                    pass
            self._copias = None
        if self._nulo is not None:
            try:
                os.close(self._nulo)
            except Exception:
                pass
            self._nulo = None

    def __exit__(self, *exc):
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
        self._restaurar()
        return False


def _entrega_imagen(cap, intentos: int = 5) -> bool:
    """Algunas cámaras tardan unos milisegundos en entregar el primer cuadro."""
    for _ in range(intentos):
        leyo, frame = cap.read()
        if leyo and frame is not None:
            return True
        time.sleep(0.05)
    return False


def _abrir_camara(index: int):
    """Abre la cámara del índice indicado. Devuelve el objeto VideoCapture o None si falla."""
    try:
        cap = cv2.VideoCapture(index, _backend_video())
    except Exception:
        return None
    if not cap.isOpened():
        cap.release()
        return None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latencia/frames en cola
    return cap

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


def camera_capture_loop(cap):
    """Camera capture loop with YOLO vehicle detection running in a separate thread"""
    global camera_active, model

    logger.debug("Iniciando captura")

    if cap is None or not cap.isOpened():
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
                    _dibujar_marca(frame, x1, y1, x2, y2, label)

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
    camera_active = False
    logger.debug("Captura detenida")

class CapturedImage(BaseModel):
    filename: str
    url: str  # HTTP URL to the image
    timestamp: datetime

class CaptureStatus(BaseModel):
    is_running: bool
    process_id: Optional[int] = None
    camera_index: Optional[int] = None


def _probar_indice(i: int):
    """Devuelve (dispositivo o None, detalle para el registro)."""
    try:
        return _probar_indice_inner(i)
    except Exception as e:
        return None, f"cámara {i}: error inesperado ({type(e).__name__}: {e})"


def _probar_indice_inner(i: int):
    inicio = time.time()
    cap = _abrir_camara(i)
    if cap is None:
        return None, f"cámara {i}: no abre ({time.time() - inicio:.2f}s)"
    entrega = _entrega_imagen(cap)
    cap.release()
    detalle = f"cámara {i}: abre, entrega={entrega} ({time.time() - inicio:.2f}s)"
    return CameraDevice(index=i, label=f"Cámara {i}", available=entrega), detalle


def _sondear_camaras() -> List[CameraDevice]:
    """Busca cámaras disponibles. Los índices se prueban en paralelo para no acumular esperas."""
    inicio = time.time()
    logger.debug("sondeo: sistema=%s backend=%s índices=%s", sys.platform, _backend_video(), MAX_CAMARAS)
    with _SinSalidaNativa():
        with ThreadPoolExecutor(max_workers=MAX_CAMARAS) as pool:
            resultados = list(pool.map(_probar_indice, range(MAX_CAMARAS)))
    for _, detalle in resultados:
        logger.debug("%s", detalle)
    devices = [d for d, _ in resultados if d is not None]
    logger.debug("sondeo terminado en %.2fs: %s", time.time() - inicio, [(d.index, d.available) for d in devices])
    return devices


@router.get("/dispositivos", response_model=List[CameraDevice])
async def listar_dispositivos(
    refrescar: bool = False,
    current_user: Usuario = Depends(require_internal_user),
):
    global _camaras_cache, _camaras_cache_ts

    # Con la captura activa no se sondean otras cámaras para no quitar la que está en uso.
    if camera_active:
        return [CameraDevice(index=camera_index, label=f"Cámara {camera_index}", available=True)]

    vigente = _camaras_cache and (time.time() - _camaras_cache_ts) < CACHE_CAMARAS_SEG
    if vigente and not refrescar:
        logger.debug("dispositivos: %s desde caché", len(_camaras_cache))
        return _camaras_cache

    try:
        _camaras_cache = await run_in_threadpool(_sondear_camaras)
        _camaras_cache_ts = time.time()
    except Exception:
        logger.warning("no se pudo sondear las cámaras", exc_info=True)
        return _camaras_cache  # se devuelve lo último conocido en vez de fallar
    logger.debug("dispositivos: se devuelven %s", len(_camaras_cache))
    return _camaras_cache


@router.post("/iniciar", response_model=CaptureStatus)
async def iniciar_captura(
    payload: Optional[IniciarCapturaRequest] = None,
    current_user: Usuario = Depends(require_internal_user),
):
    global capture_thread, camera_active, camera_index

    if camera_active:
        raise HTTPException(status_code=400, detail="La captura ya está en ejecución")

    index = camera_index
    if payload is not None and payload.camera_index is not None:
        index = payload.camera_index

    # Se abre la cámara antes de lanzar el hilo para poder informar un error claro al usuario.
    cap = _abrir_camara(index)
    if cap is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No se pudo abrir la cámara {index}. Verifique que esté conectada, "
                "que no la use otra aplicación y que el backend tenga permiso de cámara."
            ),
        )

    try:
        # Ensure captura directory exists
        os.makedirs(CAPTURA_DIR, exist_ok=True)

        # Start camera capture in a thread
        camera_index = index
        camera_active = True
        capture_thread = threading.Thread(target=camera_capture_loop, args=(cap,), daemon=True)
        capture_thread.start()

        return CaptureStatus(is_running=True, process_id=os.getpid(), camera_index=camera_index)

    except Exception as e:
        camera_active = False
        cap.release()
        raise HTTPException(status_code=500, detail=f"Error al iniciar captura: {str(e)}")


@router.post("/detener", response_model=CaptureStatus)
async def detener_captura(current_user: Usuario = Depends(require_internal_user)):
    global capture_thread, camera_active

    if not camera_active:
        return CaptureStatus(is_running=False, camera_index=camera_index)

    try:
        # Stop camera capture
        camera_active = False

        # Wait for thread to finish (with timeout)
        if capture_thread and capture_thread.is_alive():
            capture_thread.join(timeout=5)

        return CaptureStatus(is_running=False, camera_index=camera_index)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al detener captura: {str(e)}")


@router.get("/estado", response_model=CaptureStatus)
async def obtener_estado_captura(current_user: Usuario = Depends(require_internal_user)):
    global camera_active

    return CaptureStatus(
        is_running=camera_active,
        process_id=os.getpid() if camera_active else None,
        camera_index=camera_index if camera_active else None,
    )

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