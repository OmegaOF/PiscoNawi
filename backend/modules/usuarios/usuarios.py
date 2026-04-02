from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import get_db, Usuario
from modules.auth.auth import get_current_user, get_password_hash
from modules.roles.roles import require_roles

router = APIRouter()

ADMIN = "Administrador del sistema"
DEV = "Desarrollador"
INV = "Investigador ambiental"


class UsuarioItem(BaseModel):
    id: int
    nombre: str
    username: str
    creado_en: Optional[str]


class UsuarioCreate(BaseModel):
    nombre: str
    username: str
    password: str


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@router.get("", response_model=List[UsuarioItem])
async def listar_usuarios(
    user: Usuario = Depends(require_roles([ADMIN, DEV, INV])),
    db: Session = Depends(get_db),
):
    rows = db.query(Usuario).order_by(Usuario.id.asc()).all()
    return [
        UsuarioItem(
            id=r.id,
            nombre=r.nombre,
            username=r.username,
            creado_en=r.creado_en.strftime("%Y-%m-%d %H:%M:%S") if r.creado_en else None,
        )
        for r in rows
    ]


@router.get("/id/{user_id}", response_model=UsuarioItem)
async def obtener_usuario(
    user_id: int,
    user: Usuario = Depends(require_roles([ADMIN, DEV, INV])),
    db: Session = Depends(get_db),
):
    target = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UsuarioItem(
        id=target.id,
        nombre=target.nombre,
        username=target.username,
        creado_en=target.creado_en.strftime("%Y-%m-%d %H:%M:%S") if target.creado_en else None,
    )


@router.post("", response_model=UsuarioItem)
async def crear_usuario(
    payload: UsuarioCreate,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    exists = db.query(Usuario).filter(Usuario.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="El username ya existe")

    nuevo = Usuario(
        nombre=payload.nombre,
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        creado_en=datetime.utcnow(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return UsuarioItem(
        id=nuevo.id,
        nombre=nuevo.nombre,
        username=nuevo.username,
        creado_en=nuevo.creado_en.strftime("%Y-%m-%d %H:%M:%S") if nuevo.creado_en else None,
    )


@router.put("/id/{user_id}", response_model=UsuarioItem)
async def actualizar_usuario(
    user_id: int,
    payload: UsuarioUpdate,
    user: Usuario = Depends(require_roles([ADMIN, DEV])),
    db: Session = Depends(get_db),
):
    target = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.username and payload.username != target.username:
        exists = db.query(Usuario).filter(Usuario.username == payload.username).first()
        if exists:
            raise HTTPException(status_code=400, detail="El username ya existe")

    if payload.nombre is not None:
        target.nombre = payload.nombre
    if payload.username is not None:
        target.username = payload.username
    if payload.password is not None:
        target.password_hash = get_password_hash(payload.password)

    db.commit()
    db.refresh(target)
    return UsuarioItem(
        id=target.id,
        nombre=target.nombre,
        username=target.username,
        creado_en=target.creado_en.strftime("%Y-%m-%d %H:%M:%S") if target.creado_en else None,
    )


@router.post("/id/{user_id}/desactivar")
async def desactivar_usuario(
    user_id: int,
    user: Usuario = Depends(require_roles([ADMIN])),
    db: Session = Depends(get_db),
):
    target = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if target.username.startswith("desactivado__"):
        return {"ok": True, "message": "Usuario ya estaba desactivado"}

    target.username = f"desactivado__{target.id}__{target.username}"
    target.password_hash = get_password_hash(f"disabled-{target.id}-{datetime.utcnow().timestamp()}")
    db.commit()
    return {"ok": True, "message": "Usuario desactivado"}


@router.get("/me/perfil", response_model=UsuarioItem)
async def mi_perfil(current_user: Usuario = Depends(get_current_user)):
    return UsuarioItem(
        id=current_user.id,
        nombre=current_user.nombre,
        username=current_user.username,
        creado_en=current_user.creado_en.strftime("%Y-%m-%d %H:%M:%S") if current_user.creado_en else None,
    )


@router.put("/me/perfil", response_model=UsuarioItem)
async def actualizar_mi_perfil(
    payload: UsuarioUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(Usuario).filter(Usuario.id == current_user.id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.nombre is not None:
        target.nombre = payload.nombre
    if payload.password is not None:
        target.password_hash = get_password_hash(payload.password)

    db.commit()
    db.refresh(target)
    return UsuarioItem(
        id=target.id,
        nombre=target.nombre,
        username=target.username,
        creado_en=target.creado_en.strftime("%Y-%m-%d %H:%M:%S") if target.creado_en else None,
    )
