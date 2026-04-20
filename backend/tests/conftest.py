import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

import db as db_module
db_module.engine = test_engine
db_module.SessionLocal = TestSessionLocal

from main import app
from db import Base, get_db, Usuario, Rol, UsuarioRol
from modules.auth.auth import get_password_hash, create_access_token


@pytest.fixture(scope="function")
def db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _create_user_with_role(db, username: str, role_name: str, password: str = "secret123") -> Usuario:
    rol = db.query(Rol).filter(Rol.nombre == role_name).first()
    if not rol:
        rol = Rol(nombre=role_name, descripcion=role_name)
        db.add(rol)
        db.commit()
        db.refresh(rol)

    user = Usuario(
        nombre=username.capitalize(),
        username=username,
        password_hash=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    link = UsuarioRol(usuario_id=user.id, rol_id=rol.id)
    db.add(link)
    db.commit()
    return user


@pytest.fixture
def admin_user(db):
    return _create_user_with_role(db, "admin_test", "Administrador")


@pytest.fixture
def operator_user(db):
    return _create_user_with_role(db, "op_test", "Usuario final")


@pytest.fixture
def analista_user(db):
    return _create_user_with_role(db, "analista_test", "Usuario analista")


@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.username})


@pytest.fixture
def operator_token(operator_user):
    return create_access_token({"sub": operator_user.username})


@pytest.fixture
def analista_token(analista_user):
    return create_access_token({"sub": analista_user.username})


@pytest.fixture
def auth_headers():
    def _build(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}
    return _build
