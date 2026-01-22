from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from pydantic import BaseModel

from auth import get_current_user
from db import get_db, Usuario, Imagen, Prediccion

router = APIRouter()

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
    db: Session = Depends(get_db)
):
    # Query to join imagenes and predicciones tables
    results = db.query(
        Imagen.id,
        Imagen.filename_original,
        Imagen.ruta_archivo,
        Imagen.placa_manual,
        Prediccion.clase_predicha,
        Prediccion.confianza,
        Prediccion.p_smog,
        Prediccion.observacion,
        Prediccion.fecha_prediccion
    ).join(
        Prediccion,
        Imagen.id == Prediccion.imagen_id
    ).all()

    analisis_items = []
    for row in results:
        analisis_items.append(AnalisisItem(
            id=row.id,
            imagen_id=row.id,  # imagen_id is the same as id in this context
            filename_original=row.filename_original,
            ruta_archivo=row.ruta_archivo,
            placa_manual=row.placa_manual,
            clase_predicha=row.clase_predicha,
            confianza=row.confianza,
            p_smog=row.p_smog,
            observacion=row.observacion,
            fecha_prediccion=row.fecha_prediccion.strftime("%Y-%m-%d %H:%M:%S")
        ))

    return analisis_items

@router.post("/analizar/{imagen_id}")
async def analizar_con_ia(
    imagen_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get the image and its prediction
    imagen = db.query(Imagen).filter(Imagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    prediccion = db.query(Prediccion).filter(Prediccion.imagen_id == imagen_id).first()
    if not prediccion:
        raise HTTPException(status_code=404, detail="Predicción no encontrada para esta imagen")

    # Here we would call the OpenAI service
    # For now, we'll import and call the function
    from openai_service import analizar_imagen_openai

    try:
        resultado = await analizar_imagen_openai(imagen.ruta_archivo)

        # Update the prediction with new results
        prediccion.clase_predicha = "smog" if resultado["smog_visible"] else "sin_smog"
        prediccion.confianza = resultado["nivel_confianza"] / 100.0
        prediccion.p_smog = resultado["porcentaje_smog"] / 100.0
        prediccion.observacion = resultado["descripcion_corta"]
        prediccion.fecha_prediccion = db.func.now()

        # Update license plate if detected
        if resultado.get("placa") and resultado["placa"] != "undefined":
            imagen.placa_manual = resultado["placa"]

        db.commit()

        return {"message": "Análisis completado y actualizado", "resultado": resultado}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en el análisis con IA: {str(e)}")