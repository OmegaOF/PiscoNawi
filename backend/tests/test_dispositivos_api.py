from db import DispositivoCaptura


def test_list_dispositivos_authenticated(client, db, operator_user, operator_token, auth_headers):
    db.add(
        DispositivoCaptura(
            nombre_dispositivo="Cámara 1",
            tipo_dispositivo="IP",
            activo=True,
        )
    )
    db.commit()

    response = client.get("/api/dispositivos", headers=auth_headers(operator_token))
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body, list)
    names = [d["nombre_dispositivo"] for d in body]
    assert "Cámara 1" in names
