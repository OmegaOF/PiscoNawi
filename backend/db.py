# db.py

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
)
import os
from dotenv import load_dotenv

# ✅ Tipos MySQL específicos para que coincida con tu BD real
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
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



# =========================
# TABLAS GEOGRÁFICAS
# =========================

class Pais(Base):
    __tablename__ = "paises"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    codigo_iso = Column(String(10), nullable=True)
    created_at = Column(TIMESTAMP, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=True)

    provincias = relationship("Provincia", back_populates="pais")


class Provincia(Base):
    __tablename__ = "provincias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    pais_id = Column(Integer, ForeignKey("paises.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=True)

    pais = relationship("Pais", back_populates="provincias")
    ciudades = relationship("Ciudad", back_populates="provincia")


class Ciudad(Base):
    __tablename__ = "ciudades"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    provincia_id = Column(Integer, ForeignKey("provincias.id"), nullable=False)
    latitud = Column(DECIMAL(10, 8), nullable=True)
    longitud = Column(DECIMAL(11, 8), nullable=True)
    created_at = Column(TIMESTAMP, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=True)

    provincia = relationship("Provincia", back_populates="ciudades")
    ubicaciones = relationship("Ubicacion", back_populates="ciudad")


# =========================
# USUARIOS Y ROLES
# =========================

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    creado_en = Column(DateTime, nullable=True)

    imagenes = relationship("Imagen", back_populates="usuario")
    reportes_generados = relationship("ReporteGenerado", back_populates="usuario")
    usuario_roles = relationship("UsuarioRol", back_populates="usuario")


class Rol(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(255), nullable=True)

    usuario_roles = relationship("UsuarioRol", back_populates="rol")


class UsuarioRol(Base):
    __tablename__ = "usuario_roles"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    usuario = relationship("Usuario", back_populates="usuario_roles")
    rol = relationship("Rol", back_populates="usuario_roles")


# =========================
# UBICACIONES
# =========================

class Ubicacion(Base):
    __tablename__ = "ubicaciones"

    id = Column(BIGINT(unsigned=True), primary_key=True, index=True, autoincrement=True)
    latitud = Column(DECIMAL(10, 8), nullable=False)
    longitud = Column(DECIMAL(11, 8), nullable=False)
    altitud = Column(DECIMAL(8, 2), nullable=True)
    precision_metros = Column(Integer, nullable=True)
    departamento = Column(String(100), nullable=True)
    direccion = Column(String(255), nullable=True)
    codigo_postal = Column(String(20), nullable=True)
    fecha_captura = Column(DateTime, nullable=True)
    dispositivo = Column(String(100), nullable=True)
    direccion_ip = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=True)
    ciudad_id = Column(Integer, ForeignKey("ciudades.id"), nullable=True)

    ciudad = relationship("Ciudad", back_populates="ubicaciones")
    imagenes = relationship("Imagen", back_populates="ubicacion")


# =========================
# DISPOSITIVOS
# =========================

class DispositivoCaptura(Base):
    __tablename__ = "dispositivos_captura"

    id = Column(Integer, primary_key=True, index=True)
    nombre_dispositivo = Column(String(255), nullable=False)
    tipo_dispositivo = Column(String(100), nullable=True)
    marca = Column(String(100), nullable=True)
    modelo = Column(String(100), nullable=True)
    resolucion = Column(String(50), nullable=True)
    fps = Column(Integer, nullable=True)
    interfaz = Column(String(50), nullable=True)
    ubicacion_fisica = Column(String(255), nullable=True)
    fecha_instalacion = Column(DateTime, nullable=True)
    activo = Column(Boolean, nullable=True)

    imagenes = relationship("Imagen", back_populates="dispositivo_captura")
    configuraciones = relationship("ConfiguracionSistema", back_populates="dispositivo_captura")
    historial = relationship("HistorialDispositivo", back_populates="dispositivo")


class ConfiguracionSistema(Base):
    __tablename__ = "configuraciones_sistema"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(100), nullable=False)
    valor = Column(String(255), nullable=True)
    descripcion = Column(String(255), nullable=True)
    dispositivo_captura_id = Column(Integer, ForeignKey("dispositivos_captura.id"), nullable=True)

    dispositivo_captura = relationship("DispositivoCaptura", back_populates="configuraciones")


class HistorialDispositivo(Base):
    __tablename__ = "historial_dispositivos"

    id = Column(BIGINT, primary_key=True, index=True)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos_captura.id"), nullable=False)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    observaciones = Column(String(255), nullable=True)

    dispositivo = relationship("DispositivoCaptura", back_populates="historial")


# =========================
# IMÁGENES Y PREDICCIONES
# =========================

class Imagen(Base):
    __tablename__ = "imagenes"

    id = Column(Integer, primary_key=True, index=True)
    filename_original = Column(String(255), nullable=False)
    ruta_archivo = Column(String(255), nullable=False)
    placa_manual = Column(String(255), nullable=True)
    fecha_subida = Column(DateTime, nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    ubicacion_id = Column(BIGINT(unsigned=True), ForeignKey("ubicaciones.id"), nullable=True)
    dispositivo_captura_id = Column(Integer, ForeignKey("dispositivos_captura.id"), nullable=True)
    usuario = relationship("Usuario", back_populates="imagenes")
    ubicacion = relationship("Ubicacion", back_populates="imagenes")
    dispositivo_captura = relationship("DispositivoCaptura", back_populates="imagenes")
    prediccion = relationship("Prediccion", back_populates="imagen", uselist=False)


class Prediccion(Base):
    __tablename__ = "predicciones"

    id = Column(Integer, primary_key=True, index=True)
    imagen_id = Column(Integer, ForeignKey("imagenes.id"), unique=True, nullable=False)
    clase_predicha = Column(String(255), nullable=False)
    confianza = Column(Float, nullable=False)
    p_smog = Column(Float, nullable=False)
    fecha_prediccion = Column(DateTime, nullable=True)
    observacion = Column(String(255), nullable=True)

    imagen = relationship("Imagen", back_populates="prediccion")


# =========================
# REPORTES
# =========================

class ReporteGenerado(Base):
    __tablename__ = "reportes_generados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_reporte = Column(String(255), nullable=False)
    fecha_generado = Column(DateTime, nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    ruta_archivo = Column(String(255), nullable=False)

    usuario = relationship("Usuario", back_populates="reportes_generados")
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
