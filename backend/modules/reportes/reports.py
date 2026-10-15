"""
API de reportes: datos agregados para paneles y gráficos.
Todos los endpoints requieren autenticación y rol de analista, administrador o constructor.

Cada endpoint se divide en:
  - una función pura ``fetch_*`` / ``compute_*`` (reutilizable por los PDF y por reports_extra)
  - una ruta delgada que resuelve dependencias.
"""
from dataclasses import dataclass, replace
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, case, select, cast, Integer
from sqlalchemy.orm import Session

from db import get_db, Usuario, Imagen, Prediccion, Ubicacion, Ciudad
from modules.roles.roles import require_roles, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV
from modules.reportes.utils_reportes import nivel_smog


router = APIRouter()

ROLES_REPORTES = [ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]
AGRUPAR_PATTERN = "^(dia|semana|mes)$"


# --- Modelos de respuesta ---

class KPIsResponse(BaseModel):
    total_imagenes: int
    total_predicciones: int
    pct_smog: float
    confianza_promedio: float
    ubicaciones_activas: int
    usuarios_activos: int
    total_smog: int = 0


class ClasePredichaItem(BaseModel):
    clase: str
    cantidad: int


class TendenciaItem(BaseModel):
    periodo: str
    total: int
    smog: int
    sin_smog: int


class HistogramBucket(BaseModel):
    rango: str
    cantidad: int


class PorUbicacionItem(BaseModel):
    ubicacion_id: int
    nombre: Optional[str]
    latitud: float
    longitud: float
    total: int
    smog: int
    sin_smog: int
    pct_smog: float
    etiqueta: Optional[str] = None
    direccion: Optional[str] = None
    departamento: Optional[str] = None
    ciudad_id: Optional[int] = None
    ciudad: Optional[str] = None
    nivel: str = "Sin smog"


class PorUsuarioItem(BaseModel):
    usuario_id: int
    nombre: str
    username: str
    total_imagenes: int
    total_predicciones: int
    smog: int = 0
    sin_smog: int = 0
    pct_smog: float = 0.0


class TablaResumenRow(BaseModel):
    periodo: str
    total_predicciones: int
    total_smog: int
    pct_smog: float
    confianza_promedio: float


# --- Filtros compartidos ---

def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


@dataclass
class ReportFilters:
    desde: Optional[date] = None
    hasta: Optional[date] = None
    dt_from: Optional[datetime] = None  # inclusivo
    dt_to: Optional[datetime] = None    # exclusivo (hasta + 1 día)
    ubicacion_id: Optional[int] = None
    dispositivo_id: Optional[int] = None
    usuario_id: Optional[int] = None

    def with_dates(self, desde: Optional[date], hasta: Optional[date]) -> "ReportFilters":
        return replace(
            self,
            desde=desde,
            hasta=hasta,
            dt_from=datetime.combine(desde, datetime.min.time()) if desde else None,
            dt_to=datetime.combine(hasta + timedelta(days=1), datetime.min.time()) if hasta else None,
        )

    def _imagen_conds(self):
        conds = []
        if self.ubicacion_id is not None:
            conds.append(Imagen.ubicacion_id == self.ubicacion_id)
        if self.dispositivo_id is not None:
            conds.append(Imagen.dispositivo_captura_id == self.dispositivo_id)
        if self.usuario_id is not None:
            conds.append(Imagen.usuario_id == self.usuario_id)
        return conds

    def apply_pred(self, q, imagen_joined: bool = False):
        """Para consultas cuyo FROM principal es Prediccion."""
        if self.dt_from is not None:
            q = q.filter(Prediccion.fecha_prediccion >= self.dt_from)
        if self.dt_to is not None:
            q = q.filter(Prediccion.fecha_prediccion < self.dt_to)
        conds = self._imagen_conds()
        if conds:
            if imagen_joined:
                q = q.filter(*conds)
            else:
                q = q.filter(Prediccion.imagen_id.in_(select(Imagen.id).where(*conds).correlate(None)))
        return q

    def apply_img(self, q):
        """Para consultas cuyo FROM principal es Imagen (sin Prediccion)."""
        if self.dt_from is not None:
            q = q.filter(Imagen.fecha_subida >= self.dt_from)
        if self.dt_to is not None:
            q = q.filter(Imagen.fecha_subida < self.dt_to)
        conds = self._imagen_conds()
        return q.filter(*conds) if conds else q


