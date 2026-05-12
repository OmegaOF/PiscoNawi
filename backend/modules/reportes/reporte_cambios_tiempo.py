from pathlib import Path
import tempfile

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

from modules.reportes.reports import get_tendencia_predicciones
from modules.reportes.utils_reportes import NO_DATA_MESSAGE, build_page_callbacks, build_styles, caja_conclusion, portada_simple, safe_pct, tabla_estilizada


def generar_grafico_cambios_barras_png(rows):
    tmp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    labels = [r.periodo for r in rows]
    x = np.arange(len(labels))
    width = 0.24

    fig, ax = plt.subplots(figsize=(8.0, 4.1), dpi=170)
    bars_total = ax.bar(x - width, [r.total for r in rows], width=width, color="#2e86de", label="Total de análisis")
    bars_smog = ax.bar(x, [r.smog for r in rows], width=width, color="#c0392b", label="Con smog")
    bars_sin = ax.bar(x + width, [r.sin_smog for r in rows], width=width, color="#27ae60", label="Sin smog")

    ax.set_title("Cambios en el tiempo", fontsize=13, fontweight="bold")
    ax.set_ylabel("Cantidad")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.grid(axis="y", color="#d9e1ea", linestyle="--", linewidth=0.6)
    ax.legend(loc="upper right")

    if len(rows) <= 8:
        for bars in [bars_total, bars_smog, bars_sin]:
            for bar in bars:
                h = bar.get_height()
                ax.text(bar.get_x() + bar.get_width() / 2, h + 0.2, f"{int(h)}", ha="center", va="bottom", fontsize=8)

    fig.tight_layout()
    fig.savefig(tmp_file.name)
    plt.close(fig)
    return tmp_file.name


async def generar_reporte_cambios_tiempo_pdf(file_path: Path, db, payload, usuario_nombre: str, user):
    rows = await get_tendencia_predicciones(user=user, db=db, desde=payload.desde, hasta=payload.hasta, agrupar=payload.agrupar)
    styles = build_styles()
    story = []
    portada_simple(story, styles, "Reporte de Cambios en el Tiempo", usuario_nombre, payload.desde, payload.hasta, payload.agrupar)

    if not rows:
        story.append(Paragraph(NO_DATA_MESSAGE, styles["Normal"]))
    else:
        try:
            chart_path = generar_grafico_cambios_barras_png(rows)
            story.append(Image(chart_path, width=440, height=240))
        except Exception:
            story.append(Paragraph("No se pudo generar el gráfico para esta sección.", styles["Normal"]))

        story.append(Spacer(1, 8))
        data = [["Periodo", "Total de análisis", "Con smog", "Sin smog", "% con smog"]]
        for r in rows:
            data.append([r.periodo, str(r.total), str(r.smog), str(r.sin_smog), f"{safe_pct(r.smog, r.total):.2f}%"])
        story.append(tabla_estilizada(data, [105, 105, 85, 85, 85]))
        story.append(Spacer(1, 8))
        story.append(caja_conclusion("Los valores se mantienen estables durante el periodo analizado.", styles))

    page_cb = build_page_callbacks("Reporte de Cambios en el Tiempo")
    doc = SimpleDocTemplate(str(file_path), pagesize=A4, topMargin=70, bottomMargin=45, leftMargin=36, rightMargin=36)
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return sum(r.total for r in rows)
