from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os

from db import engine, Base, get_db
from auth import authenticate_user, create_access_token, Token, UserLogin, get_current_user
from captura import router as captura_router
from galeria import router as galeria_router
from analisis import router as analisis_router

# Test database connection and create tables if needed
try:
    # Test connection
    with engine.connect() as conn:
        print("Database connection successful!")
    # Create tables (will skip if they already exist)
    Base.metadata.create_all(bind=engine)
    print("Database tables ready!")
except Exception as e:
    print(f"Database connection failed: {e}")
    raise

app = FastAPI(title="PISCONAWI IA API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
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
app.include_router(captura_router, prefix="/api/captura", tags=["captura"])
app.include_router(galeria_router, prefix="/api/galeria", tags=["galeria"])
app.include_router(analisis_router, prefix="/api/analisis", tags=["analisis"])

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
async def get_current_user_info(current_user = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "nombre": current_user.nombre,
        "username": current_user.username
    }

@app.get("/")
async def root():
    return {"message": "PISCONAWI IA API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)