def build_filters(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    ubicacion_id: Optional[int] = None,
    dispositivo_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
) -> ReportFilters:
    return ReportFilters(
        ubicacion_id=ubicacion_id, dispositivo_id=dispositivo_id, usuario_id=usuario_id
    ).with_dates(_parse_date(desde), _parse_date(hasta))


def report_filters(
    desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    ubicacion_id: Optional[int] = Query(None),
    dispositivo_id: Optional[int] = Query(None),
    usuario_id: Optional[int] = Query(None),
) -> ReportFilters:
    return build_filters(desde, hasta, ubicacion_id, dispositivo_id, usuario_id)


# --- Helpers por motor (MySQL en producción, sqlite en tests) ---

def _dialect_name(db: Session) -> str:
    try:
        return db.get_bind().dialect.name
    except Exception:
        return "mysql"


def _truncate_date(column, agrupar: str, dialect: str = "mysql"):
    if dialect == "sqlite":
        if agrupar == "mes":
            return func.strftime("%Y-%m", column)
        if agrupar == "semana":
            return func.strftime("%Y-%W", column)
        return func.date(column)
    if agrupar == "mes":
        return func.date_format(column, "%Y-%m")
    if agrupar == "semana":
        return func.date_format(column, "%Y-%u")  # año + semana (0-53)
    return func.date(column)


def _weekday_expr(column, dialect: str):
    """0 = lunes ... 6 = domingo en ambos motores."""
    if dialect == "sqlite":
        return (cast(func.strftime("%w", column), Integer) + 6) % 7
    return func.weekday(column)


def _hour_expr(column, dialect: str):
    if dialect == "sqlite":
        return cast(func.strftime("%H", column), Integer)
    return func.hour(column)


def _nombre_corto_ubicacion(ubicacion_id: int, direccion: Optional[str]) -> str:
    if direccion:
        corto = direccion.split(",")[0].strip()[:40]
        return corto or f"U{ubicacion_id}"
    return f"U{ubicacion_id}"


def _pct(part, total) -> float:
    return round(float(part or 0) / float(total) * 100.0, 2) if total else 0.0


SMOG_SUM = func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0))


# --- Fetchers puros ---

def compute_kpis(db: Session, f: ReportFilters) -> KPIsResponse:
    total_imagenes = f.apply_img(db.query(func.count(Imagen.id))).scalar() or 0
    total_predicciones = f.apply_pred(db.query(func.count(Prediccion.id))).scalar() or 0
    smog_count = (
        f.apply_pred(db.query(func.count(Prediccion.id)).filter(Prediccion.clase_predicha == "smog")).scalar() or 0
    )
    confianza_avg = f.apply_pred(db.query(func.avg(Prediccion.confianza))).scalar()
    ubicaciones_activas = (
        f.apply_img(db.query(func.count(func.distinct(Imagen.ubicacion_id))).filter(Imagen.ubicacion_id.isnot(None)))
        .scalar() or 0
    )
    usuarios_activos = (
        f.apply_img(db.query(func.count(func.distinct(Imagen.usuario_id))).filter(Imagen.usuario_id.isnot(None)))
        .scalar() or 0
    )
    return KPIsResponse(
        total_imagenes=total_imagenes,
        total_predicciones=total_predicciones,
        pct_smog=_pct(smog_count, total_predicciones),
        confianza_promedio=round(float(confianza_avg), 4) if confianza_avg is not None else 0.0,
        ubicaciones_activas=ubicaciones_activas,
        usuarios_activos=usuarios_activos,
        total_smog=int(smog_count),
    )


def fetch_clase_predicha(db: Session, f: ReportFilters) -> List[ClasePredichaItem]:
    q = db.query(Prediccion.clase_predicha, func.count(Prediccion.id))
    rows = f.apply_pred(q).group_by(Prediccion.clase_predicha).all()
    return [ClasePredichaItem(clase=clase or "sin_clasificar", cantidad=count) for clase, count in rows]


