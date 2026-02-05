# db.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

# ✅ Tipos MySQL específicos para que coincida con tu BD real
from sqlalchemy.dialects.mysql import BIGINT, DECIMAL, TIMESTAMP

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:Smog2026%21@127.0.0.1:3306/pisco-nawi")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)

    imagenes = relationship("Imagen", back_populates="usuario")


class Ubicacion(Base):
    __tablename__ = "ubicaciones"

    id = Column(BIGINT(unsigned=True), primary_key=True, index=True, autoincrement=True)

    # ✅ SOLO direccion (ya existe en tu DB)
    direccion = Column(String(255), nullable=True)  # usa 255 si tu tabla es varchar(255)

    latitud = Column(DECIMAL(10, 8), nullable=False)
    longitud = Column(DECIMAL(11, 8), nullable=False)

    # Opcionales si existen en tu tabla (si no existen, elimínalos del modelo)
    altitud = Column(DECIMAL(8, 2), nullable=True)
    precision_metros = Column(Integer, nullable=True)
    pais = Column(String(100), nullable=True)
    departamento = Column(String(100), nullable=True)
    ciudad = Column(String(100), nullable=True)
    codigo_postal = Column(String(20), nullable=True)
    fecha_captura = Column(DateTime, nullable=True)
    dispositivo = Column(String(100), nullable=True)
    direccion_ip = Column(String(45), nullable=True)

    created_at = Column(TIMESTAMP, nullable=True, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    imagenes = relationship("Imagen", back_populates="ubicacion")


class Imagen(Base):
    __tablename__ = "imagenes"

    id = Column(Integer, primary_key=True, index=True)
    filename_original = Column(String(255), nullable=False)
    ruta_archivo = Column(String(255), nullable=False)
    placa_manual = Column(String(255), nullable=True)
    fecha_subida = Column(DateTime, nullable=False)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    # ✅ En tu BD: ubicacion_id BIGINT UNSIGNED
    ubicacion_id = Column(BIGINT(unsigned=True), ForeignKey("ubicaciones.id"), nullable=True)

    usuario = relationship("Usuario", back_populates="imagenes")
    ubicacion = relationship("Ubicacion", back_populates="imagenes")
    prediccion = relationship("Prediccion", back_populates="imagen", uselist=False)


class Prediccion(Base):
    __tablename__ = "predicciones"

    id = Column(Integer, primary_key=True, index=True)
    imagen_id = Column(Integer, ForeignKey("imagenes.id"), unique=True, nullable=False)
    clase_predicha = Column(String(255), nullable=False)
    confianza = Column(Float, nullable=False)
    p_smog = Column(Float, nullable=False)
    fecha_prediccion = Column(DateTime, nullable=False)
    observacion = Column(String(255), nullable=True)

    imagen = relationship("Imagen", back_populates="prediccion")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
