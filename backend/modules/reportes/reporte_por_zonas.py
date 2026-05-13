from datetime import datetime, timedelta
from pathlib import Path
import tempfile

from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import case, func
from staticmap import CircleMarker, StaticMap

from db import Imagen, Prediccion, Ubicacion
from modules.reportes.reports import _parse_date
from modules.reportes.utils_reportes import NO_DATA_MESSAGE, build_page_callbacks, build_styles, caja_conclusion, portada_simple, safe_pct, tabla_estilizada


def _query_zonas(db, desde, hasta):
    q = (
        db.query(
            Ubicacion.id,
            Ubicacion.latitud,
            Ubicacion.longitud,
            func.count(Prediccion.id).label("total"),
            func.sum(case((Prediccion.clase_predicha == "smog", 1), else_=0)).label("smog"),
        )
        .join(Imagen, Imagen.ubicacion_id == Ubicacion.id)
        .join(Prediccion, Prediccion.imagen_id == Imagen.id)
        .group_by(Ubicacion.id, Ubicacion.latitud, Ubicacion.longitud)
    )
    d = _parse_date(desde)
    h = _parse_date(hasta)
    if d is not None:
        q = q.filter(Prediccion.fecha_prediccion >= datetime.combine(d, datetime.min.time()))
    if h is not None:
        q = q.filter(Prediccion.fecha_prediccion < datetime.combine(h + timedelta(days=1), datetime.min.time()))
    rows = q.all()
    data = []
    for r in rows:
        total = int(r.total or 0)
        smog = int(r.smog or 0)
        data.append({
            "ubicacion": f"U{r.id}",
            "total": total,
            "smog": smog,
            "sin_smog": total - smog,
            "pct_smog": safe_pct(smog, total),
            "lat": float(r.latitud) if r.latitud is not None else None,
            "lon": float(r.longitud) if r.longitud is not None else None,
        })
    return sorted(data, key=lambda x: x["pct_smog"], reverse=True)


def _categoria_smog(zona):
    if zona["smog"] <= 0:
        return "Sin smog", "#aeb6bf"
    if zona["pct_smog"] > 60:
        return "Alto", "#c0392b"
    if zona["pct_smog"] > 30:
        return "Moderado", "#f39c12"
    return "Bajo", "#27ae60"


def generar_mapa_zonas_png(zonas):
    coords = [z for z in zonas if z["lat"] is not None and z["lon"] is not None]
    if len(coords) < 2:
        return None, "No se generó mapa porque no existen coordenadas suficientes."

    totals = [z["total"] for z in coords]
    min_total, max_total = min(totals), max(totals)

    def marker_size(total):
        if max_total == min_total:
            return 18
        return int(16 + ((total - min_total) / (max_total - min_total)) * 18)

    try:
        mapa = StaticMap(900, 520, url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png")
        for z in coords:
            _, color = _categoria_smog(z)
            size = marker_size(z["total"])
            # Halo oscuro para aumentar contraste sobre el mapa
            mapa.add_marker(CircleMarker((z["lon"], z["lat"]), "#222222", size + 4))
            mapa.add_marker(CircleMarker((z["lon"], z["lat"]), color, size))
        image = mapa.render(zoom=None)
        tmp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        image.save(tmp_file.name)
        return tmp_file.name, None
    except Exception:
        return None, "No se pudo generar el mapa para esta sección."


def generar_reporte_por_zonas_pdf(file_path: Path, db, payload, usuario_nombre: str) -> int:
    zonas = _query_zonas(db, payload.desde, payload.hasta)
    styles = build_styles()
    table_title_style = ParagraphStyle("CenteredSectionTitle", parent=styles["SectionTitle"], alignment=TA_CENTER)
    story = []
    portada_simple(story, styles, "Reporte por Zonas", usuario_nombre, payload.desde, payload.hasta)

    if not zonas:
        story.append(Paragraph(NO_DATA_MESSAGE, styles["Normal"]))
        story.append(Paragraph("No existen datos suficientes para determinar una zona con mayor presencia de smog.", styles["Normal"]))
    else:
        mapa_path, mapa_error = generar_mapa_zonas_png(zonas)
        if mapa_path:
            story.append(Image(mapa_path, width=460, height=265))
            leyenda = [["Nivel", "Color"], ["Sin smog", "Gris"], ["Bajo", "Verde"], ["Moderado", "Amarillo/Naranja"], ["Alto", "Rojo"]]
            story.append(Spacer(1, 6))
            story.append(tabla_estilizada(leyenda, [120, 200]))
        elif mapa_error:
            story.append(Paragraph(mapa_error, styles["Normal"]))

        story.append(Spacer(1, 8))
        story.append(Paragraph("Zonas con mayor % de smog", table_title_style))
        data = [["Ubicación", "Total de análisis", "Con smog", "Sin smog", "% con smog", "Latitud", "Longitud"]]
        for z in zonas:
            data.append([z["ubicacion"], str(z["total"]), str(z["smog"]), str(z["sin_smog"]), f"{z['pct_smog']:.2f}%", str(z["lat"] or "N/A"), str(z["lon"] or "N/A")])
        story.append(tabla_estilizada(data, [60, 95, 70, 70, 75, 75, 78]))
        top = zonas[0]
        story.append(Spacer(1, 8))
        story.append(caja_conclusion(f"La zona con mayor smog fue {top['ubicacion']} con {top['pct_smog']:.2f}%.", styles))

    page_cb = build_page_callbacks("Reporte por Zonas")
    doc = SimpleDocTemplate(str(file_path), pagesize=A4, topMargin=70, bottomMargin=45, leftMargin=36, rightMargin=36)
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return sum(z["total"] for z in zonas)
