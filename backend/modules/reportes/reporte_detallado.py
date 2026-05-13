from pathlib import Path
from typing import List

from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

from modules.reportes.reports import TablaResumenRow, fetch_tabla_resumen_data
from modules.reportes.utils_reportes import NO_DATA_MESSAGE, build_page_callbacks, build_styles, caja_conclusion, observacion_por_pct_smog, portada_simple, safe_pct, tabla_estilizada


def generar_reporte_detallado_pdf(file_path: Path, db, payload, usuario_nombre: str) -> int:
    rows: List[TablaResumenRow] = fetch_tabla_resumen_data(db=db, desde=payload.desde, hasta=payload.hasta, agrupar=payload.agrupar)
    styles = build_styles()
    table_title_style = ParagraphStyle("CenteredSectionTitle", parent=styles["SectionTitle"], alignment=TA_CENTER)
    story = []
    portada_simple(story, styles, "Reporte Detallado", usuario_nombre, payload.desde, payload.hasta, payload.agrupar)

    if not rows:
        story.append(Paragraph(NO_DATA_MESSAGE, styles["Normal"]))
    else:
        story.append(Paragraph("Tabla por periodo", table_title_style))
        data = [["Periodo", "Total de análisis", "Casos con smog", "% con smog", "Confianza promedio", "Smog promedio"]]
        for r in rows:
            data.append([r.periodo, str(r.total_predicciones), str(r.total_smog), f"{r.pct_smog:.2f}", f"{r.confianza_promedio:.4f}", f"{r.p_smog_promedio:.4f}"])
        story.append(tabla_estilizada(data, [70, 95, 90, 78, 105, 85]))
        story.append(Spacer(1, 12))
        total_pred = sum(r.total_predicciones for r in rows)
        total_smog = sum(r.total_smog for r in rows)
        pct = safe_pct(total_smog, total_pred)
        story.append(caja_conclusion(observacion_por_pct_smog(pct), styles))

    page_cb = build_page_callbacks("Reporte Detallado")
    doc = SimpleDocTemplate(str(file_path), pagesize=A4, topMargin=70, bottomMargin=45, leftMargin=36, rightMargin=36)
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return len(rows)
