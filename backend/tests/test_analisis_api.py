from datetime import datetime

from db import Imagen, Prediccion


def test_estado_cnn_returns_status_keys(client, operator_user, operator_token, auth_headers):
    response = client.get("/api/analisis/estado-cnn", headers=auth_headers(operator_token))
    assert response.status_code == 200

    body = response.json()
    assert set(body.keys()) == {"running", "current_file", "processed", "pending"}
    assert body["running"] is False


def test_emisiones_returns_seeded_prediction(client, db, operator_user, operator_token, auth_headers):
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
    assert len(body) == 1
    assert body[0]["clase_predicha"] == "smog"
    assert abs(body[0]["p_smog"] - 0.87) < 1e-6
