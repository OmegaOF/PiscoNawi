"""
Endpoints adicionales de reportes para el panel visual:
patrón horario, dispositivos, ciudades, galería, placas, dispersión,
comparativa de períodos y resumen ejecutivo.
Se monta con el mismo prefijo /api/reports.
"""
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import get_db, Usuario, Imagen, Prediccion, Ubicacion, Ciudad, DispositivoCaptura
from modules.roles.roles import require_roles
from modules.reportes.reports import (
    ROLES_REPORTES,
    SMOG_SUM,
    KPIsResponse,
    ReportFilters,
    _dialect_name,
    _hour_expr,
    _nombre_corto_ubicacion,
    _pct,
    _weekday_expr,
    compute_kpis,
    fetch_por_ubicacion,
    report_filters,
)
from modules.reportes.utils_reportes import nivel_smog

router = APIRouter()
_require = require_roles(ROLES_REPORTES)

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MIN_MUESTRA = 5  # mínimo de predicciones para declarar algo "crítico"
SCATTER_MAX = 2000
KPI_KEYS = [
    "total_imagenes",
    "total_predicciones",
    "pct_smog",
    "confianza_promedio",
    "ubicaciones_activas",
    "usuarios_activos",
]


# --- Modelos ---

class HeatmapCell(BaseModel):
    dia_semana: int
    hora: int
    total: int
    smog: int
    pct_smog: float


class PorDispositivoItem(BaseModel):
    dispositivo_id: int
    nombre_dispositivo: str
    tipo_dispositivo: Optional[str] = None
    activo: Optional[bool] = None
    total: int
    smog: int
    sin_smog: int
    pct_smog: float
    p_smog_promedio: float
    nivel: str


class PorCiudadItem(BaseModel):
    ciudad_id: int
    nombre: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    total: int
    smog: int
    sin_smog: int
    pct_smog: float
    nivel: str


class TopCapturaItem(BaseModel):
    imagen_id: int
    ruta_archivo: str
    placa_manual: Optional[str] = None
    p_smog: float
    confianza: float
    clase_predicha: str
    fecha_prediccion: Optional[str] = None
    ubicacion_id: Optional[int] = None
    ubicacion_nombre: Optional[str] = None


class PlacaReincidenteItem(BaseModel):
    placa: str
    total: int
    smog: int
    sin_smog: int
    pct_smog: float
    ultima_fecha: Optional[str] = None


class ScatterPoint(BaseModel):
    p_smog: float
    confianza: float
    clase: str


class PeriodoRango(BaseModel):
    desde: str
    hasta: str
    dias: int


class ComparativaResponse(BaseModel):
    periodo_actual: PeriodoRango
    periodo_anterior: PeriodoRango
    actual: KPIsResponse
    anterior: KPIsResponse
    delta_abs: Dict[str, float]
    delta_pct: Dict[str, Optional[float]]


class ResumenEjecutivoResponse(BaseModel):
    periodo: Dict[str, Optional[str]]
    kpis: KPIsResponse
    nivel_global: str
    comparativa: Optional[ComparativaResponse] = None
    zona_critica: Optional[dict] = None
    zona_mas_limpia: Optional[dict] = None
    hora_critica: Optional[dict] = None
    dia_critico: Optional[dict] = None
    dispositivo_mas_activo: Optional[dict] = None
    placa_reincidente: Optional[dict] = None


