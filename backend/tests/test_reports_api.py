from datetime import date, datetime

import pytest

from db import Ciudad, DispositivoCaptura, Imagen, Pais, Prediccion, Provincia, Ubicacion
from modules.reportes import reports_extra

OCT = "desde=2026-10-01&hasta=2026-10-09"


def seed_reportes(db, admin_user, analista_user):
    pais = Pais(nombre="Bolivia")
    db.add(pais)
    db.flush()
    prov = Provincia(nombre="Cercado", pais_id=pais.id)
    db.add(prov)
    db.flush()
    ciudad = Ciudad(nombre="Cochabamba", provincia_id=prov.id, latitud=-17.39, longitud=-66.15)
    db.add(ciudad)
    db.flush()
    db.add_all([
        Ubicacion(id=1, latitud=-17.41, longitud=-66.15, direccion="Av. Ayacucho, Cercado", departamento="Cochabamba", ciudad_id=ciudad.id),
        Ubicacion(id=2, latitud=-17.39, longitud=-66.27, direccion="Quillacollo Centro", departamento="Cochabamba", ciudad_id=None),
    ])
    db.add_all([
        DispositivoCaptura(id=1, nombre_dispositivo="Cam A", tipo_dispositivo="Camara IP", activo=True),
        DispositivoCaptura(id=2, nombre_dispositivo="Sensor B", tipo_dispositivo="Sensor", activo=False),
    ])
    db.flush()
    filas = [
        (datetime(2026, 10, 5, 8, 10), 1, 1, admin_user.id, "1234ABC", 0.91),   # lunes 08h
        (datetime(2026, 10, 5, 8, 40), 1, 1, admin_user.id, "1234ABC", 0.80),   # lunes 08h
        (datetime(2026, 10, 6, 8, 5), 1, 1, analista_user.id, "1234ABC", 0.30),  # martes 08h
        (datetime(2026, 10, 6, 18, 0), 2, 1, analista_user.id, None, 0.75),
        (datetime(2026, 10, 3, 18, 30), 2, 1, None, "9999ZZZ", 0.10),           # sábado
        (datetime(2026, 9, 20, 7, 0), 1, 1, admin_user.id, None, 0.65),
        (datetime(2026, 9, 21, 7, 0), 2, 1, admin_user.id, None, 0.20),
    ]
    for i, (ts, ub, disp, uid, placa, p) in enumerate(filas):
        clase = "smog" if p >= 0.5 else "sin_smog"
        img = Imagen(
            filename_original=f"t{i}.jpg",
            ruta_archivo=f"http://localhost:8000/capturas/t{i}.jpg",
            placa_manual=placa,
            fecha_subida=ts,
            usuario_id=uid,
            ubicacion_id=ub,
            dispositivo_captura_id=disp,
        )
        img.prediccion = Prediccion(
            clase_predicha=clase,
            confianza=p if clase == "smog" else 1 - p,
            p_smog=p,
            fecha_prediccion=ts,
            observacion="t",
        )
        db.add(img)
    db.commit()


@pytest.fixture
def datos(db, admin_user, analista_user):
    seed_reportes(db, admin_user, analista_user)


@pytest.fixture
def H(admin_token, auth_headers):
    return auth_headers(admin_token)


def test_kpis_rango_y_filtro_ubicacion(client, datos, H):
    r = client.get(f"/api/reports/kpis?{OCT}", headers=H).json()
    assert r["total_predicciones"] == 5
    assert r["total_smog"] == 3
    r2 = client.get(f"/api/reports/kpis?{OCT}&ubicacion_id=2", headers=H).json()
    assert r2["total_predicciones"] == 2
    assert r2["pct_smog"] == 50.0


def test_kpis_sin_filtros_sigue_funcionando(client, datos, H):
    r = client.get("/api/reports/kpis", headers=H).json()
    assert r["total_predicciones"] == 7
    assert r["total_imagenes"] == 7


def test_tendencia_agrupar_mes_en_sqlite(client, datos, H):
    r = client.get("/api/reports/tendencia-predicciones?agrupar=mes", headers=H).json()
    assert [x["periodo"] for x in r] == ["2026-09", "2026-10"]
    assert client.get("/api/reports/tendencia-predicciones?agrupar=semana", headers=H).status_code == 200


def test_tabla_resumen_filtro_dispositivo(client, datos, H):
    assert client.get("/api/reports/tabla-resumen?dispositivo_id=2", headers=H).json() == []
    assert len(client.get("/api/reports/tabla-resumen?dispositivo_id=1", headers=H).json()) > 0


def test_por_ubicacion_incluye_direccion_ciudad_nivel(client, datos, H):
    r = {z["ubicacion_id"]: z for z in client.get(f"/api/reports/por-ubicacion?{OCT}", headers=H).json()}
    assert r[1]["ciudad"] == "Cochabamba"
    assert r[1]["nivel"] == "Alto"  # 2 de 3 = 66.7 %
    assert r[1]["etiqueta"] == "Av. Ayacucho"
    assert r[1]["nombre"] == "U1"
    assert r[2]["ciudad"] is None


