"""
Registro manual de placas.

Lista vehículos (imágenes con predicción) para que el operador registre la placa
y permite guardar / limpiar `imagenes.placa_manual`. No modifica el esquema.
"""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from db import get_db, Usuario, Imagen, Prediccion, Ubicacion, DispositivoCaptura
from modules.roles.roles import require_roles, ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV
from modules.reportes.reports import ReportFilters, report_filters, _nombre_corto_ubicacion

router = APIRouter()
_require = require_roles([ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])

PLACA_RE = re.compile(r"^\d{3,4}[A-Z]{3}$")
PLACA_MAX = 20
ESTADO_PATTERN = "^(sin_placa|con_placa|todas)$"
CLASE_PATTERN = "^(smog|sin_smog|todas)$"
ORDEN = {
    "p_smog": (Prediccion.p_smog.desc(), Prediccion.id.desc()),
    "fecha": (Prediccion.fecha_prediccion.desc(), Prediccion.id.desc()),
}
_PLACA_VACIA = or_(Imagen.placa_manual.is_(None), func.trim(Imagen.placa_manual) == "")
_PLACA_PRESENTE = and_(Imagen.placa_manual.isnot(None), func.trim(Imagen.placa_manual) != "")


# --- Modelos ---

class VehiculoPlacaItem(BaseModel):
    imagen_id: int
    ruta_archivo: str
    filename_original: str
    placa_manual: Optional[str] = None
    clase_predicha: Optional[str] = None
    p_smog: float = 0.0
    confianza: float = 0.0
    fecha_prediccion: Optional[str] = None
    ubicacion_id: Optional[int] = None
    ubicacion_nombre: Optional[str] = None
    dispositivo_id: Optional[int] = None
    dispositivo_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None
    observacion: Optional[str] = None


class ResumenPlacas(BaseModel):
    total: int
    con_placa: int
    sin_placa: int
    pct_completado: float


class VehiculosPlacaResponse(BaseModel):
    items: List[VehiculoPlacaItem]
    total: int
    page: int
    size: int
    resumen: ResumenPlacas


class PlacaBody(BaseModel):
    placa: Optional[str] = None


class PlacaUpdateResponse(VehiculoPlacaItem):
    formato_valido: bool


class OpcionFiltro(BaseModel):
    id: int
    nombre: str


class FiltrosPlacasResponse(BaseModel):
    zonas: List[OpcionFiltro]
    dispositivos: List[OpcionFiltro]


# --- Helpers ---

def normalizar_placa(valor: Optional[str]) -> Optional[str]:
    """Quita espacios y guiones y pasa a mayúsculas. Vacío → None."""
    if valor is None:
        return None
    s = re.sub(r"[\s\-]", "", valor).upper()
    return s or None


def _fmt_dt(v) -> Optional[str]:
    if v is None:
        return None
    return v[:19] if isinstance(v, str) else v.strftime("%Y-%m-%d %H:%M:%S")


_COLS = (
    Imagen.id,
    Imagen.ruta_archivo,
    Imagen.filename_original,
    Imagen.placa_manual,
    Imagen.ubicacion_id,
    Imagen.dispositivo_captura_id,
    Ubicacion.direccion,
    DispositivoCaptura.nombre_dispositivo,
    Usuario.nombre.label("usuario_nombre"),
    Prediccion.clase_predicha,
    Prediccion.p_smog,
    Prediccion.confianza,
    Prediccion.fecha_prediccion,
    Prediccion.observacion,
)


def _base(db: Session, f: Optional[ReportFilters], clase: str, prediccion_requerida: bool = True):
    q = db.query(*_COLS).select_from(Imagen)
    if prediccion_requerida:
        q = q.join(Prediccion, Prediccion.imagen_id == Imagen.id)
    else:
        q = q.outerjoin(Prediccion, Prediccion.imagen_id == Imagen.id)
    q = (
        q.outerjoin(Ubicacion, Ubicacion.id == Imagen.ubicacion_id)
        .outerjoin(DispositivoCaptura, DispositivoCaptura.id == Imagen.dispositivo_captura_id)
        .outerjoin(Usuario, Usuario.id == Imagen.usuario_id)
    )
    if f is not None:
        q = f.apply_pred(q, imagen_joined=True)
    if clase != "todas":
        q = q.filter(Prediccion.clase_predicha == clase)
    return q


def _aplicar_estado_q(q, estado: str, qtext: Optional[str]):
    if estado == "sin_placa":
        q = q.filter(_PLACA_VACIA)
    elif estado == "con_placa":
        q = q.filter(_PLACA_PRESENTE)
    if qtext:
        q = q.filter(func.upper(Imagen.placa_manual).like(f"%{qtext}%"))
    return q


