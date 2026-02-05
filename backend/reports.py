"""
Reports API: aggregated data for dashboards and charts.
All endpoints require authentication (get_current_user).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date, timedelta

from auth import get_current_user
from db import get_db, Usuario, Imagen, Prediccion, Ubicacion

router = APIRouter()

# --- Response models ---

class KPIsResponse(BaseModel):
    total_imagenes: int
    total_predicciones: int
    pct_smog: float
    confianza_promedio: float
    ubicaciones_activas: int
    usuarios_activos: int


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


class PorUsuarioItem(BaseModel):
    usuario_id: int
    nombre: str
    username: str
    total_imagenes: int
    total_predicciones: int


class TablaResumenRow(BaseModel):
    periodo: str
    total_predicciones: int
    total_smog: int
    pct_smog: float
    confianza_promedio: float
    p_smog_promedio: float


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


@router.get("/kpis", response_model=KPIsResponse)
async def get_kpis(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Totals and averages for KPI cards and gauge."""
    total_imagenes = db.query(func.count(Imagen.id)).scalar() or 0
    total_predicciones = db.query(func.count(Prediccion.id)).scalar() or 0

    smog_count = (
        db.query(func.count(Prediccion.id))
        .filter(Prediccion.clase_predicha == "smog")
        .scalar()
    ) or 0
    pct_smog = (smog_count / total_predicciones * 100.0) if total_predicciones else 0.0

    confianza_avg = (
        db.query(func.avg(Prediccion.confianza)).scalar()
    )
    confianza_promedio = float(confianza_avg) if confianza_avg is not None else 0.0

    ubicaciones_activas = (
        db.query(func.count(func.distinct(Imagen.ubicacion_id)))
        .filter(Imagen.ubicacion_id.isnot(None))
        .scalar()
    ) or 0

    usuarios_activos = (
        db.query(func.count(func.distinct(Imagen.usuario_id)))
        .filter(Imagen.usuario_id.isnot(None))
        .scalar()
    ) or 0

    return KPIsResponse(
        total_imagenes=total_imagenes,
        total_predicciones=total_predicciones,
        pct_smog=round(pct_smog, 2),
        confianza_promedio=round(confianza_promedio, 4),
        ubicaciones_activas=ubicaciones_activas,
        usuarios_activos=usuarios_activos,
    )


