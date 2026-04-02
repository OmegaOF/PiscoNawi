from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from modules.auth.auth import get_current_user
from db import get_db, Usuario, DispositivoCaptura

router = APIRouter()


class DispositivoItem(BaseModel):
    id: int
    nombre_dispositivo: str
    tipo_dispositivo: Optional[str]
    marca: Optional[str]
    modelo: Optional[str]
    resolucion: Optional[str]
    fps: Optional[int]
    interfaz: Optional[str]
    ubicacion_fisica: Optional[str]
    fecha_instalacion: Optional[str]
    activo: Optional[bool]


@router.get("", response_model=List[DispositivoItem])
async def get_dispositivos(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(DispositivoCaptura).order_by(DispositivoCaptura.id.asc()).all()
    return [
        DispositivoItem(
            id=r.id,
            nombre_dispositivo=r.nombre_dispositivo,
            tipo_dispositivo=r.tipo_dispositivo,
            marca=r.marca,
            modelo=r.modelo,
            resolucion=r.resolucion,
            fps=r.fps,
            interfaz=r.interfaz,
            ubicacion_fisica=r.ubicacion_fisica,
            fecha_instalacion=r.fecha_instalacion.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_instalacion else None,
            activo=r.activo,
        )
        for r in rows
    ]