def _to_item(r) -> VehiculoPlacaItem:
    return VehiculoPlacaItem(
        imagen_id=r.id,
        ruta_archivo=r.ruta_archivo,
        filename_original=r.filename_original,
        placa_manual=r.placa_manual,
        clase_predicha=r.clase_predicha,
        p_smog=round(float(r.p_smog or 0), 4),
        confianza=round(float(r.confianza or 0), 4),
        fecha_prediccion=_fmt_dt(r.fecha_prediccion),
        ubicacion_id=r.ubicacion_id,
        ubicacion_nombre=_nombre_corto_ubicacion(r.ubicacion_id, r.direccion) if r.ubicacion_id else None,
        dispositivo_id=r.dispositivo_captura_id,
        dispositivo_nombre=r.nombre_dispositivo,
        usuario_nombre=r.usuario_nombre,
        observacion=r.observacion,
    )


def fetch_resumen(db: Session, f: ReportFilters, clase: str) -> ResumenPlacas:
    base = db.query(func.count(Imagen.id)).join(Prediccion, Prediccion.imagen_id == Imagen.id)
    base = f.apply_pred(base, imagen_joined=True)
    if clase != "todas":
        base = base.filter(Prediccion.clase_predicha == clase)
    total = base.scalar() or 0
    con = base.filter(_PLACA_PRESENTE).scalar() or 0
    return ResumenPlacas(
        total=total,
        con_placa=con,
        sin_placa=total - con,
        pct_completado=round(con / total * 100, 1) if total else 0.0,
    )


def _fetch_item(db: Session, imagen_id: int) -> Optional[VehiculoPlacaItem]:
    r = _base(db, None, "todas", prediccion_requerida=False).filter(Imagen.id == imagen_id).first()
    return _to_item(r) if r else None


# --- Rutas ---

@router.get("/vehiculos", response_model=VehiculosPlacaResponse)
async def listar_vehiculos(
    estado: str = Query("sin_placa", pattern=ESTADO_PATTERN),
    clase: str = Query("smog", pattern=CLASE_PATTERN),
    q: Optional[str] = Query(None, max_length=20),
    orden: str = Query("p_smog", pattern="^(p_smog|fecha)$"),
    page: int = Query(1, ge=1),
    size: int = Query(24, ge=1, le=100),
    f: ReportFilters = Depends(report_filters),
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
):
    """Vehículos para registrar placa. Por defecto: con smog y sin placa, mayor p_smog primero."""
    base = _aplicar_estado_q(_base(db, f, clase), estado, normalizar_placa(q))
    total = base.order_by(None).count()
    rows = base.order_by(*ORDEN[orden]).offset((page - 1) * size).limit(size).all()
    return VehiculosPlacaResponse(
        items=[_to_item(r) for r in rows],
        total=total,
        page=page,
        size=size,
        resumen=fetch_resumen(db, f, clase),
    )


@router.get("/vehiculos/{imagen_id}", response_model=VehiculoPlacaItem)
async def obtener_vehiculo(imagen_id: int, user: Usuario = Depends(_require), db: Session = Depends(get_db)):
    item = _fetch_item(db, imagen_id)
    if not item:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return item


@router.get("/filtros", response_model=FiltrosPlacasResponse)
async def opciones_filtro(user: Usuario = Depends(_require), db: Session = Depends(get_db)):
    """Zonas y dispositivos para los selectores (disponible para todos los roles)."""
    zonas = [
        OpcionFiltro(id=u.id, nombre=_nombre_corto_ubicacion(u.id, u.direccion))
        for u in db.query(Ubicacion.id, Ubicacion.direccion).order_by(Ubicacion.id).all()
    ]
    dispositivos = [
        OpcionFiltro(id=d.id, nombre=d.nombre_dispositivo)
        for d in db.query(DispositivoCaptura.id, DispositivoCaptura.nombre_dispositivo).order_by(DispositivoCaptura.id).all()
    ]
    return FiltrosPlacasResponse(zonas=zonas, dispositivos=dispositivos)


@router.put("/{imagen_id}", response_model=PlacaUpdateResponse)
async def actualizar_placa(
    imagen_id: int,
    body: PlacaBody,
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
):
    """Guarda la placa (normalizada). Enviar null o vacío la elimina."""
    imagen = db.query(Imagen).filter(Imagen.id == imagen_id).first()
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    placa = normalizar_placa(body.placa)
    if placa and len(placa) > PLACA_MAX:
        raise HTTPException(status_code=422, detail=f"La placa no puede superar {PLACA_MAX} caracteres")
    if placa and not re.fullmatch(r"[A-Z0-9]+", placa):
        raise HTTPException(status_code=422, detail="La placa solo puede contener letras y números")
    imagen.placa_manual = placa
    db.commit()
    item = _fetch_item(db, imagen_id)
    return PlacaUpdateResponse(**item.model_dump(), formato_valido=bool(placa and PLACA_RE.match(placa)))
