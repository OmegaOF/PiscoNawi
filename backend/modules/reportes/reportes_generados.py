import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import ReporteGenerado, Usuario, get_db
from modules.roles.roles import ROLE_ADMIN, ROLE_ANALISTA, ROLE_DEV, get_user_roles, require_roles
from modules.reportes.reporte_detallado import generar_reporte_detallado_pdf
from modules.reportes.reporte_comparacion import generar_reporte_comparacion_pdf
from modules.reportes.reporte_cambios_tiempo import generar_reporte_cambios_tiempo_pdf
from modules.reportes.reporte_por_zonas import generar_reporte_por_zonas_pdf
from modules.reportes.reporte_general import generar_reporte_general_pdf


router = APIRouter()

TIPO_REPORTE_GENERAL = "reporte_general"
TIPO_REPORTE_CAMBIOS_TIEMPO = "cambios_tiempo"
TIPO_REPORTE_COMPARACION = "comparacion"
TIPO_REPORTE_POR_ZONAS = "por_zonas"
TIPO_REPORTE_DETALLADO = "detallado"
REPORTES_SOPORTADOS = {
    TIPO_REPORTE_GENERAL,
    TIPO_REPORTE_CAMBIOS_TIEMPO,
    TIPO_REPORTE_COMPARACION,
    TIPO_REPORTE_POR_ZONAS,
    TIPO_REPORTE_DETALLADO,
}

BASE_DIR = Path(__file__).resolve().parents[3]
REPORTS_STORAGE_DIR = BASE_DIR / "storage" / "reports"


class ExportarPDFPayload(BaseModel):
    tipo_reporte: str
    desde: Optional[str] = None
    hasta: Optional[str] = None
    agrupar: str = "dia"


TIPO_REPORTE_LABELS = {
    TIPO_REPORTE_GENERAL: "Reporte general",
    TIPO_REPORTE_CAMBIOS_TIEMPO: "Cambios en el tiempo",
    TIPO_REPORTE_COMPARACION: "Comparación smog / sin smog",
    TIPO_REPORTE_POR_ZONAS: "Reporte por zonas",
    TIPO_REPORTE_DETALLADO: "Reporte detallado por período",
    "tabla_resumen": "Tabla resumen (antiguo)",
    "desconocido": "Desconocido",
}
_FILENAME_RE = re.compile(r"^(?P<tipo>[a-z_]+?)_(?P<uid>\d+)_(?P<ts>\d{8}_\d{6})_(?P<hash>[0-9a-f]{8})\.pdf$")


class ReporteGeneradoResponse(BaseModel):
    id: int
    nombre_reporte: str
    fecha_generado: Optional[str]
    usuario_id: Optional[int] = None
    ruta_archivo: Optional[str] = None
    usuario_nombre: Optional[str] = None
    usuario_username: Optional[str] = None
    tipo_reporte: str = "desconocido"
    tipo_reporte_label: str = "Desconocido"
    existe_archivo: bool = False
    tamano_bytes: Optional[int] = None
    desde: Optional[str] = None
    hasta: Optional[str] = None
    agrupar: Optional[str] = None
    total_registros: Optional[int] = None
    parametros: Optional[dict] = None


def _inferir_tipo(row) -> str:
    if row.nombre_reporte in REPORTES_SOPORTADOS:
        return row.nombre_reporte
    m = _FILENAME_RE.match(Path(row.ruta_archivo or "").name)
    return m.group("tipo") if m else "desconocido"


def _archivo_info(row):
    if not row.ruta_archivo:
        return False, None
    p = BASE_DIR / row.ruta_archivo
    if p.is_file():
        return True, p.stat().st_size
    return False, None


def _to_response(row, usuario: Optional[Usuario]) -> ReporteGeneradoResponse:
    params = {}
    raw = getattr(row, "parametros_json", None)
    if raw:
        try:
            params = json.loads(raw) or {}
        except (ValueError, TypeError):
            params = {}
    existe, tam = _archivo_info(row)
    tipo = _inferir_tipo(row)
    return ReporteGeneradoResponse(
        id=row.id,
        nombre_reporte=row.nombre_reporte,
        fecha_generado=row.fecha_generado.isoformat() if row.fecha_generado else None,
        usuario_id=row.usuario_id,
        ruta_archivo=row.ruta_archivo,
        usuario_nombre=usuario.nombre if usuario else None,
        usuario_username=usuario.username if usuario else None,
        tipo_reporte=tipo,
        tipo_reporte_label=TIPO_REPORTE_LABELS.get(tipo, tipo),
        existe_archivo=existe,
        tamano_bytes=tam,
        desde=params.get("desde"),
        hasta=params.get("hasta"),
        agrupar=params.get("agrupar"),
        total_registros=params.get("total_registros"),
        parametros=params or None,
    )

class ExportarPDFResponse(BaseModel):
    reporte_generado: ReporteGeneradoResponse
    total_registros_exportados: int


def _resolve_access_scope(db: Session, user_id: int) -> str:
    roles = get_user_roles(db, user_id)
    if ROLE_ADMIN in roles or ROLE_DEV in roles:
        return "all"
    if ROLE_ANALISTA in roles:
        return "own"
    raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")


