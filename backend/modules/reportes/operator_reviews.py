from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from modules.roles.roles import require_roles
from db import get_db, Usuario, Imagen, Prediccion

router = APIRouter()


class HistorialPropioItem(BaseModel):
    imagen_id: int
    filename_original: str
    ruta_archivo: str
    placa_manual: Optional[str]
    clase_predicha: str
    confianza: float
    p_smog: float
    observacion: Optional[str]
    fecha_prediccion: str


@router.get("/historial-propio", response_model=List[HistorialPropioItem])
async def get_historial_propio(
    current_user: Usuario = Depends(require_roles(["Usuario final", "Administrador", "Constructor del sistema"])),
        db: Session = Depends(get_db),
):
    rows = (
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
        .filter(Imagen.usuario_id == current_user.id)
        .order_by(Prediccion.fecha_prediccion.desc())
        .limit(50)
        .all()
    )

    return [
        HistorialPropioItem(
            imagen_id=r.id,
            filename_original=r.filename_original,
            ruta_archivo=r.ruta_archivo,
            placa_manual=r.placa_manual,
            clase_predicha=r.clase_predicha,
            confianza=float(r.confianza),
            p_smog=float(r.p_smog),
            observacion=r.observacion,
            fecha_prediccion=r.fecha_prediccion.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_prediccion else "",
        )
        for r in rows
    ]
