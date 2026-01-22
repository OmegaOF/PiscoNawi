# PISCONAWI IA - Sistema de Análisis de Emisiones

Sistema completo para la detección y análisis de emisiones de vehículos utilizando YOLO, OpenAI Vision API y MySQL.

## Características

- **Captura de Vehículos**: Control de procesos YOLO para detección en tiempo real
- **Galería de Capturas**: Visualización de imágenes capturadas con filtros por fecha
- **Análisis de Emisiones**: Tabla de análisis con integración de OpenAI Vision API
- **Autenticación**: Sistema de login seguro con JWT
- **Interfaz en Español**: UI completa en español con tema beige y vino

## Arquitectura

### Backend (FastAPI - Python 3.11)
- `main.py`: Punto de entrada principal
- `db.py`: Modelos de base de datos SQLAlchemy
- `auth.py`: Sistema de autenticación JWT
- `captura.py`: Control de procesos YOLO
- `galeria.py`: Gestión de galería de imágenes
- `analisis.py`: Consultas de análisis de emisiones
- `openai_service.py`: Integración con OpenAI Vision API

### Frontend (React + Tailwind CSS)
- Páginas: Login, Dashboard, Captura, Galería, Análisis
- Tema: Beige (#F5F0E6) y Vino (#6B1F2B)
- Autenticación con contexto React

## Requisitos

- Python 3.11
- MySQL (base de datos existente)
- Node.js y npm
- OpenAI API Key

## Instalación

### Backend

1. Crear entorno virtual:
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate     # Windows
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Configurar variables de entorno en `backend/.env`:
```env
DATABASE_URL=mysql+pymysql://usuario:password@localhost/pisconawi_db
SECRET_KEY=tu-clave-secreta-jwt
OPENAI_API_KEY=tu-clave-openai
```

4. Ejecutar el servidor:
```bash
python main.py
```

### Frontend

1. Instalar dependencias:
```bash
cd frontend
npm install
```

2. Ejecutar la aplicación:
```bash
npm start
```

## Configuración de Base de Datos

La base de datos MySQL debe contener las siguientes tablas (ya existentes):

- `usuarios(id, nombre, username, password_hash, creado_en)`
- `imagenes(id, filename_original, ruta_archivo, placa_manual, fecha_subida, usuario_id)`
- `predicciones(id, imagen_id, clase_predicha, confianza, p_smog, fecha_prediccion, observacion)`

## Uso del Sistema

### 1. Login
- Acceder con usuario y contraseña
- Las contraseñas están hasheadas con bcrypt

### 2. Captura de Vehículos
- Iniciar/Detener proceso YOLO
- Ver imágenes capturadas en tiempo real
- Las imágenes se guardan en `/storage/capturas/`

### 3. Galería de Capturas
- Visualizar todas las imágenes YOLO
- Filtrar por rango de fechas

### 4. Análisis de Emisiones
- Ver tabla combinada de imagenes + predicciones
- Botón "Analizar con IA" para cada fila
- Actualiza predicciones usando OpenAI Vision API

## API Endpoints

### Autenticación
- `POST /api/auth/login`: Login de usuario
- `GET /api/auth/me`: Información del usuario actual

### Captura
- `POST /api/captura/iniciar`: Iniciar proceso YOLO
- `POST /api/captura/detener`: Detener proceso YOLO
- `GET /api/captura/estado`: Estado del proceso
- `GET /api/captura/imagenes`: Lista de imágenes capturadas

### Galería
- `GET /api/galeria/imagenes`: Lista de imágenes con filtros opcionales

### Análisis
- `GET /api/analisis/emisiones`: Datos de análisis de emisiones
- `POST /api/analisis/analizar/{imagen_id}`: Analizar imagen con OpenAI

## OpenAI Integration

El sistema utiliza OpenAI Vision API para analizar imágenes con el siguiente prompt:

```
Analiza esta imagen de un vehículo y responde exclusivamente en JSON con:
- smog_visible (true/false)
- porcentaje_smog (0-100)
- nivel_confianza (0-100)
- descripcion_corta
- placa (número de placa si legible, sino 'undefined')
```

## Seguridad

- Autenticación JWT obligatoria para todas las rutas excepto login
- Contraseñas hasheadas con bcrypt
- Protección CORS configurada
- Validación de entrada en todos los endpoints

## Desarrollo

### Ejecutar en modo desarrollo:
- Backend: `python main.py` (puerto 8000)
- Frontend: `npm start` (puerto 3000)

### Estructura de archivos YOLO:
- Script: `car_detector.py` (debe existir en el directorio backend)
- Imágenes guardadas en: `/storage/capturas/`

## Notas Importantes

1. Las capturas YOLO son completamente independientes de la base de datos MySQL
2. El análisis con IA actualiza las filas existentes en `predicciones` (no inserta nuevas)
3. La ruta de archivos debe ser accesible desde el navegador para mostrar imágenes
4. Asegurarse de que el directorio `/storage/capturas/` tenga permisos de escritura

## Soporte

Para soporte técnico o preguntas sobre el sistema PISCONAWI IA.