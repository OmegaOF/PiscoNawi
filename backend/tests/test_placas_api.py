from datetime import datetime

import pytest

from db import DispositivoCaptura, Imagen, Prediccion, Ubicacion

B = "/api/placas"


def seed_placas(db, user_id):
    db.add_all([
        Ubicacion(id=1, latitud=-17.41, longitud=-66.15, direccion="Av. Ayacucho, Cercado"),
        Ubicacion(id=2, latitud=-17.39, longitud=-66.27, direccion="Quillacollo Centro, Quillacollo"),
    ])
    db.add(DispositivoCaptura(id=1, nombre_dispositivo="Cam A", activo=True))
    db.flush()
    filas = [
        # id, clase, p_smog, placa, fecha, ubicacion
        (1, "smog", 0.95, None, datetime(2026, 10, 5, 8, 0), 1),
        (2, "smog", 0.80, "  ", datetime(2026, 10, 6, 9, 0), 1),
        (3, "smog", 0.70, "1234ABC", datetime(2026, 10, 3, 10, 0), 2),
        (4, "sin_smog", 0.20, None, datetime(2026, 10, 4, 11, 0), 2),
        (5, "smog", 0.60, None, datetime(2026, 9, 20, 12, 0), 1),
    ]
    for i, clase, p, placa, ts, ub in filas:
        img = Imagen(
            id=i,
            filename_original=f"v{i}.jpg",
            ruta_archivo=f"http://localhost:8000/capturas/v{i}.jpg",
            placa_manual=placa,
            fecha_subida=ts,
            usuario_id=user_id,
            ubicacion_id=ub,
            dispositivo_captura_id=1,
        )
        img.prediccion = Prediccion(
            clase_predicha=clase,
            confianza=p if clase == "smog" else 1 - p,
            p_smog=p,
            fecha_prediccion=ts,
        )
        db.add(img)
    db.commit()


@pytest.fixture
def datos(db, admin_user):
    seed_placas(db, admin_user.id)


@pytest.fixture
def H(admin_token, auth_headers):
    return auth_headers(admin_token)


def ids(r):
    return [x["imagen_id"] for x in r["items"]]


def test_cola_por_defecto_smog_sin_placa(client, datos, H):
    r = client.get(f"{B}/vehiculos", headers=H).json()
    assert ids(r) == [1, 2, 5]
    assert r["total"] == 3
    assert r["resumen"] == {"total": 4, "con_placa": 1, "sin_placa": 3, "pct_completado": 25.0}


def test_filtro_estado(client, datos, H):
    r1 = client.get(f"{B}/vehiculos?estado=con_placa", headers=H).json()
    r2 = client.get(f"{B}/vehiculos?estado=todas", headers=H).json()
    assert ids(r1) == [3]
    assert len(r2["items"]) == 4
    assert r1["resumen"] == r2["resumen"]


def test_filtro_clase(client, datos, H):
    assert ids(client.get(f"{B}/vehiculos?clase=sin_smog&estado=todas", headers=H).json()) == [4]
    r = client.get(f"{B}/vehiculos?clase=todas&estado=sin_placa", headers=H).json()
    assert len(r["items"]) == 4
    assert r["resumen"]["total"] == 5


def test_filtros_fecha_y_zona(client, datos, H):
    r = client.get(f"{B}/vehiculos?desde=2026-10-01&hasta=2026-10-09", headers=H).json()
    assert ids(r) == [1, 2]
    assert r["resumen"]["total"] == 3
    assert ids(client.get(f"{B}/vehiculos?estado=todas&ubicacion_id=2", headers=H).json()) == [3]


def test_busqueda_normalizada(client, datos, H):
    assert ids(client.get(f"{B}/vehiculos?estado=todas&q=34 ab", headers=H).json()) == [3]


def test_paginacion(client, datos, H):
    r = client.get(f"{B}/vehiculos?size=2&page=2", headers=H).json()
    assert ids(r) == [5] and r["total"] == 3 and r["page"] == 2


def test_orden_fecha(client, datos, H):
    assert ids(client.get(f"{B}/vehiculos?orden=fecha", headers=H).json()) == [2, 1, 5]


def test_obtener_vehiculo_y_404(client, datos, H):
    r = client.get(f"{B}/vehiculos/3", headers=H).json()
    assert r["ubicacion_nombre"] == "Quillacollo Centro"
    assert r["dispositivo_nombre"] == "Cam A"
    assert r["usuario_nombre"] == "Admin_test"
    assert client.get(f"{B}/vehiculos/999", headers=H).status_code == 404


def test_put_normaliza(client, datos, H, db):
    r = client.put(f"{B}/1", json={"placa": "ab 12-3c"}, headers=H).json()
    assert r["placa_manual"] == "AB123C" and r["formato_valido"] is False
    r = client.put(f"{B}/1", json={"placa": " 1234 abc "}, headers=H).json()
    assert r["placa_manual"] == "1234ABC" and r["formato_valido"] is True
    db.expire_all()
    assert db.query(Imagen).get(1).placa_manual == "1234ABC"


def test_put_null_y_vacio_limpian(client, datos, H):
    assert client.put(f"{B}/3", json={"placa": None}, headers=H).json()["placa_manual"] is None
    client.put(f"{B}/3", json={"placa": "999AAA"}, headers=H)
    assert client.put(f"{B}/3", json={"placa": "   "}, headers=H).json()["placa_manual"] is None
    assert 3 in ids(client.get(f"{B}/vehiculos", headers=H).json())


def test_put_errores(client, datos, H):
    assert client.put(f"{B}/999", json={"placa": "123ABC"}, headers=H).status_code == 404
    assert client.put(f"{B}/1", json={"placa": "A" * 21}, headers=H).status_code == 422
    assert client.put(f"{B}/1", json={"placa": "12#4ABC"}, headers=H).status_code == 422


def test_operador_puede_listar_y_guardar(client, datos, operator_token, auth_headers):
    h = auth_headers(operator_token)
    assert client.get(f"{B}/vehiculos", headers=h).status_code == 200
    assert client.put(f"{B}/1", json={"placa": "123ABC"}, headers=h).status_code == 200
    assert client.get(f"{B}/filtros", headers=h).status_code == 200


def test_sin_token(client, datos):
    assert client.get(f"{B}/vehiculos").status_code in (401, 403)


def test_filtros(client, datos, H):
    r = client.get(f"{B}/filtros", headers=H).json()
    assert r["zonas"] == [{"id": 1, "nombre": "Av. Ayacucho"}, {"id": 2, "nombre": "Quillacollo Centro"}]
    assert r["dispositivos"] == [{"id": 1, "nombre": "Cam A"}]
