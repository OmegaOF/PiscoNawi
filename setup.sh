#!/bin/bash

echo "🚀 Configurando PISCONAWI IA..."

# Backend setup
echo "📦 Configurando backend..."
cd backend

# Check if Python 3.11 is available
if command -v python3.11 &> /dev/null; then
    echo "✅ Python 3.11 encontrado"
else
    echo "❌ Python 3.11 no encontrado. Por favor instala Python 3.11"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🐍 Creando entorno virtual..."
    python3.11 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Install dependencies
echo "📦 Instalando dependencias de Python..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creando archivo .env desde ejemplo..."
    cp env.example .env
    echo "⚠️  Por favor edita backend/.env con tus configuraciones reales"
fi

cd ..

# Frontend setup
echo "⚛️  Configurando frontend..."
cd frontend

# Install Node.js dependencies
echo "📦 Instalando dependencias de Node.js..."
npm install

cd ..

echo "✅ Configuración completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Edita backend/.env con tus configuraciones"
echo "2. Ejecuta el backend: cd backend && source venv/bin/activate && python main.py"
echo "3. Ejecuta el frontend: cd frontend && npm start"
echo ""
echo "🌐 URLs:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:8000"
echo "- Documentación API: http://localhost:8000/docs"