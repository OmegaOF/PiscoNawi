from modules.roles.roles import get_user_roles


def test_obtener_roles_usuario_devuelve_roles_asignados(db, admin_user):
    roles = get_user_roles(db, admin_user.id)

    assert isinstance(roles, list)
    assert "Administrador" in roles


def test_obtener_roles_usuario_vacio_para_usuario_sin_roles(db):
    from db import Usuario
    from modules.auth.auth import get_password_hash

    user = Usuario(
        nombre="SinRol",
        username="sin_rol",
        password_hash=get_password_hash("x"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    roles = get_user_roles(db, user.id)
    assert roles == []
