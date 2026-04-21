def test_login_success(client, admin_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "secret123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_usuario_exitoso(client, admin_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "incorrecta"},
    )
    assert response.status_code == 401


def test_login_usuario_desconocido(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "no_existe", "password": "x"},
    )
    assert response.status_code == 401


def test_me_usuario_con_token_valido(client, admin_user, admin_token, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers(admin_token))
    assert response.status_code == 200

    body = response.json()
    assert body["username"] == "admin_test"
    assert "Administrador" in body["roles"]


def test_me_usuario_sin_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code in (401, 403)
