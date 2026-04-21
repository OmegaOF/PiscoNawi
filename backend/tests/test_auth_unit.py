from jose import jwt

from modules.auth.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)


def test_hash_contrasena_ida_y_vuelta():
    password = "unaClaveSecreta123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True


def test_hash_contrasena_rechaza_contrasena_incorrecta():
    hashed = get_password_hash("correcta")
    assert verify_password("incorrecta", hashed) is False


def test_jwt_codifica_y_decodifica_sub_correctamente():
    token = create_access_token({"sub": "fernando"})
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "fernando"


def test_jwt_incluye_expiracion():
    token = create_access_token({"sub": "usuario_prueba"})
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert "exp" in decoded
    assert isinstance(decoded["exp"], int)
