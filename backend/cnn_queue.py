import os
import glob
import threading
import time
from datetime import datetime
from sqlalchemy.orm import Session

from db import SessionLocal, Imagen, Prediccion
from smog_model import predict_smog  # <- usa tu CNN ya existente

# ======================
# ESTADO GLOBAL
# ======================
queue_running = False
current_file = None
processed_count = 0
pending_count = 0
_lock = threading.Lock()

CAPTURA_DIR = os.path.join(os.path.dirname(__file__), "..", "storage", "capturas")
CAPTURA_DIR = os.path.normpath(CAPTURA_DIR)


def _get_all_images_fifo():
    exts = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
    files = []
    for ext in exts:
        files.extend(glob.glob(os.path.join(CAPTURA_DIR, ext)))
    files.sort(key=os.path.getmtime)  # FIFO: más antigua primero
    return files


def _image_has_prediction(db: Session, image_path: str) -> bool:
    img = db.query(Imagen).filter(Imagen.ruta_archivo == image_path).first()
    if not img:
        return False
    return img.prediccion is not None


def _ensure_image_row(db: Session, image_path: str) -> Imagen:
    filename = os.path.basename(image_path)

    img = db.query(Imagen).filter(Imagen.ruta_archivo == image_path).first()
    if img:
        return img

    img = Imagen(
        filename_original=filename,
        ruta_archivo=image_path,
        fecha_subida=datetime.fromtimestamp(os.path.getmtime(image_path)),
        usuario_id=None,
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return img


def _worker():
    global queue_running, current_file, processed_count, pending_count

    with _lock:
        if queue_running:
            return
        queue_running = True
        processed_count = 0
        current_file = None

    db = None
    try:
        db = SessionLocal()

        files = _get_all_images_fifo()
        pending = [f for f in files if not _image_has_prediction(db, f)]

        with _lock:
            pending_count = len(pending)

        for image_path in pending:
            filename = os.path.basename(image_path)
            with _lock:
                current_file = filename

            # 1) asegurar fila en imagenes
            img_row = _ensure_image_row(db, image_path)

            # 2) correr CNN
            result = predict_smog(image_path)  # debe devolver dict con clase_predicha, confianza, p_smog

            # 3) guardar predicción (1-1)
            pred = Prediccion(
                imagen_id=img_row.id,
                clase_predicha=result["clase_predicha"],
                confianza=float(result["confianza"]),
                p_smog=float(result["p_smog"]),
                fecha_prediccion=datetime.utcnow(),
                observacion="CNN last_model.keras (FIFO)"
            )
            db.add(pred)
            db.commit()

            with _lock:
                processed_count += 1
                pending_count -= 1

            time.sleep(0.2)

    except Exception as e:
        if db:
            db.rollback()
        print("❌ Error en worker CNN:", str(e))

    finally:
        if db:
            db.close()
        with _lock:
            queue_running = False
            current_file = None
            pending_count = 0


def start_queue():
    """Inicia la cola FIFO si no está corriendo."""
    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def get_status():
    """Estado para UI."""
    with _lock:
        return {
            "running": queue_running,
            "current_file": current_file,
            "processed": processed_count,
            "pending": pending_count,
        }
