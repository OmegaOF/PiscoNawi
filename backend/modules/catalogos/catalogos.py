from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from modules.auth.auth import get_current_user
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


@router.get("/paises", response_model=List[PaisItem])
async def get_paises(
    current_user: Usuario = Depends(get_current_user),
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


@router.get("/provincias", response_model=List[ProvinciaItem])
async def get_provincias(
    pais_id: int = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
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


@router.get("/ciudades", response_model=List[CiudadItem])
async def get_ciudades(
    provincia_id: int = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
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
