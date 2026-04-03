from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from modules.roles.roles import require_roles
from db import get_db, Usuario, DispositivoCaptura, HistorialDispositivo


router = APIRouter()

ADMIN = "Administrador"
DEV = "Constructor del sistema"
INV = "Usuario analista"
OP = "Usuario final"


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

class DispositivoCreate(BaseModel):
    nombre_dispositivo: str
    tipo_dispositivo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    resolucion: Optional[str] = None
    fps: Optional[int] = None
    interfaz: Optional[str] = None
    ubicacion_fisica: Optional[str] = None
    fecha_instalacion: Optional[str] = None
    activo: Optional[bool] = True


class DispositivoUpdate(BaseModel):
    nombre_dispositivo: Optional[str] = None
    tipo_dispositivo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    resolucion: Optional[str] = None
    fps: Optional[int] = None
    interfaz: Optional[str] = None
    ubicacion_fisica: Optional[str] = None
    fecha_instalacion: Optional[str] = None
    activo: Optional[bool] = None


class HistorialItem(BaseModel):
    id: int
    dispositivo_id: int
    fecha_inicio: Optional[str]
    fecha_fin: Optional[str]
    observaciones: Optional[str]


class HistorialCreate(BaseModel):
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    observaciones: Optional[str] = None


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value)



@router.get("", response_model=List[DispositivoItem])
async def get_dispositivos(
        current_user: Usuario = Depends(require_roles([ADMIN, DEV, INV, OP])),
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

@router.post("", response_model=DispositivoItem)
async def crear_dispositivo(
    payload: DispositivoCreate,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    item = DispositivoCaptura(
        nombre_dispositivo=payload.nombre_dispositivo,
        tipo_dispositivo=payload.tipo_dispositivo,
        marca=payload.marca,
        modelo=payload.modelo,
        resolucion=payload.resolucion,
        fps=payload.fps,
        interfaz=payload.interfaz,
        ubicacion_fisica=payload.ubicacion_fisica,
        fecha_instalacion=_parse_datetime(payload.fecha_instalacion),
        activo=payload.activo,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return DispositivoItem(
        id=item.id,
        nombre_dispositivo=item.nombre_dispositivo,
        tipo_dispositivo=item.tipo_dispositivo,
        marca=item.marca,
        modelo=item.modelo,
        resolucion=item.resolucion,
        fps=item.fps,
        interfaz=item.interfaz,
        ubicacion_fisica=item.ubicacion_fisica,
        fecha_instalacion=item.fecha_instalacion.strftime("%Y-%m-%d %H:%M:%S") if item.fecha_instalacion else None,
        activo=item.activo,
    )


@router.put("/{dispositivo_id}", response_model=DispositivoItem)
async def actualizar_dispositivo(
    dispositivo_id: int,
    payload: DispositivoUpdate,
    user: Usuario = Depends(require_roles([ADMIN, DEV])),
    db: Session = Depends(get_db),
):
    item = db.query(DispositivoCaptura).filter(DispositivoCaptura.id == dispositivo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")

    for field in [
        "nombre_dispositivo",
        "tipo_dispositivo",
        "marca",
        "modelo",
        "resolucion",
        "fps",
        "interfaz",
        "ubicacion_fisica",
        "activo",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)

    if payload.fecha_instalacion is not None:
        item.fecha_instalacion = _parse_datetime(payload.fecha_instalacion)

    db.commit()
    db.refresh(item)
    return DispositivoItem(
        id=item.id,
        nombre_dispositivo=item.nombre_dispositivo,
        tipo_dispositivo=item.tipo_dispositivo,
        marca=item.marca,
        modelo=item.modelo,
        resolucion=item.resolucion,
        fps=item.fps,
        interfaz=item.interfaz,
        ubicacion_fisica=item.ubicacion_fisica,
        fecha_instalacion=item.fecha_instalacion.strftime("%Y-%m-%d %H:%M:%S") if item.fecha_instalacion else None,
        activo=item.activo,
    )


@router.post("/{dispositivo_id}/desactivar")
async def desactivar_dispositivo(
    dispositivo_id: int,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    item = db.query(DispositivoCaptura).filter(DispositivoCaptura.id == dispositivo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    item.activo = False
    db.commit()
    return {"ok": True, "message": "Dispositivo desactivado"}


@router.get("/{dispositivo_id}/historial", response_model=List[HistorialItem])
async def listar_historial_dispositivo(
    dispositivo_id: int,
    user: Usuario = Depends(require_roles([ADMIN, DEV])),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(HistorialDispositivo)
        .filter(HistorialDispositivo.dispositivo_id == dispositivo_id)
        .order_by(HistorialDispositivo.id.desc())
        .all()
    )
    return [
        HistorialItem(
            id=r.id,
            dispositivo_id=r.dispositivo_id,
            fecha_inicio=r.fecha_inicio.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_inicio else None,
            fecha_fin=r.fecha_fin.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_fin else None,
            observaciones=r.observaciones,
        )
        for r in rows
    ]


@router.post("/{dispositivo_id}/historial", response_model=HistorialItem)
async def crear_historial_dispositivo(
    dispositivo_id: int,
    payload: HistorialCreate,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    disp = db.query(DispositivoCaptura).filter(DispositivoCaptura.id == dispositivo_id).first()
    if not disp:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")

    latest = db.query(HistorialDispositivo.id).order_by(HistorialDispositivo.id.desc()).first()
    next_id = (latest.id + 1) if latest else 1

    item = HistorialDispositivo(
        id=next_id,
        dispositivo_id=dispositivo_id,
        fecha_inicio=_parse_datetime(payload.fecha_inicio),
        fecha_fin=_parse_datetime(payload.fecha_fin),
        observaciones=payload.observaciones,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return HistorialItem(
        id=item.id,
        dispositivo_id=item.dispositivo_id,
        fecha_inicio=item.fecha_inicio.strftime("%Y-%m-%d %H:%M:%S") if item.fecha_inicio else None,
        fecha_fin=item.fecha_fin.strftime("%Y-%m-%d %H:%M:%S") if item.fecha_fin else None,
        observaciones=item.observaciones,
    )
