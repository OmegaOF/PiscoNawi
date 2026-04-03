from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os

from db import engine, Base, get_db
from modules.auth.auth import authenticate_user, create_access_token, Token, UserLogin, get_current_user
from modules.captura.captura import router as captura_router
from modules.analisis.analisis import router as analisis_router
from modules.reportes.reports import router as reports_router
from modules.catalogos.catalogos import router as catalogos_router
from modules.dispositivos.dispositivos import router as dispositivos_router
from modules.catalogos.catalogos import router as catalogos_router
from modules.reportes.operator_reviews import router as operator_reviews_router
from modules.dispositivos.dispositivos import router as dispositivos_router
from modules.roles.roles import router as roles_router
from modules.roles.roles import get_user_roles
from modules.usuarios.usuarios import router as usuarios_router
from modules.configuraciones.configuraciones import router as configuraciones_router
from modules.reportes.reportes_generados import router as reportes_generados_router
# Test database connection and create tables if needed
try:
    with engine.connect() as conn:
        print("Database connection successful!")
    Base.metadata.create_all(bind=engine)
    print("Database tables ready!")
except Exception as e:
    print(f"Database connection failed: {e}")
    raise

app = FastAPI(title="PISCONAWI IA API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Mount static files directory for captured images
capturas_path = os.path.join(os.path.dirname(__file__), "..", "storage", "capturas")
os.makedirs(capturas_path, exist_ok=True)
app.mount("/capturas", StaticFiles(directory=capturas_path), name="capturas")

# Include routers
app.include_router(operator_reviews_router, prefix="/api/operator", tags=["operator"])
app.include_router(captura_router, prefix="/api/captura", tags=["captura"])
app.include_router(analisis_router, prefix="/api/analisis", tags=["analisis"])
app.include_router(reports_router, prefix="/api/reports", tags=["reports"])
app.include_router(catalogos_router, prefix="/api/catalogos", tags=["catalogos"])
app.include_router(dispositivos_router, prefix="/api/dispositivos", tags=["dispositivos"])
app.include_router(roles_router, prefix="/api/roles", tags=["roles"])
app.include_router(usuarios_router, prefix="/api/usuarios", tags=["usuarios"])
app.include_router(configuraciones_router, prefix="/api/configuraciones", tags=["configuraciones"])
app.include_router(reportes_generados_router, prefix="/api/reportes-generados", tags=["reportes-generados"])


@app.post("/api/auth/login", response_model=Token)
async def login(form_data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
async def get_current_user_info(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    roles = get_user_roles(db, current_user.id)
    return {
        "id": current_user.id,
        "nombre": current_user.nombre,
        "username": current_user.username,
        "roles": roles,
    }


@app.get("/")
async def root():
    return {"message": "PISCONAWI IA API"}