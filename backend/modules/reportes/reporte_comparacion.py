from pathlib import Path
import tempfile

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import func

from db import Prediccion
from modules.reportes.reports import _parse_date
from modules.reportes.utils_reportes import NO_DATA_MESSAGE, build_page_callbacks, build_styles, caja_conclusion, observacion_por_pct_smog, portada_simple, safe_pct, tabla_estilizada
from datetime import datetime, timedelta


def _query_comparacion(db, desde, hasta):
    q = db.query(Prediccion.clase_predicha, func.count(Prediccion.id)).group_by(Prediccion.clase_predicha)
    d = _parse_date(desde)
    h = _parse_date(hasta)
    if d is not None:
        q = q.filter(Prediccion.fecha_prediccion >= datetime.combine(d, datetime.min.time()))
    if h is not None:
        q = q.filter(Prediccion.fecha_prediccion < datetime.combine(h + timedelta(days=1), datetime.min.time()))
    rows = q.all()
    smog = sum(c for clase, c in rows if (clase or "").lower() == "smog")
    total = sum(c for _, c in rows)
    return total, smog, total - smog


def generar_reporte_comparacion_pdf(file_path: Path, db, payload, usuario_nombre: str) -> int:
    total, smog, sin_smog = _query_comparacion(db, payload.desde, payload.hasta)
    pct_smog = safe_pct(smog, total)
    pct_sin = safe_pct(sin_smog, total)
    styles = build_styles()
    story = []
    portada_simple(story, styles, "Reporte de Comparación", usuario_nombre, payload.desde, payload.hasta)

    if total == 0:
        story.append(Paragraph(NO_DATA_MESSAGE, styles["Normal"]))
    else:
        story.append(Paragraph(f"Total predicciones: {total}", styles["Normal"]))
        story.append(Paragraph(f"Cantidad smog: {smog}", styles["Normal"]))
        story.append(Paragraph(f"Cantidad sin smog: {sin_smog}", styles["Normal"]))
        story.append(Spacer(1, 8))
        tmp_file = None
        try:
            tmp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            fig, ax = plt.subplots(figsize=(6, 3.4), dpi=150)
            ax.bar(["Smog", "Sin smog"], [smog, sin_smog], color=["#c0392b", "#27ae60"])
            ax.set_title("Comparación de clases")
            ax.set_ylabel("Cantidad")
            fig.tight_layout()
            fig.savefig(tmp_file.name)
            plt.close(fig)
            story.append(Image(tmp_file.name, width=420, height=230))
        except Exception:
            story.append(Paragraph("No se pudo generar el gráfico para esta sección.", styles["Normal"]))
        data = [["Clase", "Cantidad", "Porcentaje"], ["Smog", str(smog), f"{pct_smog:.2f}%"], ["Sin smog", str(sin_smog), f"{pct_sin:.2f}%"]]
        story.append(Spacer(1, 8))
        story.append(tabla_estilizada(data, [170, 120, 120]))
        story.append(Spacer(1, 8))
        story.append(caja_conclusion(observacion_por_pct_smog(pct_smog), styles))

    page_cb = build_page_callbacks("Reporte de Comparación")
    doc = SimpleDocTemplate(str(file_path), pagesize=A4, topMargin=70, bottomMargin=45, leftMargin=36, rightMargin=36)
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return total
