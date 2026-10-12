from datetime import datetime

import pytest

from db import ReporteGenerado
from modules.reportes import reportes_generados


@pytest.fixture
def tmp_reports(monkeypatch, tmp_path):
    storage = tmp_path / "storage" / "reports"
    storage.mkdir(parents=True)
    monkeypatch.setattr(reportes_generados, "BASE_DIR", tmp_path)
    monkeypatch.setattr(reportes_generados, "REPORTS_STORAGE_DIR", storage)
    return tmp_path


def _row(db, user_id, nombre, ruta, params=None):
    r = ReporteGenerado(nombre_reporte=nombre, fecha_generado=datetime(2026, 10, 9, 12), usuario_id=user_id,
                        ruta_archivo=ruta, parametros_json=params)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def test_listar_incluye_metadatos(client, db, admin_user, admin_token, auth_headers, tmp_reports):
    ruta = "storage/reports/comparacion_1_20261009_120000_abcdef12.pdf"
    (tmp_reports / ruta).write_bytes(b"0123456789")
    a = _row(db, admin_user.id, "comparacion", ruta,
             '{"desde":"2026-10-01","hasta":"2026-10-09","agrupar":"dia","total_registros":5}')
    b = _row(db, admin_user.id, "Reporte Smog Enero", "/reportes/enero.pdf")
    r = {x["id"]: x for x in client.get("/api/reportes-generados", headers=auth_headers(admin_token)).json()}
    assert r[a.id]["existe_archivo"] is True and r[a.id]["tamano_bytes"] == 10
    assert r[a.id]["usuario_nombre"] == "Admin_test"
    assert r[a.id]["tipo_reporte"] == "comparacion" and r[a.id]["desde"] == "2026-10-01"
    assert r[a.id]["total_registros"] == 5
    assert r[b.id]["existe_archivo"] is False and r[b.id]["tipo_reporte"] == "desconocido"


def test_tipo_inferido_desde_nombre_archivo(client, db, admin_user, admin_token, auth_headers, tmp_reports):
    a = _row(db, admin_user.id, "tabla_resumen", "storage/reports/tabla_resumen_1_20260424_001341_04befe5c.pdf")
    r = client.get(f"/api/reportes-generados/{a.id}", headers=auth_headers(admin_token)).json()
    assert r["tipo_reporte"] == "tabla_resumen"
    assert r["tipo_reporte_label"] == "Tabla resumen (antiguo)"


def test_eliminar_borra_fila_y_archivo(client, db, admin_user, admin_token, auth_headers, tmp_reports):
    ruta = "storage/reports/detallado_1_20261009_120000_abcdef12.pdf"
    f = tmp_reports / ruta
    f.write_bytes(b"x")
    a = _row(db, admin_user.id, "detallado", ruta)
    r = client.delete(f"/api/reportes-generados/{a.id}", headers=auth_headers(admin_token))
    assert r.status_code == 200 and r.json()["archivo_eliminado"] is True
    assert not f.exists()
    assert client.get(f"/api/reportes-generados/{a.id}", headers=auth_headers(admin_token)).status_code == 404


def test_eliminar_no_toca_archivos_fuera_de_storage(client, db, admin_user, admin_token, auth_headers, tmp_reports):
    fuera = tmp_reports / "fuera.pdf"
    fuera.write_bytes(b"x")
    a = _row(db, admin_user.id, "detallado", str(fuera))
    r = client.delete(f"/api/reportes-generados/{a.id}", headers=auth_headers(admin_token)).json()
    assert r["archivo_eliminado"] is False and fuera.exists()


def test_eliminar_prohibido_para_analista(client, db, analista_user, analista_token, auth_headers, tmp_reports):
    a = _row(db, analista_user.id, "detallado", "storage/reports/x.pdf")
    assert client.delete(f"/api/reportes-generados/{a.id}", headers=auth_headers(analista_token)).status_code == 403


def test_exportar_pdf_guarda_parametros(client, db, admin_token, auth_headers, tmp_reports):
    r = client.post("/api/reportes-generados/exportar-pdf",
                    json={"tipo_reporte": "comparacion", "desde": "2026-10-01", "hasta": "2026-10-09"},
                    headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    rg = r.json()["reporte_generado"]
    assert rg["desde"] == "2026-10-01" and rg["existe_archivo"] is True
    assert rg["total_registros"] == r.json()["total_registros_exportados"]
    row = db.query(ReporteGenerado).get(rg["id"])
    assert row.parametros_json


def test_analista_solo_ve_propios(client, db, admin_user, analista_user, analista_token, auth_headers, tmp_reports):
    _row(db, admin_user.id, "detallado", "storage/reports/a.pdf")
    propio = _row(db, analista_user.id, "detallado", "storage/reports/b.pdf")
    r = client.get("/api/reportes-generados", headers=auth_headers(analista_token)).json()
    assert [x["id"] for x in r] == [propio.id]
