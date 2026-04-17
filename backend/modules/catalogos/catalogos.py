from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from modules.roles.roles import require_roles
from db import get_db, Usuario, Pais, Provincia, Ciudad

router = APIRouter()


class PaisItem(BaseModel):
    id: int
    nombre: str
    codigo_iso: Optional[str]


class ProvinciaItem(BaseModel):
    id: int
    nombre: str
    pais_id: int


class CiudadItem(BaseModel):
    id: int
    nombre: str
    provincia_id: int
    latitud: Optional[float]
    longitud: Optional[float]


class CiudadCreate(BaseModel):
    nombre: str
    provincia_id: int
    latitud: Optional[float] = None
    longitud: Optional[float] = None


class CiudadUpdate(BaseModel):
    nombre: Optional[str] = None
    provincia_id: Optional[int] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None

class PaisCreate(BaseModel):
    nombre: str
    codigo_iso: Optional[str] = None


class PaisUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo_iso: Optional[str] = None


class ProvinciaCreate(BaseModel):
    nombre: str
    pais_id: int


class ProvinciaUpdate(BaseModel):
    nombre: Optional[str] = None
    pais_id: Optional[int] = None
@router.get("/paises", response_model=List[PaisItem])
async def get_paises(
        current_user: Usuario = Depends(require_roles(
            ["Usuario final", "Usuario analista", "Administrador", "Constructor del sistema"])),
        db: Session = Depends(get_db),
):
    rows = db.query(Pais).order_by(Pais.nombre.asc()).all()
    return [
        PaisItem(
            id=r.id,
            nombre=r.nombre,
            codigo_iso=r.codigo_iso,
        )
        for r in rows
    ]


@router.post("/paises", response_model=PaisItem)
async def crear_pais(
    payload: PaisCreate,
    user: Usuario = Depends(require_roles(["Administrador"])),
    db: Session = Depends(get_db),
):
    item = Pais(
        nombre=payload.nombre,
        codigo_iso=payload.codigo_iso,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return PaisItem(
        id=item.id,
        nombre=item.nombre,
        codigo_iso=item.codigo_iso,
    )


@router.put("/paises/{pais_id}", response_model=PaisItem)
async def actualizar_pais(
    pais_id: int,
    payload: PaisUpdate,
    user: Usuario = Depends(require_roles(["Administrador"])),
    db: Session = Depends(get_db),
):
    item = db.query(Pais).filter(Pais.id == pais_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="País no encontrado")

    if payload.nombre is not None:
        item.nombre = payload.nombre
    if payload.codigo_iso is not None:
        item.codigo_iso = payload.codigo_iso

    db.commit()
    db.refresh(item)
    return PaisItem(
        id=item.id,
        nombre=item.nombre,
        codigo_iso=item.codigo_iso,
    )


@router.get("/provincias", response_model=List[ProvinciaItem])
async def get_provincias(
    pais_id: int = Query(...),
    current_user: Usuario = Depends(require_roles(["Usuario final", "Usuario analista", "Administrador", "Constructor del sistema"])),        db: Session = Depends(get_db),
):
    rows = (
        db.query(Provincia)
        .filter(Provincia.pais_id == pais_id)
        .order_by(Provincia.nombre.asc())
        .all()
    )
    return [
        ProvinciaItem(
            id=r.id,
            nombre=r.nombre,
            pais_id=r.pais_id,
        )
        for r in rows
    ]

@router.post("/provincias", response_model=ProvinciaItem)
async def crear_provincia(
    payload: ProvinciaCreate,
    user: Usuario = Depends(require_roles(["Administrador"])),
    db: Session = Depends(get_db),
):
    pais = db.query(Pais).filter(Pais.id == payload.pais_id).first()
    if not pais:
        raise HTTPException(status_code=404, detail="País no encontrado")

    item = Provincia(
        nombre=payload.nombre,
        pais_id=payload.pais_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ProvinciaItem(
        id=item.id,
        nombre=item.nombre,
        pais_id=item.pais_id,
    )


@router.put("/provincias/{provincia_id}", response_model=ProvinciaItem)
async def actualizar_provincia(
    provincia_id: int,
    payload: ProvinciaUpdate,
    user: Usuario = Depends(require_roles(["Administrador"])),
    db: Session = Depends(get_db),
):
    item = db.query(Provincia).filter(Provincia.id == provincia_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Provincia no encontrada")

    if payload.nombre is not None:
        item.nombre = payload.nombre
    if payload.pais_id is not None:
        pais = db.query(Pais).filter(Pais.id == payload.pais_id).first()
        if not pais:
            raise HTTPException(status_code=404, detail="País no encontrado")
        item.pais_id = payload.pais_id

    db.commit()
    db.refresh(item)
    return ProvinciaItem(
        id=item.id,
        nombre=item.nombre,
        pais_id=item.pais_id,
    )

@router.get("/ciudades", response_model=List[CiudadItem])
async def get_ciudades(
    provincia_id: int = Query(...),
    current_user: Usuario = Depends(require_roles(["Usuario final", "Usuario analista", "Administrador", "Constructor del sistema"])),        db: Session = Depends(get_db),
):
    rows = (
        db.query(Ciudad)
        .filter(Ciudad.provincia_id == provincia_id)
        .order_by(Ciudad.nombre.asc())
        .all()
    )
    return [
        CiudadItem(
            id=r.id,
            nombre=r.nombre,
            provincia_id=r.provincia_id,
            latitud=float(r.latitud) if r.latitud is not None else None,
            longitud=float(r.longitud) if r.longitud is not None else None,
        )
        for r in rows
    ]

@router.post("/ciudades", response_model=CiudadItem)
async def crear_ciudad(
    payload: CiudadCreate,
    user: Usuario = Depends(require_roles(["Administrador"])),
        db: Session = Depends(get_db),
):
    provincia = db.query(Provincia).filter(Provincia.id == payload.provincia_id).first()
    if not provincia:
        raise HTTPException(status_code=404, detail="Provincia no encontrada")

    item = Ciudad(
        nombre=payload.nombre,
        provincia_id=payload.provincia_id,
        latitud=payload.latitud,
        longitud=payload.longitud,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return CiudadItem(
        id=item.id,
        nombre=item.nombre,
        provincia_id=item.provincia_id,
        latitud=float(item.latitud) if item.latitud is not None else None,
        longitud=float(item.longitud) if item.longitud is not None else None,
    )


@router.put("/ciudades/{ciudad_id}", response_model=CiudadItem)
async def actualizar_ciudad(
    ciudad_id: int,
    payload: CiudadUpdate,
    user: Usuario = Depends(require_roles(["Administrador"])),
        db: Session = Depends(get_db),
):
    item = db.query(Ciudad).filter(Ciudad.id == ciudad_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ciudad no encontrada")

    if payload.nombre is not None:
        item.nombre = payload.nombre
    if payload.provincia_id is not None:
        provincia = db.query(Provincia).filter(Provincia.id == payload.provincia_id).first()
        if not provincia:
            raise HTTPException(status_code=404, detail="Provincia no encontrada")
        item.provincia_id = payload.provincia_id
    if payload.latitud is not None:
        item.latitud = payload.latitud
    if payload.longitud is not None:
        item.longitud = payload.longitud

    db.commit()
    db.refresh(item)
    return CiudadItem(
        id=item.id,
        nombre=item.nombre,
        provincia_id=item.provincia_id,
        latitud=float(item.latitud) if item.latitud is not None else None,
        longitud=float(item.longitud) if item.longitud is not None else None,
    )
