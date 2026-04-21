def test_admin_puede_listar_usuarios(client, admin_user, admin_token, auth_headers):
    response = client.get("/api/usuarios", headers=auth_headers(admin_token))
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body, list)
    usernames = [u["username"] for u in body]
    assert "admin_test" in usernames


def test_listar_usuarios_restringido_para_operador(client, operator_user, operator_token, auth_headers):
    response = client.get("/api/usuarios", headers=auth_headers(operator_token))
    assert response.status_code == 403


def test_admin_crea_usuario_y_luego_inicia_sesion(client, admin_user, admin_token, auth_headers):
    create_response = client.post(
        "/api/usuarios",
        headers=auth_headers(admin_token),
        json={
            "nombre": "Nuevo Usuario",
            "username": "nuevo_user",
            "password": "nuevaClave123",
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["username"] == "nuevo_user"

    login_response = client.post(
        "/api/auth/login",
        json={"username": "nuevo_user", "password": "nuevaClave123"},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_crear_usuario_nombre_duplicado(client, admin_user, admin_token, auth_headers):
    payload = {"nombre": "Dup", "username": "dup_user", "password": "xyz"}

    first = client.post("/api/usuarios", headers=auth_headers(admin_token), json=payload)
    assert first.status_code == 200

    second = client.post("/api/usuarios", headers=auth_headers(admin_token), json=payload)
    assert second.status_code == 400
