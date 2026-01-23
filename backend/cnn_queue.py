import os
import glob
import threading
import time
import asyncio
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func

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

# ✅ URL pública donde FastAPI sirve las capturas (main.py monta /capturas)
PUBLIC_BASE_URL = "http://localhost:8000/capturas"


def _get_all_images_fifo():
    exts = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
    files = []
    for ext in exts:
        files.extend(glob.glob(os.path.join(CAPTURA_DIR, ext)))
    files.sort(key=os.path.getmtime)  # FIFO: más antigua primero
    return files


def _image_has_prediction(db: Session, image_path: str) -> bool:
    """
    ✅ Se revisa por filename_original (no por ruta), porque ahora ruta_archivo será una URL.
    """
    filename = os.path.basename(image_path)
    img = db.query(Imagen).filter(Imagen.filename_original == filename).first()
    if not img:
        return False
    return img.prediccion is not None


def _ensure_image_row(db: Session, image_path: str) -> Imagen:
    """
    ✅ Guarda ruta_archivo como URL pública: http://localhost:8000/capturas/<filename>
    ✅ Mantiene filename_original para vincular la imagen al archivo físico.
    """
    filename = os.path.basename(image_path)
    public_url = f"{PUBLIC_BASE_URL}/{filename}"

    # Si ya existe por URL pública
    img = db.query(Imagen).filter(Imagen.ruta_archivo == public_url).first()
    if img:
        return img

    # Si ya existe por filename_original (por si antes se guardó diferente)
    img = db.query(Imagen).filter(Imagen.filename_original == filename).first()
    if img:
        img.ruta_archivo = public_url
        db.commit()
        db.refresh(img)
        return img

    # Crear nuevo registro guardando URL pública
    img = Imagen(
        filename_original=filename,
        ruta_archivo=public_url,
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

            # 1) asegurar fila en imagenes (guardando URL pública)
            img_row = _ensure_image_row(db, image_path)

            # 2) correr CNN usando la RUTA LOCAL REAL (no URL)
            result = predict_smog(image_path)

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

        # ✅ After CNN processing completes, automatically run additional analysis
        _run_post_processing_analysis(db)

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


def _run_post_processing_analysis(db: Session):
    """
    Internal function that runs additional analysis after CNN processing completes.
    This automatically enhances predictions for today's images.
    """
    try:
        from openai_service import analizar_imagen_openai
        
        # Get today's date (start of day)
        today = date.today()
        start_of_day = datetime.combine(today, datetime.min.time())

        # Get all images uploaded today that have predictions
        images_with_predictions = db.query(Imagen).join(Prediccion).filter(
            Imagen.fecha_subida >= start_of_day
        ).all()

        if not images_with_predictions:
            print("ℹ️ No hay imágenes para análisis adicional")
            return

        print(f"🔄 Iniciando análisis adicional de {len(images_with_predictions)} imágenes...")
        
        success_count = 0
        failed_count = 0

        for imagen in images_with_predictions:
            try:
                # Get the prediction for this image
                prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen.id).first()
                if not prediccion:
                    failed_count += 1
                    print(f"⚠️ Predicción no encontrada para imagen {imagen.id}")
                    continue

                # Analyze with additional service
                # We need to run async function in sync context
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                resultado = loop.run_until_complete(analizar_imagen_openai(imagen.ruta_archivo))
                loop.close()

                # Update the prediction
                prediccion.clase_predicha = "smog" if resultado["smog_visible"] else "sin_smog"
                prediccion.confianza = resultado["nivel_confianza"] / 100.0
                prediccion.p_smog = resultado["porcentaje_smog"] / 100.0
                prediccion.observacion = resultado["descripcion_corta"]
                prediccion.fecha_prediccion = func.now()

                # Update license plate if detected
                if resultado.get("placa") and resultado["placa"] != "undefined":
                    imagen.placa_manual = resultado["placa"]

                success_count += 1
                print(f"✅ Análisis adicional completado para imagen {imagen.id}")

            except Exception as e:
                failed_count += 1
                error_msg = str(e) if str(e) else f"Error desconocido (tipo: {type(e).__name__})"
                print(f"❌ Error en análisis adicional de imagen {imagen.id}: {error_msg}")
                db.rollback()
                continue

        # Commit all successful updates
        try:
            db.commit()
            print(f"✅ Análisis adicional finalizado: {success_count} exitosos, {failed_count} fallidos")
        except Exception as e:
            db.rollback()
            print(f"❌ Error guardando cambios del análisis adicional: {str(e)}")

    except Exception as e:
        print(f"❌ Error general en análisis adicional: {str(e)}")
        if db:
            db.rollback()
