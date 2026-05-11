from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
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


class ReporteGeneradoResponse(BaseModel):
    id: int
    nombre_reporte: str
    fecha_generado: Optional[str]
    usuario_id: int
    ruta_archivo: Optional[str] = None

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
    raise HTTPException(status_code=400, detail="tipo_reporte no soportado")


@router.post("/exportar-pdf", response_model=ExportarPDFResponse)
async def exportar_reporte_pdf(
    payload: ExportarPDFPayload,
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    if payload.tipo_reporte not in REPORTES_SOPORTADOS:
        raise HTTPException(
            status_code=400,
            detail=f"tipo_reporte no soportado. Soportados: {', '.join(sorted(REPORTES_SOPORTADOS))}",
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
    )
    db.add(report_row)
    db.commit()
    db.refresh(report_row)

    return ExportarPDFResponse(
        reporte_generado=ReporteGeneradoResponse(
            id=report_row.id,
            nombre_reporte=report_row.nombre_reporte,
            fecha_generado=report_row.fecha_generado.isoformat() if report_row.fecha_generado else None,
            usuario_id=report_row.usuario_id,
            ruta_archivo=report_row.ruta_archivo,
        ),
        total_registros_exportados=total_exportados,
    )


@router.get("", response_model=List[ReporteGeneradoResponse])
async def listar_reportes_generados(
    user: Usuario = Depends(require_roles([ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV])),
    db: Session = Depends(get_db),
):
    scope = _resolve_access_scope(db, user.id)
    q = db.query(ReporteGenerado)
    if scope == "own":
        q = q.filter(ReporteGenerado.usuario_id == user.id)
    rows = q.order_by(ReporteGenerado.fecha_generado.desc(), ReporteGenerado.id.desc()).all()
    return [
        ReporteGeneradoResponse(
            id=row.id,
            nombre_reporte=row.nombre_reporte,
            fecha_generado=row.fecha_generado.isoformat() if row.fecha_generado else None,
            usuario_id=row.usuario_id,
            ruta_archivo=row.ruta_archivo,
        )
        for row in rows
    ]


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

    return ReporteGeneradoResponse(
        id=row.id,
        nombre_reporte=row.nombre_reporte,
        fecha_generado=row.fecha_generado.isoformat() if row.fecha_generado else None,
        usuario_id=row.usuario_id,
        ruta_archivo=row.ruta_archivo,
    )


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

    absolute_path = BASE_DIR / row.ruta_archivo
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado en storage")

    return FileResponse(
        path=str(absolute_path),
        media_type="application/pdf",
        filename=absolute_path.name,
    )
