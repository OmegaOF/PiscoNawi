from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

NO_DATA_MESSAGE = "No existen datos suficientes para el periodo seleccionado."

# Paleta tomada del frontend (tailwind.config.js)
COLOR_PRINCIPAL = colors.HexColor("#7A1E2B")
COLOR_SECUNDARIO = colors.HexColor("#C6B38E")
COLOR_FONDO_SUAVE = colors.HexColor("#F6F5F2")
COLOR_BORDE = colors.HexColor("#E7E2D8")
COLOR_TEXTO = colors.HexColor("#1E1E1E")
COLOR_TEXTO_MUTED = colors.HexColor("#6B6B6B")

BASE_DIR = Path(__file__).resolve().parents[3]
LOGO_PATH = BASE_DIR / "frontend" / "public" / "art-1.png"
WATERMARK_PATH = BASE_DIR / "frontend" / "public" / "FondoReport.png"
_WATERMARK_CACHE = {"src": None, "size": None, "missing_reported": False}


def fecha_hora_bolivia() -> datetime:
    return datetime.utcnow() - timedelta(hours=4)


def formato_hora_bolivia() -> str:
    return fecha_hora_bolivia().strftime("%Y-%m-%d %H:%M")


def safe_pct(part: float, total: float) -> float:
    if not total:
        return 0.0
    return round((part / total) * 100.0, 2)


def observacion_por_pct_smog(pct_smog: float) -> str:
    if pct_smog > 60:
        return "Se observa una alta presencia de smog en el periodo analizado."
    if pct_smog > 30:
        return "Se observa una presencia moderada de smog en el periodo analizado."
    return "Se observa una baja presencia de smog en el periodo analizado."


def _get_watermark_image_info(src_path: Path):
    if not src_path.exists():
        if not _WATERMARK_CACHE["missing_reported"]:
            print(f"[reportes] FondoReport.png no encontrado: {src_path}")
            _WATERMARK_CACHE["missing_reported"] = True
        return None

    src_key = str(src_path)
    if _WATERMARK_CACHE["src"] == src_key and _WATERMARK_CACHE["size"]:
        return src_key, _WATERMARK_CACHE["size"]

    with PILImage.open(src_path) as img:
        width, height = img.size
    _WATERMARK_CACHE["src"] = src_key
    _WATERMARK_CACHE["size"] = (width, height)
    return src_key, (width, height)


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SectionTitle", fontSize=13, leading=16, spaceAfter=6, textColor=COLOR_PRINCIPAL, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="Small", fontSize=9, leading=12, textColor=COLOR_TEXTO_MUTED))
    styles.add(ParagraphStyle(name="CoverTitle", fontSize=26, leading=30, textColor=COLOR_PRINCIPAL, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="ConclusionTitle", fontSize=11, leading=14, textColor=COLOR_PRINCIPAL, fontName="Helvetica-Bold"))
    styles["Normal"].textColor = COLOR_TEXTO
    return styles


def portada_simple(story: List, styles, titulo: str, usuario_nombre: str, desde: Optional[str], hasta: Optional[str], agrupar: Optional[str] = None):
    story.append(Paragraph("Pisco Ñawi IA", styles["CoverTitle"]))
    story.append(Paragraph(titulo, styles["Heading2"]))
    story.append(Spacer(1, 0.2 * inch))

    data = [["Usuario", usuario_nombre], ["Fecha de generación", f"{formato_hora_bolivia()} (hora Bolivia)"], ["Periodo", f"{desde or 'N/A'} hasta {hasta or 'N/A'}"]]
    if agrupar:
        data.append(["Agrupación", agrupar])
    story.append(tabla_estilizada([["Campo", "Valor"]] + data, [170, 280]))
    story.append(Spacer(1, 0.25 * inch))


def tabla_estilizada(data, col_widths=None):
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRINCIPAL), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.45, COLOR_BORDE), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_FONDO_SUAVE]),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def caja_conclusion(texto: str, styles):
    data = [[Paragraph("Conclusión", styles["ConclusionTitle"])], [Paragraph(texto, styles["Normal"])]]
    box = Table(data, colWidths=[470])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_FONDO_SUAVE), ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.8, COLOR_SECUNDARIO), ("LINEBEFORE", (0, 0), (0, -1), 3, COLOR_PRINCIPAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return box


def kpi_cards(items):
    rows = []
    for label, value in items:
        card = Table([[label], [value]], colWidths=[145])
        card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_FONDO_SUAVE), ("BACKGROUND", (0, 1), (-1, 1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.8, COLOR_BORDE), ("LINEBEFORE", (0, 0), (0, -1), 3, COLOR_PRINCIPAL),
            ("TEXTCOLOR", (0, 0), (-1, 0), COLOR_TEXTO_MUTED), ("TEXTCOLOR", (0, 1), (-1, 1), COLOR_PRINCIPAL),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica"), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9), ("FONTSIZE", (0, 1), (-1, 1), 13), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        rows.append(card)
    table = Table([rows[:3], rows[3:6] if len(rows) > 3 else []], colWidths=[160, 160, 160])
    return table


def build_page_callbacks(report_title: str):
    def _draw(canvas, doc):
        canvas.saveState()
        width, height = A4

        # 1) Fondo/marca de agua detrás del contenido, en todas las páginas.
        try:
            watermark_info = _get_watermark_image_info(WATERMARK_PATH)
            if watermark_info:
                wm_path, (img_w, img_h) = watermark_info
                scale = min(width / img_w, height / img_h) * 0.95
                wm_w = img_w * scale
                wm_h = img_h * scale
                x = (width - wm_w) / 2
                y = (height - wm_h) / 2
                canvas.drawImage(wm_path, x, y, width=wm_w, height=wm_h, preserveAspectRatio=True, mask='auto')
        except Exception as exc:
            print(f"[reportes] No se pudo dibujar FondoReport.png como marca de agua: {exc}")

        # 2) Header / footer encima de la marca
        canvas.setStrokeColor(COLOR_PRINCIPAL)
        canvas.setLineWidth(0.6)
        canvas.line(24, 46, 24, height - 72)
        canvas.setStrokeColor(COLOR_SECUNDARIO)
        canvas.setLineWidth(0.5)
        canvas.line(30, height - 64, width - 30, height - 64)
        if LOGO_PATH.exists():
            canvas.drawImage(str(LOGO_PATH), 35, height - 55, width=22, height=22, preserveAspectRatio=True, mask='auto')
        canvas.setStrokeColor(COLOR_PRINCIPAL)
        canvas.setLineWidth(1)
        canvas.line(30, height - 60, width - 30, height - 60)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.setFillColor(COLOR_PRINCIPAL)
        canvas.drawString(62, height - 46, "Pisco Ñawi IA")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(COLOR_TEXTO_MUTED)
        canvas.drawRightString(width - 35, height - 46, report_title)

        canvas.setStrokeColor(COLOR_BORDE)
        canvas.line(30, 35, width - 30, 35)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(COLOR_TEXTO_MUTED)
        canvas.drawString(35, 22, f"Pisco Ñawi IA · Reporte generado automáticamente · {formato_hora_bolivia()} hora Bolivia")
        canvas.drawRightString(width - 35, 22, f"Página {doc.page}")
        canvas.restoreState()

    return _draw
