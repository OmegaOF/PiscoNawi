from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from modules.auth.auth import get_current_user
from db import get_db, Usuario, Rol, UsuarioRol

router = APIRouter()
ROLE_OPERADOR = "Usuario final"
ROLE_ANALISTA = "Usuario analista"
ROLE_ADMIN = "Administrador"
ROLE_DEV = "Constructor del sistema"

INTERNAL_ALLOWED_ROLES = {
    ROLE_OPERADOR,
    ROLE_ANALISTA,
    ROLE_ADMIN,
    ROLE_DEV,
}



class RoleItem(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None


class UserRolesResponse(BaseModel):
    user_id: int
    username: str
    roles: List[str]


class UserRoleAssignmentItem(BaseModel):
    id: int
    usuario_id: int
    rol_id: int


class UserRoleAssignmentCreate(BaseModel):
    usuario_id: int
    rol_id: int


class UserRoleAssignmentUpdate(BaseModel):
    rol_id: int


def get_user_roles(db: Session, user_id: int) -> List[str]:
    rows = (
        db.query(Rol.nombre)
        .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
        .filter(UsuarioRol.usuario_id == user_id)
        .order_by(Rol.nombre.asc())
        .all()
    )
    return [r.nombre for r in rows]


def require_roles(allowed_roles: List[str]):
    async def role_dependency(
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Usuario:
        user_roles = get_user_roles(db, current_user.id)
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para esta acción"
            )
        return current_user

    return role_dependency


async def require_internal_user(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Usuario:
    roles = get_user_roles(db, current_user.id)
    if not any(r in INTERNAL_ALLOWED_ROLES for r in roles):
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
    return current_user

@router.get("/me", response_model=UserRolesResponse)
async def get_current_user_roles(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = get_user_roles(db, current_user.id)
    return UserRolesResponse(
        user_id=current_user.id,
        username=current_user.username,
        roles=roles,
    )


@router.get("", response_model=List[RoleItem])
async def get_roles(
    user: Usuario = Depends(require_roles([ROLE_ADMIN, ROLE_DEV])),    db: Session = Depends(get_db),
):
    rows = db.query(Rol).order_by(Rol.nombre.asc()).all()
    return [
        RoleItem(
            id=r.id,
            nombre=r.nombre,
            descripcion=r.descripcion,
        )
        for r in rows
    ]


@router.get("/usuario/{user_id}", response_model=UserRolesResponse)
async def get_roles_by_user(
    user_id: int,
    user: Usuario = Depends(require_roles([ROLE_ADMIN, ROLE_DEV])),
        db: Session = Depends(get_db),
):
    target_user = db.query(Usuario).filter(Usuario.id == user_id).first()

    if target_user:
        username = target_user.username
    else:
        username = f"user_{user_id}"

    roles = get_user_roles(db, user_id)

    return UserRolesResponse(
        user_id=user_id,
        username=username,
        roles=roles,
    )


@router.get("/test-admin")
async def test_admin_access(
    user: Usuario = Depends(require_roles([ROLE_ADMIN]))):
    return {
        "ok": True,
        "message": "Acceso permitido para Administrador",
    }


@router.get("/asignaciones", response_model=List[UserRoleAssignmentItem])
async def listar_asignaciones_roles(
    user: Usuario = Depends(require_roles([ROLE_ADMIN, ROLE_DEV])),
        db: Session = Depends(get_db),
):
    rows = db.query(UsuarioRol).order_by(UsuarioRol.id.asc()).all()
    return [
        UserRoleAssignmentItem(id=r.id, usuario_id=r.usuario_id, rol_id=r.rol_id)
        for r in rows
    ]


@router.post("/asignaciones", response_model=UserRoleAssignmentItem)
async def crear_asignacion_rol(
    payload: UserRoleAssignmentCreate,
    user: Usuario = Depends(require_roles([ROLE_ADMIN])),
        db: Session = Depends(get_db),
):
    usuario = db.query(Usuario).filter(Usuario.id == payload.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    rol = db.query(Rol).filter(Rol.id == payload.rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    exists = (
        db.query(UsuarioRol)
        .filter(UsuarioRol.usuario_id == payload.usuario_id, UsuarioRol.rol_id == payload.rol_id)
        .first()
    )
    if exists:
        return UserRoleAssignmentItem(id=exists.id, usuario_id=exists.usuario_id, rol_id=exists.rol_id)

    item = UsuarioRol(usuario_id=payload.usuario_id, rol_id=payload.rol_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return UserRoleAssignmentItem(id=item.id, usuario_id=item.usuario_id, rol_id=item.rol_id)


@router.put("/asignaciones/{assignment_id}", response_model=UserRoleAssignmentItem)
async def actualizar_asignacion_rol(
    assignment_id: int,
    payload: UserRoleAssignmentUpdate,
        user: Usuario = Depends(require_roles([ROLE_ADMIN, ROLE_DEV])),
        db: Session = Depends(get_db),
):
    item = db.query(UsuarioRol).filter(UsuarioRol.id == assignment_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    rol = db.query(Rol).filter(Rol.id == payload.rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    item.rol_id = payload.rol_id
    db.commit()
    db.refresh(item)
    return UserRoleAssignmentItem(id=item.id, usuario_id=item.usuario_id, rol_id=item.rol_id)


@router.delete("/asignaciones/{assignment_id}")
async def eliminar_asignacion_rol(
    assignment_id: int,
    user: Usuario = Depends(require_roles([ROLE_ADMIN])),
        db: Session = Depends(get_db),
):
    item = db.query(UsuarioRol).filter(UsuarioRol.id == assignment_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    db.delete(item)
    db.commit()
    return {"ok": True, "message": "Asignación eliminada"}
