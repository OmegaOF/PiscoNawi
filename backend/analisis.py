from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from cnn_queue import start_queue, get_status
from auth import get_current_user
from db import get_db, Usuario, Imagen, Prediccion, Ubicacion

router = APIRouter()


class ProcesarCnnBody(BaseModel):
    """Requerido: ubicación actual para asociar a todas las imágenes procesadas."""
    lat: float
    lng: float
    nombre: Optional[str] = None  # opcional; si no se envía, se puede completar por reverse geocode

class AnalisisItem(BaseModel):
    id: int
    imagen_id: int
    filename_original: str
    ruta_archivo: str
    placa_manual: Optional[str]
    clase_predicha: str
    confianza: float
    p_smog: float
    observacion: Optional[str]
    fecha_prediccion: str

@router.get("/emisiones", response_model=List[AnalisisItem])
async def obtener_analisis_emisiones(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Join imagenes + predicciones (solo las que ya tienen predicción)
    results = (
        db.query(
            Imagen.id,
            Imagen.filename_original,
            Imagen.ruta_archivo,
            Imagen.placa_manual,
            Prediccion.clase_predicha,
            Prediccion.confianza,
            Prediccion.p_smog,
            Prediccion.observacion,
            Prediccion.fecha_prediccion,
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .all()
    )

    analisis_items: List[AnalisisItem] = []
    for row in results:
        analisis_items.append(
            AnalisisItem(
                id=row.id,
                imagen_id=row.id,  # aquí coincide con Imagen.id
                filename_original=row.filename_original,
                ruta_archivo=row.ruta_archivo,
                placa_manual=row.placa_manual,
                clase_predicha=row.clase_predicha,
                confianza=float(row.confianza),
                p_smog=float(row.p_smog),
                observacion=row.observacion,
                fecha_prediccion=row.fecha_prediccion.strftime("%Y-%m-%d %H:%M:%S"),
            )
        )

    return analisis_items

@router.post("/analizar/{imagen_id}")
async def analizar_con_ia(
    imagen_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the image and its prediction
    imagen = db.query(Imagen).filter(Imagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen_id).first()
    if not prediccion:
        raise HTTPException(status_code=404, detail="Predicción no encontrada para esta imagen")

    # Here we call the analysis service
    # For now, we'll import and call the function
    from openai_service import analizar_imagen_openai

    try:
        resultado = await analizar_imagen_openai(imagen.ruta_archivo)

        # Update the prediction with new results
        prediccion.clase_predicha = "smog" if resultado["smog_visible"] else "sin_smog"
        prediccion.confianza = resultado["nivel_confianza"] / 100.0
        prediccion.p_smog = resultado["porcentaje_smog"] / 100.0
        prediccion.observacion = resultado["descripcion_corta"]
        # Nota: usar datetime.utcnow() si quieres evitar db.func.now()
        # prediccion.fecha_prediccion = datetime.utcnow()

        # Update license plate if detected
        if resultado.get("placa") and resultado["placa"] != "undefined":
            imagen.placa_manual = resultado["placa"]

        db.commit()

        return {"message": "Análisis completado y actualizado", "resultado": resultado}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el análisis con IA: {str(e)}")


# ✅ ESTOS ENDPOINTS DEBEN ESTAR A NIVEL RAÍZ (NO DENTRO DE OTRA FUNCIÓN)

async def _reverse_geocode_nombre(lat: float, lng: float) -> Optional[str]:
    """Obtiene nombre/dirección desde Nominatim (OpenStreetMap)."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json"},
                headers={"User-Agent": "PiscoNawi-App/1.0"},
            )
            if r.status_code != 200:
                return None
            data = r.json()
            return data.get("display_name") or None
    except Exception:
        return None


@router.post("/procesar-cnn")
async def procesar_cnn(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: ProcesarCnnBody = Body(...),
):
    # Crear ubicación con todos los datos posibles (nombre desde UI o reverse geocode)
    nombre = body.nombre
    if not nombre or not nombre.strip():
        nombre = await _reverse_geocode_nombre(body.lat, body.lng)
    ub = Ubicacion(
        latitud=body.lat,
        longitud=body.lng,
        nombre=nombre.strip() if nombre and nombre.strip() else None,
    )
    db.add(ub)
    db.commit()
    db.refresh(ub)
    ubicacion_id = ub.id
    # Sin tocar la lógica CNN: solo pasamos ubicacion_id para que cada imagen se relacione
    start_queue(ubicacion_id=ubicacion_id)
    return {"message": "Procesamiento CNN iniciado (FIFO 1 por 1)"}


@router.get("/estado-cnn")
async def estado_cnn(current_user: Usuario = Depends(get_current_user)):
    return get_status()


class BulkAnalysisResult(BaseModel):
    processed_count: int
    success_count: int
    failed_count: int
    errors: List[str]

@router.post("/analizar-todas-hoy", response_model=BulkAnalysisResult)
async def analizar_todas_imagenes_hoy(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process all images uploaded today with AI analysis
    """
    # Get today's date (start of day)
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())

    # Get all images uploaded today that have predictions
    images_with_predictions = db.query(Imagen).join(Prediccion).filter(
        Imagen.fecha_subida >= start_of_day
    ).all()

    if not images_with_predictions:
        return BulkAnalysisResult(
            processed_count=0,
            success_count=0,
            failed_count=0,
            errors=["No hay imágenes para analizar hoy"]
        )

    processed_count = 0
    success_count = 0
    failed_count = 0
    errors = []

    # Import the analysis service
    from openai_service import analizar_imagen_openai

    for imagen in images_with_predictions:
        processed_count += 1
        try:
            # Get the prediction for this image
            prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen.id).first()
            if not prediccion:
                failed_count += 1
                errors.append(f"Predicción no encontrada para imagen {imagen.id}")
                continue

            # Analyze with CNN
            resultado = await analizar_imagen_openai(imagen.ruta_archivo)

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

        except Exception as e:
            failed_count += 1
            error_msg = str(e) if str(e) else f"Error desconocido (tipo: {type(e).__name__})"
            errors.append(f"Error procesando imagen {imagen.id}: {error_msg}")
            db.rollback()  # Rollback any partial changes for this image
            continue

    # Commit all successful updates
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error guardando cambios: {str(e)}")

    return BulkAnalysisResult(
        processed_count=processed_count,
        success_count=success_count,
        failed_count=failed_count,
        errors=errors
    )