def test_por_usuario_incluye_pct_smog(client, datos, H, admin_user):
    r = {u["usuario_id"]: u for u in client.get(f"/api/reports/por-usuario?{OCT}", headers=H).json()}
    assert r[admin_user.id]["total_predicciones"] == 2
    assert r[admin_user.id]["smog"] == 2
    assert r[admin_user.id]["pct_smog"] == 100.0


def test_heatmap_horas(client, datos, H):
    assert date(2026, 10, 5).weekday() == 0
    r = client.get(f"/api/reports/heatmap-horas?{OCT}", headers=H).json()
    assert len(r) == 168
    cells = {(c["dia_semana"], c["hora"]): c for c in r}
    assert cells[(0, 8)]["total"] == 2 and cells[(0, 8)]["smog"] == 2
    assert cells[(1, 8)]["total"] == 1 and cells[(1, 8)]["smog"] == 0
    assert cells[(5, 18)]["total"] == 1


def test_por_dispositivo_incluye_inactivos(client, datos, H):
    r = client.get(f"/api/reports/por-dispositivo?{OCT}", headers=H).json()
    assert len(r) == 2
    sensor = next(d for d in r if d["dispositivo_id"] == 2)
    assert sensor["total"] == 0 and sensor["activo"] is False and sensor["nivel"] == "Sin smog"
    assert len(client.get(f"/api/reports/por-dispositivo?{OCT}&dispositivo_id=1", headers=H).json()) == 1


def test_por_ciudad(client, datos, H):
    r = client.get(f"/api/reports/por-ciudad?{OCT}", headers=H).json()
    assert len(r) == 1
    assert r[0]["nombre"] == "Cochabamba" and r[0]["total"] == 3


def test_top_capturas(client, datos, H):
    r = client.get(f"/api/reports/top-capturas?{OCT}&limit=2&orden=p_smog", headers=H).json()
    assert len(r) == 2 and r[0]["p_smog"] == 0.91
    r2 = client.get(f"/api/reports/top-capturas?{OCT}&clase=sin_smog", headers=H).json()
    assert r2 and all(x["clase_predicha"] == "sin_smog" for x in r2)


def test_placas_reincidentes(client, datos, H):
    r = client.get(f"/api/reports/placas-reincidentes?{OCT}", headers=H).json()
    assert len(r) == 1 and r[0]["placa"] == "1234ABC" and r[0]["total"] == 3 and r[0]["smog"] == 2
    r2 = client.get(f"/api/reports/placas-reincidentes?{OCT}&min_total=1", headers=H).json()
    assert {x["placa"] for x in r2} == {"1234ABC", "9999ZZZ"}
    assert len(client.get(f"/api/reports/placas-reincidentes?{OCT}&min_total=1&limit=1", headers=H).json()) == 1


def test_scatter_limit(client, datos, H):
    r = client.get("/api/reports/scatter-confianza?limit=3", headers=H).json()
    assert len(r) == 3 and set(r[0]) == {"p_smog", "confianza", "clase"}


def test_comparativa_periodos(client, datos, H):
    r = client.get(f"/api/reports/comparativa-periodos?{OCT}", headers=H).json()
    assert r["periodo_anterior"]["desde"] == "2026-09-22"
    assert r["anterior"]["total_predicciones"] == 0
    assert r["delta_pct"]["total_predicciones"] is None
    r2 = client.get("/api/reports/comparativa-periodos?desde=2026-09-19&hasta=2026-09-27", headers=H).json()
    assert r2["actual"]["total_predicciones"] == 2
    assert r2["anterior"]["total_predicciones"] == 0


def test_resumen_ejecutivo(client, datos, H, monkeypatch):
    r = client.get(f"/api/reports/resumen-ejecutivo?{OCT}", headers=H).json()
    assert r["nivel_global"] in {"Alto", "Moderado", "Bajo", "Sin smog"}
    assert r["zona_critica"] is None  # MIN_MUESTRA = 5
    monkeypatch.setattr(reports_extra, "MIN_MUESTRA", 1)
    r = client.get(f"/api/reports/resumen-ejecutivo?{OCT}", headers=H).json()
    assert r["zona_critica"]["ubicacion_id"] == 1
    assert r["comparativa"] is not None


@pytest.mark.parametrize("path", [
    "heatmap-horas", "por-dispositivo", "por-ciudad", "top-capturas",
    "placas-reincidentes", "scatter-confianza", "comparativa-periodos", "resumen-ejecutivo",
])
def test_nuevos_endpoints_prohibidos_para_operador(client, operator_token, auth_headers, path):
    assert client.get(f"/api/reports/{path}", headers=auth_headers(operator_token)).status_code == 403
