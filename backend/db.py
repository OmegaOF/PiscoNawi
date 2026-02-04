from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

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

    # Relationship
    imagenes = relationship("Imagen", back_populates="usuario")


class Ubicacion(Base):
    __tablename__ = "ubicaciones"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=True)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationship
    imagenes = relationship("Imagen", back_populates="ubicacion")


class Imagen(Base):
    __tablename__ = "imagenes"

    id = Column(Integer, primary_key=True, index=True)
    filename_original = Column(String(255), nullable=False)
    ruta_archivo = Column(String(255), nullable=False)
    placa_manual = Column(String(255), nullable=True)
    fecha_subida = Column(DateTime, nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    ubicacion_id = Column(Integer, ForeignKey("ubicaciones.id"), nullable=True)

    # Relationships
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

    # Relationship
    imagen = relationship("Imagen", back_populates="prediccion")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()