@router.get("/clase-predicha", response_model=List[ClasePredichaItem])
async def get_clase_predicha(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Counts by predicted class (smog / sin_smog) for pie and bar charts."""
    rows = (
        db.query(Prediccion.clase_predicha, func.count(Prediccion.id))
        .group_by(Prediccion.clase_predicha)
        .all()
    )
    return [
        ClasePredichaItem(clase=clase or "sin_clasificar", cantidad=count)
        for clase, count in rows
    ]


def _truncate_date(column, agrupar: str):
    if agrupar == "mes":
        return func.date_format(column, "%Y-%m")
    if agrupar == "semana":
        return func.date_format(column, "%Y-%u")  # year + week (0-53)
    # default: dia
    return func.date(column)


@router.get("/tendencia-predicciones", response_model=List[TendenciaItem])
async def get_tendencia_predicciones(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
    desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    agrupar: str = Query("dia", regex="^(dia|semana|mes)$"),
):
    """Time series of prediction counts (total, smog, sin_smog) for line/area charts."""
    col = _truncate_date(Prediccion.fecha_prediccion, agrupar)
    q = (
        db.query(
            col.label("periodo"),
            func.count(Prediccion.id).label("total"),
            func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0)).label("smog"),
            func.sum(case((Prediccion.clase_predicha != "smog", 1), else_=0)).label("sin_smog"),
        )
        .group_by(col)
        .order_by(col)
    )
    d = _parse_date(desde)
    h = _parse_date(hasta)
    if d is not None:
        q = q.filter(Prediccion.fecha_prediccion >= datetime.combine(d, datetime.min.time()))
    if h is not None:
        q = q.filter(Prediccion.fecha_prediccion < datetime.combine(h + timedelta(days=1), datetime.min.time()))
    rows = q.all()
    return [
        TendenciaItem(
            periodo=str(r.periodo),
            total=r.total or 0,
            smog=int(r.smog or 0),
            sin_smog=int(r.sin_smog or 0),
        )
        for r in rows
    ]


@router.get("/tendencia-imagenes", response_model=List[TendenciaItem])
async def get_tendencia_imagenes(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
    desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    agrupar: str = Query("dia", regex="^(dia|semana|mes)$"),
):
    """Time series of image upload counts (total only; smog/sin_smog = 0 for compatibility)."""
    col = _truncate_date(Imagen.fecha_subida, agrupar)
    q = (
        db.query(
            col.label("periodo"),
            func.count(Imagen.id).label("total"),
        )
        .group_by(col)
        .order_by(col)
    )
    d = _parse_date(desde)
    h = _parse_date(hasta)
    if d is not None:
        q = q.filter(Imagen.fecha_subida >= datetime.combine(d, datetime.min.time()))
    if h is not None:
        q = q.filter(Imagen.fecha_subida < datetime.combine(h + timedelta(days=1), datetime.min.time()))
    rows = q.all()
    return [
        TendenciaItem(periodo=str(r.periodo), total=r.total or 0, smog=0, sin_smog=0)
        for r in rows
    ]


BUCKETS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]


@router.get("/distribucion-confianza", response_model=List[HistogramBucket])
async def get_distribucion_confianza(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confidence distribution buckets for histogram."""
    result = []
    for low, high in BUCKETS:
        label = f"{low:.1f}-{high:.1f}" if high <= 1.0 else "0.8-1.0"
        count = (
            db.query(func.count(Prediccion.id))
            .filter(
                Prediccion.confianza >= low,
                Prediccion.confianza < high,
            )
            .scalar()
        ) or 0
        result.append(HistogramBucket(rango=label, cantidad=count))
    return result


@router.get("/distribucion-p-smog", response_model=List[HistogramBucket])
async def get_distribucion_p_smog(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """p_smog distribution buckets for histogram."""
    result = []
    for low, high in BUCKETS:
        label = f"{low:.1f}-{high:.1f}" if high <= 1.0 else "0.8-1.0"
        count = (
            db.query(func.count(Prediccion.id))
            .filter(
                Prediccion.p_smog >= low,
                Prediccion.p_smog < high,
            )
            .scalar()
        ) or 0
        result.append(HistogramBucket(rango=label, cantidad=count))
    return result


@router.get("/por-ubicacion", response_model=List[PorUbicacionItem])
async def get_por_ubicacion(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Counts and % smog per location for bar chart and map."""
    sub = (
        db.query(
            Imagen.ubicacion_id,
            func.count(Prediccion.id).label("total"),
            func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0)).label("smog"),
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .filter(Imagen.ubicacion_id.isnot(None))
        .group_by(Imagen.ubicacion_id)
        .subquery()
    )
    rows = (
        db.query(
            Ubicacion.id,
            Ubicacion.latitud,
            Ubicacion.longitud,
            sub.c.total,
            sub.c.smog,
        )
        .join(sub, Ubicacion.id == sub.c.ubicacion_id)
        .all()
    )
    return [
        PorUbicacionItem(
            ubicacion_id=r.id,
            nombre=None,
            latitud=float(r.latitud),
            longitud=float(r.longitud),
            total=r.total,
            smog=int(r.smog or 0),
            sin_smog=r.total - int(r.smog or 0),
            pct_smog=round(float(r.smog or 0) / float(r.total) * 100.0, 2) if r.total else 0.0,
        )
        for r in rows
    ]


@router.get("/por-usuario", response_model=List[PorUsuarioItem])
async def get_por_usuario(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Image and prediction counts per user for bar chart."""
    sub_img = (
        db.query(
            Imagen.usuario_id,
            func.count(Imagen.id).label("img_count"),
        )
        .filter(Imagen.usuario_id.isnot(None))
        .group_by(Imagen.usuario_id)
        .subquery()
    )
    sub_pred = (
        db.query(
            Imagen.usuario_id,
            func.count(Prediccion.id).label("pred_count"),
        )
        .join(Prediccion, Imagen.id == Prediccion.imagen_id)
        .filter(Imagen.usuario_id.isnot(None))
        .group_by(Imagen.usuario_id)
        .subquery()
    )
    rows = (
        db.query(
            Usuario.id,
            Usuario.nombre,
            Usuario.username,
            func.coalesce(sub_img.c.img_count, 0).label("img_count"),
            func.coalesce(sub_pred.c.pred_count, 0).label("pred_count"),
        )
        .outerjoin(sub_img, Usuario.id == sub_img.c.usuario_id)
        .outerjoin(sub_pred, Usuario.id == sub_pred.c.usuario_id)
        .all()
    )
    return [
        PorUsuarioItem(
            usuario_id=r.id,
            nombre=r.nombre,
            username=r.username,
            total_imagenes=int(r.img_count or 0),
            total_predicciones=int(r.pred_count or 0),
        )
        for r in rows
    ]


@router.get("/tabla-resumen", response_model=List[TablaResumenRow])
async def get_tabla_resumen(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
    desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    agrupar: str = Query("dia", regex="^(dia|semana|mes)$"),
):
    """Summary table by period (total, smog, %, avg confidence, avg p_smog)."""
    col = _truncate_date(Prediccion.fecha_prediccion, agrupar)
    q = (
        db.query(
            col.label("periodo"),
            func.count(Prediccion.id).label("total"),
            func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0)).label("smog"),
            func.avg(Prediccion.confianza).label("confianza"),
            func.avg(Prediccion.p_smog).label("p_smog"),
        )
        .group_by(col)
        .order_by(col)
    )
    d = _parse_date(desde)
    h = _parse_date(hasta)
    if d is not None:
        q = q.filter(Prediccion.fecha_prediccion >= datetime.combine(d, datetime.min.time()))
    if h is not None:
        q = q.filter(Prediccion.fecha_prediccion < datetime.combine(h + timedelta(days=1), datetime.min.time()))
    rows = q.all()
    return [
        TablaResumenRow(
            periodo=str(r.periodo),
            total_predicciones=int(r.total or 0),
            total_smog=int(r.smog or 0),
            pct_smog=round(float(r.smog or 0) / float(r.total or 1) * 100.0, 2),
            confianza_promedio=round(float(r.confianza or 0), 4),
            p_smog_promedio=round(float(r.p_smog or 0), 4),
        )
        for r in rows
    ]