def _fmt_dt(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value[:19]
    return value.strftime("%Y-%m-%d %H:%M:%S")


# --- Fetchers ---

def fetch_heatmap(db: Session, f: ReportFilters) -> List[HeatmapCell]:
    d = _dialect_name(db)
    dow = _weekday_expr(Prediccion.fecha_prediccion, d)
    hr = _hour_expr(Prediccion.fecha_prediccion, d)
    q = db.query(
        dow.label("dia_semana"),
        hr.label("hora"),
        func.count(Prediccion.id).label("total"),
        SMOG_SUM.label("smog"),
    )
    rows = f.apply_pred(q).group_by(dow, hr).all()
    cells = {(i, h): [0, 0] for i in range(7) for h in range(24)}
    for r in rows:
        if r.dia_semana is None or r.hora is None:
            continue
        cells[(int(r.dia_semana), int(r.hora))] = [int(r.total), int(r.smog or 0)]
    return [
        HeatmapCell(dia_semana=i, hora=h, total=t, smog=s, pct_smog=_pct(s, t))
        for (i, h), (t, s) in sorted(cells.items())
    ]


def fetch_por_dispositivo(db: Session, f: ReportFilters) -> List[PorDispositivoItem]:
    sub_q = (
        db.query(
            Imagen.dispositivo_captura_id.label("dispositivo_id"),
            func.count(Prediccion.id).label("total"),
            SMOG_SUM.label("smog"),
            func.avg(Prediccion.p_smog).label("p_smog_prom"),
        )
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .filter(Imagen.dispositivo_captura_id.isnot(None))
    )
    sub = f.apply_pred(sub_q, imagen_joined=True).group_by(Imagen.dispositivo_captura_id).subquery()
    total_col = func.coalesce(sub.c.total, 0)
    q = db.query(
        DispositivoCaptura.id,
        DispositivoCaptura.nombre_dispositivo,
        DispositivoCaptura.tipo_dispositivo,
        DispositivoCaptura.activo,
        total_col.label("total"),
        func.coalesce(sub.c.smog, 0).label("smog"),
        sub.c.p_smog_prom,
    ).outerjoin(sub, sub.c.dispositivo_id == DispositivoCaptura.id)
    if f.dispositivo_id is not None:
        q = q.filter(DispositivoCaptura.id == f.dispositivo_id)
    out = []
    for r in q.order_by(total_col.desc(), DispositivoCaptura.id.asc()).all():
        total, smog = int(r.total or 0), int(r.smog or 0)
        pct = _pct(smog, total)
        out.append(
            PorDispositivoItem(
                dispositivo_id=r.id,
                nombre_dispositivo=r.nombre_dispositivo,
                tipo_dispositivo=r.tipo_dispositivo,
                activo=bool(r.activo) if r.activo is not None else None,
                total=total,
                smog=smog,
                sin_smog=total - smog,
                pct_smog=pct,
                p_smog_promedio=round(float(r.p_smog_prom or 0), 4),
                nivel=nivel_smog(pct, smog),
            )
        )
    return out


def fetch_por_ciudad(db: Session, f: ReportFilters) -> List[PorCiudadItem]:
    sub_q = (
        db.query(
            Ubicacion.ciudad_id.label("ciudad_id"),
            func.count(Prediccion.id).label("total"),
            SMOG_SUM.label("smog"),
        )
        .join(Imagen, Imagen.ubicacion_id == Ubicacion.id)
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .filter(Ubicacion.ciudad_id.isnot(None))
    )
    sub = f.apply_pred(sub_q, imagen_joined=True).group_by(Ubicacion.ciudad_id).subquery()
    rows = (
        db.query(Ciudad.id, Ciudad.nombre, Ciudad.latitud, Ciudad.longitud, sub.c.total, sub.c.smog)
        .join(sub, sub.c.ciudad_id == Ciudad.id)
        .order_by(sub.c.total.desc())
        .all()
    )
    out = []
    for r in rows:
        total, smog = int(r.total or 0), int(r.smog or 0)
        pct = _pct(smog, total)
        out.append(
            PorCiudadItem(
                ciudad_id=r.id,
                nombre=r.nombre,
                latitud=float(r.latitud) if r.latitud is not None else None,
                longitud=float(r.longitud) if r.longitud is not None else None,
                total=total,
                smog=smog,
                sin_smog=total - smog,
                pct_smog=pct,
                nivel=nivel_smog(pct, smog),
            )
        )
    return out


ORDEN_TOP = {
    "p_smog": Prediccion.p_smog.desc(),
    "confianza": Prediccion.confianza.desc(),
    "fecha": Prediccion.fecha_prediccion.desc(),
}


def fetch_top_capturas(
    db: Session, f: ReportFilters, limit: int = 12, orden: str = "p_smog", clase: Optional[str] = None, solo_url: bool = True
) -> List[TopCapturaItem]:
    q = (
        db.query(
            Imagen.id,
            Imagen.ruta_archivo,
            Imagen.placa_manual,
            Imagen.ubicacion_id,
            Ubicacion.direccion,
            Prediccion.p_smog,
            Prediccion.confianza,
            Prediccion.clase_predicha,
            Prediccion.fecha_prediccion,
        )
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .outerjoin(Ubicacion, Ubicacion.id == Imagen.ubicacion_id)
    )
    q = f.apply_pred(q, imagen_joined=True)
    if clase:
        q = q.filter(Prediccion.clase_predicha == clase)
    if solo_url:
        q = q.filter(Imagen.ruta_archivo.like("http%"))
    rows = q.order_by(ORDEN_TOP.get(orden, ORDEN_TOP["p_smog"]), Prediccion.id.desc()).limit(min(max(limit, 1), 100)).all()
    return [
        TopCapturaItem(
            imagen_id=r.id,
            ruta_archivo=r.ruta_archivo,
            placa_manual=r.placa_manual,
            p_smog=round(float(r.p_smog or 0), 4),
            confianza=round(float(r.confianza or 0), 4),
            clase_predicha=r.clase_predicha,
            fecha_prediccion=_fmt_dt(r.fecha_prediccion),
            ubicacion_id=r.ubicacion_id,
            ubicacion_nombre=_nombre_corto_ubicacion(r.ubicacion_id, r.direccion) if r.ubicacion_id else None,
        )
        for r in rows
    ]


def fetch_placas_reincidentes(db: Session, f: ReportFilters, limit: int = 10, min_total: int = 2) -> List[PlacaReincidenteItem]:
    placa = func.upper(func.trim(Imagen.placa_manual))
    total_expr = func.count(Prediccion.id)
    q = (
        db.query(
            placa.label("placa"),
            total_expr.label("total"),
            SMOG_SUM.label("smog"),
            func.max(Prediccion.fecha_prediccion).label("ultima_fecha"),
        )
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .filter(Imagen.placa_manual.isnot(None), func.trim(Imagen.placa_manual) != "")
    )
    q = f.apply_pred(q, imagen_joined=True).group_by(placa).having(total_expr >= min_total)
    rows = q.order_by(SMOG_SUM.desc(), total_expr.desc()).limit(min(max(limit, 1), 100)).all()
    out = []
    for r in rows:
        total, smog = int(r.total or 0), int(r.smog or 0)
        out.append(
            PlacaReincidenteItem(
                placa=r.placa,
                total=total,
                smog=smog,
                sin_smog=total - smog,
                pct_smog=_pct(smog, total),
                ultima_fecha=_fmt_dt(r.ultima_fecha),
            )
        )
    return out


def fetch_scatter(db: Session, f: ReportFilters, limit: int = SCATTER_MAX) -> List[ScatterPoint]:
    q = db.query(Prediccion.p_smog, Prediccion.confianza, Prediccion.clase_predicha)
    rows = f.apply_pred(q).order_by(Prediccion.id.desc()).limit(min(max(limit, 1), SCATTER_MAX)).all()
    return [
        ScatterPoint(p_smog=round(float(p or 0), 4), confianza=round(float(c or 0), 4), clase=k or "sin_clasificar")
        for p, c, k in rows
    ]


def fetch_comparativa(db: Session, f: ReportFilters) -> ComparativaResponse:
    hasta = f.hasta or date.today()
    desde = f.desde or (hasta - timedelta(days=29))
    n = (hasta - desde).days + 1
    f_act = f.with_dates(desde, hasta)
    f_ant = f.with_dates(desde - timedelta(days=n), desde - timedelta(days=1))
    actual, anterior = compute_kpis(db, f_act), compute_kpis(db, f_ant)
    delta_abs = {k: round(getattr(actual, k) - getattr(anterior, k), 4) for k in KPI_KEYS}
    delta_pct = {
        k: (round((getattr(actual, k) - getattr(anterior, k)) / getattr(anterior, k) * 100, 2) if getattr(anterior, k) else None)
        for k in KPI_KEYS
    }
    return ComparativaResponse(
        periodo_actual=PeriodoRango(desde=desde.isoformat(), hasta=hasta.isoformat(), dias=n),
        periodo_anterior=PeriodoRango(desde=f_ant.desde.isoformat(), hasta=f_ant.hasta.isoformat(), dias=n),
        actual=actual,
        anterior=anterior,
        delta_abs=delta_abs,
        delta_pct=delta_pct,
    )


def _agregar(cells: List[HeatmapCell], key: str) -> Dict[int, List[int]]:
    acc: Dict[int, List[int]] = {}
    for c in cells:
        k = getattr(c, key)
        acc.setdefault(k, [0, 0])
        acc[k][0] += c.total
        acc[k][1] += c.smog
    return acc


def fetch_resumen_ejecutivo(db: Session, f: ReportFilters) -> ResumenEjecutivoResponse:
    kpis = compute_kpis(db, f)
    zonas = [z for z in fetch_por_ubicacion(db, f) if z.total >= MIN_MUESTRA]
    heat = fetch_heatmap(db, f)
    disp = [d for d in fetch_por_dispositivo(db, f) if d.total > 0]
    placas = fetch_placas_reincidentes(db, f, limit=1, min_total=2)

    def _zona(z):
        return {"ubicacion_id": z.ubicacion_id, "nombre": z.etiqueta, "pct_smog": z.pct_smog, "total": z.total, "nivel": z.nivel}

    def _critico(acc: Dict[int, List[int]]):
        candidatos = [(k, t, s) for k, (t, s) in acc.items() if t >= MIN_MUESTRA]
        if not candidatos:
            return None
        return max(candidatos, key=lambda x: (_pct(x[2], x[1]), x[1]))

    hora = _critico(_agregar(heat, "hora"))
    dia = _critico(_agregar(heat, "dia_semana"))
    return ResumenEjecutivoResponse(
        periodo={
            "desde": f.desde.isoformat() if f.desde else None,
            "hasta": f.hasta.isoformat() if f.hasta else None,
        },
        kpis=kpis,
        nivel_global=nivel_smog(kpis.pct_smog, kpis.total_smog),
        comparativa=fetch_comparativa(db, f) if (f.desde and f.hasta) else None,
        zona_critica=_zona(max(zonas, key=lambda z: z.pct_smog)) if zonas else None,
        zona_mas_limpia=_zona(min(zonas, key=lambda z: z.pct_smog)) if zonas else None,
        hora_critica={"hora": hora[0], "total": hora[1], "smog": hora[2], "pct_smog": _pct(hora[2], hora[1])} if hora else None,
        dia_critico={
            "dia_semana": dia[0],
            "nombre": DIAS_SEMANA[dia[0]],
            "total": dia[1],
            "smog": dia[2],
            "pct_smog": _pct(dia[2], dia[1]),
        } if dia else None,
        dispositivo_mas_activo={
            "dispositivo_id": disp[0].dispositivo_id,
            "nombre": disp[0].nombre_dispositivo,
            "total": disp[0].total,
            "pct_smog": disp[0].pct_smog,
        } if disp else None,
        placa_reincidente=placas[0].model_dump() if placas else None,
    )


# --- Rutas ---

@router.get("/heatmap-horas", response_model=List[HeatmapCell])
async def get_heatmap_horas(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Matriz día de la semana (0=lunes) × hora con % de smog."""
    return fetch_heatmap(db, f)


@router.get("/por-dispositivo", response_model=List[PorDispositivoItem])
async def get_por_dispositivo(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Totales y % de smog por dispositivo de captura (incluye inactivos)."""
    return fetch_por_dispositivo(db, f)


@router.get("/por-ciudad", response_model=List[PorCiudadItem])
async def get_por_ciudad(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Totales y % de smog por ciudad."""
    return fetch_por_ciudad(db, f)


@router.get("/top-capturas", response_model=List[TopCapturaItem])
async def get_top_capturas(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    limit: int = Query(12, ge=1, le=100),
    orden: str = Query("p_smog", pattern="^(p_smog|confianza|fecha)$"),
    clase: Optional[str] = Query(None, pattern="^(smog|sin_smog)$"),
    solo_url: bool = Query(True),
):
    """Capturas con mayor probabilidad de smog (galería)."""
    return fetch_top_capturas(db, f, limit, orden, clase, solo_url)


@router.get("/placas-reincidentes", response_model=List[PlacaReincidenteItem])
async def get_placas_reincidentes(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    limit: int = Query(10, ge=1, le=100),
    min_total: int = Query(2, ge=1),
):
    """Placas detectadas varias veces, ordenadas por cantidad de detecciones con smog."""
    return fetch_placas_reincidentes(db, f, limit, min_total)


@router.get("/scatter-confianza", response_model=List[ScatterPoint])
async def get_scatter_confianza(
    user: Usuario = Depends(_require),
    db: Session = Depends(get_db),
    f: ReportFilters = Depends(report_filters),
    limit: int = Query(SCATTER_MAX, ge=1, le=SCATTER_MAX),
):
    """Puntos p_smog × confianza para gráfico de dispersión."""
    return fetch_scatter(db, f, limit)


@router.get("/comparativa-periodos", response_model=ComparativaResponse)
async def get_comparativa_periodos(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """KPIs del período actual frente al período anterior de igual duración."""
    return fetch_comparativa(db, f)


@router.get("/resumen-ejecutivo", response_model=ResumenEjecutivoResponse)
async def get_resumen_ejecutivo(user: Usuario = Depends(_require), db: Session = Depends(get_db), f: ReportFilters = Depends(report_filters)):
    """Resumen ejecutivo: KPIs, nivel global, zona/hora/día críticos."""
    return fetch_resumen_ejecutivo(db, f)
