import os
import glob
import threading
import time
from datetime import datetime
from sqlalchemy.orm import Session

from db import SessionLocal, Imagen, Prediccion
from smog_model import predict_smog

# ======================
# ESTADO GLOBAL DEL WORKER
# ======================
queue_running = False
current_file = None
processed_count = 0
pending_count = 0
lock = threading.Lock()

CAPTURA_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "storage",
    "capturas"
)
CAPTURA_DIR = os.path.normpath(CAPTURA_DIR)


# ======================
# UTILIDADES
# ======================
def get_all_images_fifo():
    exts = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
    files = []
    for ext in exts:
        files.extend(glob.glob(os.path.join(CAPTURA_DIR, ext)))

    # FIFO → más antiguas primero
    files.sort(key=os.path.getmtime)
    return files


def image_has_prediction(db: Session, image_path: str) -> bool:
    img = db.query(Imagen).filter(Imagen.ruta_archivo == image_path).first()
    if not img:
        return False
    return img.prediccion is not None


def ensure_image_row(db: Session, image_path: str):
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


# ======================
# WORKER PRINCIPAL
# ======================
def worker_process_queue():
    global queue_running, current_file, processed_count, pending_count

    with lock:
        if queue_running:
            return
        queue_running = True
        processed_count = 0

    try:
        db = SessionLocal()
        files = get_all_images_fifo()

        pending = []
        for f in files:
            if not image_has_prediction(db, f):
                pending.append(f)

        pending_count = len(pending)

        for image_path in pending:
            with lock:
                current_file = os.path.basename(image_path)

            print(f"🧠 Procesando CNN: {current_file}")

            try:
                img_row = ensure_image_row(db, image_path)
                result = predict_smog(image_path)

                pred = Prediccion(
                    imagen_id=img_row.id,
                    clase_predicha=result["clase_predicha"],
                    confianza=result["confianza"],
                    p_smog=result["p_smog"],
                    fecha_prediccion=datetime.utcnow(),
                    observacion="CNN last_model.keras"
                )
                db.add(pred)
                db.commit()

                processed_count += 1

            except Exception as e:
                print("❌ Error procesando:", image_path, e)
                db.rollback()

            time.sleep(0.2)  # pequeña pausa para no saturar CPU

        db.close()

    finally:
        with lock:
            queue_running = False
            current_file = None
            pending_count = 0


def start_queue():
    t = threading.Thread(target=worker_process_queue, daemon=True)
    t.start()


def get_status():
    with lock:
        return {
            "running": queue_running,
            "current_file": current_file,
            "processed": processed_count,
            "pending": pending_count,
        }
