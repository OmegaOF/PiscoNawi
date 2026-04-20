from db import Pais


def test_list_paises_authenticated(client, db, operator_user, operator_token, auth_headers):
    db.add(Pais(nombre="Perú", codigo_iso="PE"))
    db.commit()

    response = client.get("/api/catalogos/paises", headers=auth_headers(operator_token))
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body, list)
    names = [p["nombre"] for p in body]
    assert "Perú" in names
