from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import func

from db import Imagen, Prediccion
from modules.reportes.reporte_por_zonas import _query_zonas, generar_mapa_zonas_png
from modules.reportes.reports import fetch_tabla_resumen_data, get_tendencia_predicciones
from modules.reportes.reporte_cambios_tiempo import generar_grafico_cambios_barras_png
from modules.reportes.utils_reportes import NO_DATA_MESSAGE, build_page_callbacks, build_styles, caja_conclusion, kpi_cards, observacion_por_pct_smog, portada_simple, safe_pct, tabla_estilizada


async def generar_reporte_general_pdf(file_path: Path, db, payload, usuario_nombre: str, user):
    rows = fetch_tabla_resumen_data(db=db, desde=payload.desde, hasta=payload.hasta, agrupar=payload.agrupar)
    tendencia = await get_tendencia_predicciones(user=user, db=db, desde=payload.desde, hasta=payload.hasta, agrupar=payload.agrupar)
    zonas = _query_zonas(db, payload.desde, payload.hasta)

    total_pred = sum(r.total_predicciones for r in rows)
    total_smog = sum(r.total_smog for r in rows)
    total_img = db.query(func.count(Imagen.id)).scalar() or 0
    conf_avg = round((sum(r.confianza_promedio * r.total_predicciones for r in rows) / total_pred), 4) if total_pred else 0.0
    p_smog_avg = round((sum(r.p_smog_promedio * r.total_predicciones for r in rows) / total_pred), 4) if total_pred else 0.0
    pct_smog = safe_pct(total_smog, total_pred)

    styles = build_styles()
    story = []
    portada_simple(story, styles, "Reporte General", usuario_nombre, payload.desde, payload.hasta, payload.agrupar)
    story.append(Paragraph("El reporte resume los resultados obtenidos por el sistema durante el periodo seleccionado.", styles["Normal"]))
    story.append(Spacer(1, 8))

    if total_pred == 0:
        story.append(Paragraph(NO_DATA_MESSAGE, styles["Normal"]))
    else:
        story.append(kpi_cards([("Total imágenes", str(total_img)), ("Total de análisis", str(total_pred)), ("% con smog", f"{pct_smog:.2f}%"), ("Confianza promedio", f"{conf_avg:.4f}"), ("Smog promedio", f"{p_smog_avg:.4f}"), ("Periodo", payload.agrupar)]))
        story.append(Spacer(1, 10))

        # Cambios en el tiempo
        story.append(Paragraph("Cambios en el tiempo", styles["SectionTitle"]))
        try:
            chart_path = generar_grafico_cambios_barras_png(tendencia)
            story.append(Image(chart_path, width=410, height=220))
        except Exception:
            story.append(Paragraph("No se pudo generar el gráfico para esta sección.", styles["Normal"]))

        # Comparación
        smog = total_smog
        sin_smog = total_pred - total_smog
        story.append(Spacer(1, 8))
        story.append(Paragraph("Comparación", styles["SectionTitle"]))
        cmp_data = [["Resultado", "Cantidad", "Porcentaje"], ["Con smog", str(smog), f"{safe_pct(smog,total_pred):.2f}%"], ["Sin smog", str(sin_smog), f"{safe_pct(sin_smog,total_pred):.2f}%"]]
        story.append(tabla_estilizada(cmp_data, [130, 120, 120]))

        # Zonas
        story.append(Spacer(1, 8))
        story.append(Paragraph("Zonas", styles["SectionTitle"]))
        top_zonas = zonas[:5]
        if zonas:
            try:
                mapa_path, mapa_error = generar_mapa_zonas_png(zonas)
                if mapa_path:
                    story.append(Image(mapa_path, width=410, height=240))
                elif mapa_error:
                    story.append(Paragraph(mapa_error, styles["Small"]))
            except Exception:
                story.append(Paragraph("No se pudo generar el mapa para esta sección.", styles["Small"]))
        if top_zonas:
            zonas_data = [["Ubicación", "Total de análisis", "Casos con smog", "% con smog"]] + [[z["ubicacion"], str(z["total"]), str(z["smog"]), f"{z['pct_smog']:.2f}%"] for z in top_zonas]
            story.append(tabla_estilizada(zonas_data, [120, 105, 105, 85]))

        story.append(Spacer(1, 8))
        story.append(Paragraph("Resumen por periodo", styles["SectionTitle"]))
        data = [["Periodo", "Total de análisis", "Casos con smog", "% con smog", "Confianza promedio", "Smog promedio"]]
        for r in rows:
            data.append([r.periodo, str(r.total_predicciones), str(r.total_smog), f"{r.pct_smog:.2f}", f"{r.confianza_promedio:.4f}", f"{r.p_smog_promedio:.4f}"])
        story.append(tabla_estilizada(data, [70, 95, 90, 78, 105, 85]))
        story.append(Spacer(1, 8))
        story.append(caja_conclusion(observacion_por_pct_smog(pct_smog), styles))

    page_cb = build_page_callbacks("Reporte General")
    doc = SimpleDocTemplate(str(file_path), pagesize=A4, topMargin=70, bottomMargin=45, leftMargin=36, rightMargin=36)
    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return total_pred
