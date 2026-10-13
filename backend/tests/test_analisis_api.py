from datetime import datetime

from db import Imagen, Prediccion


def test_estado_cnn_contiene_claves_esperadas(client, operator_user, operator_token, auth_headers):
    response = client.get("/api/analisis/estado-cnn", headers=auth_headers(operator_token))
    assert response.status_code == 200

    body = response.json()
    assert set(body.keys()) == {"running", "current_file", "processed", "pending"}
    assert body["running"] is False


def test_emisiones_retorna_prediccion_inicial(client, db, operator_user, operator_token, auth_headers):
    imagen = Imagen(
        filename_original="test.jpg",
        ruta_archivo="http://localhost:8000/capturas/test.jpg",
        fecha_subida=datetime.utcnow(),
    )
    db.add(imagen)
    db.commit()
    db.refresh(imagen)

    pred = Prediccion(
        imagen_id=imagen.id,
        clase_predicha="smog",
        confianza=0.87,
        p_smog=0.87,
        fecha_prediccion=datetime.utcnow(),
        observacion="seed",
    )
    db.add(pred)
    db.commit()

    response = client.get("/api/analisis/emisiones", headers=auth_headers(operator_token))
    assert response.status_code == 200

    body = response.json()
    assert body["total"] == 1 and body["page"] == 1 and body["size"] == 30
    items = body["items"]
    assert len(items) == 1
    assert items[0]["clase_predicha"] == "smog"
    assert abs(items[0]["p_smog"] - 0.87) < 1e-6


def test_emisiones_ordenadas_recientes_primero_y_paginadas(client, db, operator_token, auth_headers):
    from datetime import datetime, timedelta
    from db import Imagen, Prediccion

    base = datetime(2026, 10, 1, 8, 0)
    for i in range(35):
        img = Imagen(filename_original=f"img{i}.jpg", ruta_archivo=f"http://x/img{i}.jpg", fecha_subida=base + timedelta(hours=i))
        img.prediccion = Prediccion(clase_predicha="smog", confianza=0.9, p_smog=0.9, fecha_prediccion=base + timedelta(hours=i))
        db.add(img)
    db.commit()

    h = auth_headers(operator_token)
    p1 = client.get("/api/analisis/emisiones", headers=h).json()
    assert p1["total"] == 35 and p1["paginas"] == 2 and len(p1["items"]) == 30
    assert p1["items"][0]["filename_original"] == "img34.jpg"
    fechas = [x["fecha_prediccion"] for x in p1["items"]]
    assert fechas == sorted(fechas, reverse=True)

    p2 = client.get("/api/analisis/emisiones?page=2", headers=h).json()
    assert len(p2["items"]) == 5 and p2["items"][-1]["filename_original"] == "img0.jpg"
