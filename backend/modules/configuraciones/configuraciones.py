from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import get_db, Usuario, ConfiguracionSistema
from modules.roles.roles import require_roles

router = APIRouter()

ADMIN = "Administrador del sistema"
DEV = "Desarrollador"


class ConfigItem(BaseModel):
    id: int
    clave: str
    valor: Optional[str]
    descripcion: Optional[str]
    dispositivo_captura_id: Optional[int]


class ConfigCreate(BaseModel):
    clave: str
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    dispositivo_captura_id: Optional[int] = None


class ConfigUpdate(BaseModel):
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    dispositivo_captura_id: Optional[int] = None


@router.get("", response_model=List[ConfigItem])
async def listar_configuraciones(
    user: Usuario = Depends(require_roles([ADMIN, DEV])),
    db: Session = Depends(get_db),
):
    rows = db.query(ConfiguracionSistema).order_by(ConfiguracionSistema.id.asc()).all()
    return [
        ConfigItem(
            id=r.id,
            clave=r.clave,
            valor=r.valor,
            descripcion=r.descripcion,
            dispositivo_captura_id=r.dispositivo_captura_id,
        )
        for r in rows
    ]


@router.post("", response_model=ConfigItem)
async def crear_configuracion(
    payload: ConfigCreate,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    item = ConfiguracionSistema(
        clave=payload.clave,
        valor=payload.valor,
        descripcion=payload.descripcion,
        dispositivo_captura_id=payload.dispositivo_captura_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ConfigItem(
        id=item.id,
        clave=item.clave,
        valor=item.valor,
        descripcion=item.descripcion,
        dispositivo_captura_id=item.dispositivo_captura_id,
    )


@router.put("/{config_id}", response_model=ConfigItem)
async def actualizar_configuracion(
    config_id: int,
    payload: ConfigUpdate,
    user: Usuario = Depends(require_roles([ADMIN, DEV])),
    db: Session = Depends(get_db),
):
    item = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.id == config_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    if payload.valor is not None:
        item.valor = payload.valor
    if payload.descripcion is not None:
        item.descripcion = payload.descripcion
    if payload.dispositivo_captura_id is not None:
        item.dispositivo_captura_id = payload.dispositivo_captura_id

    db.commit()
    db.refresh(item)
    return ConfigItem(
        id=item.id,
        clave=item.clave,
        valor=item.valor,
        descripcion=item.descripcion,
        dispositivo_captura_id=item.dispositivo_captura_id,
    )