def fetch_tendencia_data(db: Session, f: ReportFilters, agrupar: str = "dia") -> List[TendenciaItem]:
    col = _truncate_date(Prediccion.fecha_prediccion, agrupar, _dialect_name(db))
    q = db.query(
        col.label("periodo"),
        func.count(Prediccion.id).label("total"),
        SMOG_SUM.label("smog"),
    )
    rows = f.apply_pred(q).group_by(col).order_by(col).all()
    return [
        TendenciaItem(
            periodo=str(r.periodo),
            total=int(r.total or 0),
            smog=int(r.smog or 0),
            sin_smog=int(r.total or 0) - int(r.smog or 0),
        )
        for r in rows
    ]


def fetch_tendencia_imagenes(db: Session, f: ReportFilters, agrupar: str = "dia") -> List[TendenciaItem]:
    col = _truncate_date(Imagen.fecha_subida, agrupar, _dialect_name(db))
    q = db.query(col.label("periodo"), func.count(Imagen.id).label("total"))
    rows = f.apply_img(q).group_by(col).order_by(col).all()
    return [TendenciaItem(periodo=str(r.periodo), total=int(r.total or 0), smog=0, sin_smog=0) for r in rows]


BUCKETS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]


def fetch_distribucion(db: Session, f: ReportFilters, column) -> List[HistogramBucket]:
    result = []
    for low, high in BUCKETS:
        label = f"{low:.1f}-{high:.1f}" if high <= 1.0 else "0.8-1.0"
        q = db.query(func.count(Prediccion.id)).filter(column >= low, column < high)
        result.append(HistogramBucket(rango=label, cantidad=f.apply_pred(q).scalar() or 0))
    return result


def fetch_tabla_resumen_data(
    db: Session,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    agrupar: str = "dia",
    filters: Optional[ReportFilters] = None,
) -> List[TablaResumenRow]:
    """Consulta reutilizable (también la usan los PDF) para la tabla por período."""
    f = filters or build_filters(desde, hasta)
    col = _truncate_date(Prediccion.fecha_prediccion, agrupar, _dialect_name(db))
    q = db.query(
        col.label("periodo"),
        func.count(Prediccion.id).label("total"),
        SMOG_SUM.label("smog"),
        func.avg(Prediccion.confianza).label("confianza"),
    )
    rows = f.apply_pred(q).group_by(col).order_by(col).all()
    return [
        TablaResumenRow(
            periodo=str(r.periodo),
            total_predicciones=int(r.total or 0),
            total_smog=int(r.smog or 0),
            pct_smog=_pct(r.smog, r.total or 1),
            confianza_promedio=round(float(r.confianza or 0), 4),
        )
        for r in rows
    ]


