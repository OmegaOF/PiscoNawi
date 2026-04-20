def test_roles_me_returns_user_roles(client, admin_user, admin_token, auth_headers):
    response = client.get("/api/roles/me", headers=auth_headers(admin_token))
    assert response.status_code == 200

    body = response.json()
    assert body["username"] == "admin_test"
    assert body["user_id"] == admin_user.id
    assert "Administrador" in body["roles"]