def _build_report_filename(tipo_reporte: str, usuario_id: int) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"{tipo_reporte}_{usuario_id}_{timestamp}_{uuid4().hex[:8]}.pdf"




async def _render_pdf_by_tipo(
    tipo_reporte: str,
    file_path: Path,
    payload: ExportarPDFPayload,
    db: Session,
    user: Usuario,
) -> int:
    """Dispatcher base para renderizado de PDFs por tipo de reporte."""

    if tipo_reporte == TIPO_REPORTE_DETALLADO:
        return generar_reporte_detallado_pdf(file_path, db, payload, user.nombre)
    if tipo_reporte == TIPO_REPORTE_COMPARACION:
        return generar_reporte_comparacion_pdf(file_path, db, payload, user.nombre)
    if tipo_reporte == TIPO_REPORTE_CAMBIOS_TIEMPO:
        return await generar_reporte_cambios_tiempo_pdf(file_path, db, payload, user.nombre, user)
    if tipo_reporte == TIPO_REPORTE_POR_ZONAS:
        return generar_reporte_por_zonas_pdf(file_path, db, payload, user.nombre)
    if tipo_reporte == TIPO_REPORTE_GENERAL:
        return await generar_reporte_general_pdf(file_path, db, payload, user.nombre, user)
    raise HTTPException(status_code=400, detail="Tipo de reporte no soportado")


@router.post("/exportar-pdf", response_model=ExportarPDFResponse)
async def exportar_reporte_pdf(
    payload: ExportarPDFPayload,
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    if payload.tipo_reporte not in REPORTES_SOPORTADOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de reporte no soportado. Disponibles: {', '.join(sorted(REPORTES_SOPORTADOS))}",
        )

    REPORTS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = _build_report_filename(payload.tipo_reporte, user.id)
    absolute_path = REPORTS_STORAGE_DIR / filename
    relative_path = str(Path("storage") / "reports" / filename)

    total_exportados = await _render_pdf_by_tipo(payload.tipo_reporte, absolute_path, payload, db, user)
    report_row = ReporteGenerado(
        nombre_reporte=payload.tipo_reporte,
        fecha_generado=datetime.utcnow(),
        usuario_id=user.id,
        ruta_archivo=relative_path,
        parametros_json=json.dumps({
            "tipo_reporte": payload.tipo_reporte,
            "desde": payload.desde,
            "hasta": payload.hasta,
            "agrupar": payload.agrupar,
            "total_registros": total_exportados,
        }),
    )
    db.add(report_row)
    db.commit()
    db.refresh(report_row)

    return ExportarPDFResponse(
        reporte_generado=_to_response(report_row, user),
        total_registros_exportados=total_exportados,
    )


@router.get("", response_model=List[ReporteGeneradoResponse])
async def listar_reportes_generados(
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
    tipo_reporte: Optional[str] = Query(None),
    solo_existentes: bool = Query(False),
):
    scope = _resolve_access_scope(db, user.id)
    q = db.query(ReporteGenerado, Usuario).outerjoin(Usuario, Usuario.id == ReporteGenerado.usuario_id)
    if scope == "own":
        q = q.filter(ReporteGenerado.usuario_id == user.id)
    if tipo_reporte:
        q = q.filter(ReporteGenerado.nombre_reporte == tipo_reporte)
    rows = q.order_by(ReporteGenerado.fecha_generado.desc(), ReporteGenerado.id.desc()).all()
    items = [_to_response(row, usuario) for row, usuario in rows]
    if solo_existentes:
        items = [i for i in items if i.existe_archivo]
    return items


@router.get("/{reporte_id}", response_model=ReporteGeneradoResponse)
async def detalle_reporte_generado(
    reporte_id: int,
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    row = db.query(ReporteGenerado).filter(ReporteGenerado.id == reporte_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Reporte generado no encontrado")

    scope = _resolve_access_scope(db, user.id)
    if scope == "own" and row.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para acceder a este reporte")

    return _to_response(row, row.usuario)


@router.get("/{reporte_id}/descargar")
async def descargar_reporte_generado(
    reporte_id: int,
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    row = db.query(ReporteGenerado).filter(ReporteGenerado.id == reporte_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Reporte generado no encontrado")

    scope = _resolve_access_scope(db, user.id)
    if scope == "own" and row.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para descargar este reporte")

    absolute_path = BASE_DIR / (row.ruta_archivo or "")
    if not row.ruta_archivo or not absolute_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo PDF no existe en el servidor")

    return FileResponse(
        path=str(absolute_path),
        media_type="application/pdf",
        filename=absolute_path.name,
    )



@router.delete("/{reporte_id}")
async def eliminar_reporte_generado(
    reporte_id: int,
    user: Usuario = Depends(require_roles([ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    row = db.query(ReporteGenerado).filter(ReporteGenerado.id == reporte_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Reporte generado no encontrado")
    archivo_eliminado = False
    if row.ruta_archivo:
        p = (BASE_DIR / row.ruta_archivo).resolve()
        if REPORTS_STORAGE_DIR.resolve() in p.parents and p.is_file():
            p.unlink()
            archivo_eliminado = True
    db.delete(row)
    db.commit()
    return {"ok": True, "id": reporte_id, "archivo_eliminado": archivo_eliminado}