def fetch_por_ubicacion(db: Session, f: ReportFilters) -> List[PorUbicacionItem]:
    q_sub = (
        db.query(
            Imagen.ubicacion_id.label("ubicacion_id"),
            func.count(Prediccion.id).label("total"),
            SMOG_SUM.label("smog"),
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .filter(Imagen.ubicacion_id.isnot(None))
    )
    sub = f.apply_pred(q_sub, imagen_joined=True).group_by(Imagen.ubicacion_id).subquery()
    rows = (
        db.query(
            Ubicacion.id,
            Ubicacion.latitud,
            Ubicacion.longitud,
            Ubicacion.direccion,
            Ubicacion.departamento,
            Ubicacion.ciudad_id,
            Ciudad.nombre.label("ciudad"),
            sub.c.total,
            sub.c.smog,
        )
        .join(sub, Ubicacion.id == sub.c.ubicacion_id)
        .outerjoin(Ciudad, Ciudad.id == Ubicacion.ciudad_id)
        .order_by(sub.c.total.desc(), Ubicacion.id.asc())
        .all()
    )
    out = []
    for r in rows:
        total = int(r.total or 0)
        smog = int(r.smog or 0)
        pct = _pct(smog, total)
        out.append(
            PorUbicacionItem(
                ubicacion_id=r.id,
                nombre=f"U{r.id}",
                latitud=float(r.latitud),
                longitud=float(r.longitud),
                total=total,
                smog=smog,
                sin_smog=total - smog,
                pct_smog=pct,
                etiqueta=_nombre_corto_ubicacion(r.id, r.direccion),
                direccion=r.direccion,
                departamento=r.departamento,
                ciudad_id=r.ciudad_id,
                ciudad=r.ciudad,
                nivel=nivel_smog(pct, smog),
            )
        )
    return out


def fetch_por_usuario(db: Session, f: ReportFilters) -> List[PorUsuarioItem]:
    q_sub_img = db.query(Imagen.usuario_id, func.count(Imagen.id).label("img_count")).filter(Imagen.usuario_id.isnot(None))
    q_sub_pred = (
        db.query(
            Imagen.usuario_id,
            func.count(Prediccion.id).label("pred_count"),
            SMOG_SUM.label("smog_count"),
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .filter(Imagen.usuario_id.isnot(None))
    )
    sub_img = f.apply_img(q_sub_img).group_by(Imagen.usuario_id).subquery()
    sub_pred = f.apply_pred(q_sub_pred, imagen_joined=True).group_by(Imagen.usuario_id).subquery()

    q = (
        db.query(
            Usuario.id,
            Usuario.nombre,
            Usuario.username,
            func.coalesce(sub_img.c.img_count, 0).label("img_count"),
            func.coalesce(sub_pred.c.pred_count, 0).label("pred_count"),
            func.coalesce(sub_pred.c.smog_count, 0).label("smog_count"),
        )
        .outerjoin(sub_img, Usuario.id == sub_img.c.usuario_id)
        .outerjoin(sub_pred, Usuario.id == sub_pred.c.usuario_id)
    )
    if f.usuario_id is not None:
        q = q.filter(Usuario.id == f.usuario_id)
    out = []
    for r in q.all():
        pred = int(r.pred_count or 0)
        smog = int(r.smog_count or 0)
        out.append(
            PorUsuarioItem(
                usuario_id=r.id,
                nombre=r.nombre,
                username=r.username,
                total_imagenes=int(r.img_count or 0),
                total_predicciones=pred,
                smog=smog,
                sin_smog=pred - smog,
                pct_smog=_pct(smog, pred),
            )
        )
    return out


# --- Rutas ---

_require = require_roles(ROLES_REPORTES)


@router.get("/kpis", response_model=KPIsResponse)
async def get_kpis(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Totales y promedios para tarjetas KPI y medidor."""
    return compute_kpis(db, f)


@router.get("/clase-predicha", response_model=List[ClasePredichaItem])
async def get_clase_predicha(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Cantidad por clase predicha (smog / sin_smog)."""
    return fetch_clase_predicha(db, f)


@router.get("/tendencia-predicciones", response_model=List[TendenciaItem])
async def get_tendencia_predicciones(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    agrupar: str = Query("dia", pattern=AGRUPAR_PATTERN),
):
    """Serie temporal de predicciones (total, smog, sin_smog)."""
    return fetch_tendencia_data(db, f, agrupar)


@router.get("/tendencia-imagenes", response_model=List[TendenciaItem])
async def get_tendencia_imagenes(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    agrupar: str = Query("dia", pattern=AGRUPAR_PATTERN),
):
    """Serie temporal de imágenes subidas."""
    return fetch_tendencia_imagenes(db, f, agrupar)


@router.get("/distribucion-confianza", response_model=List[HistogramBucket])
async def get_distribucion_confianza(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Histograma de confianza en 5 rangos."""
    return fetch_distribucion(db, f, Prediccion.confianza)


@router.get("/por-ubicacion", response_model=List[PorUbicacionItem])
async def get_por_ubicacion(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Totales, % de smog y nivel por ubicación (para mapa y ranking)."""
    return fetch_por_ubicacion(db, f)


@router.get("/por-usuario", response_model=List[PorUsuarioItem])
async def get_por_usuario(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Imágenes, predicciones y % de smog por usuario."""
    return fetch_por_usuario(db, f)


@router.get("/tabla-resumen", response_model=List[TablaResumenRow])
async def get_tabla_resumen(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    agrupar: str = Query("dia", pattern=AGRUPAR_PATTERN),
):
    """Tabla resumen por período."""
    return fetch_tabla_resumen_data(db, agrupar=agrupar, filters=f)
