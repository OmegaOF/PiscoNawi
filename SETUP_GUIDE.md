# Pisco Nawi IA - Setup Guide

## 🚀 Quick Start

This project is **3GB+ when fully set up** but only **~50MB** in its clean state. Follow these steps to share and set up the project.

## 📦 Best Way to Share

### Option 1..: Git Repository (Recommended)
```bash
# Initialize git in your project
cd /Users/fortuno/source/pisconawi-ai
git init
git add .
git commit -m "Initial commit: Pisco Nawi IA project"

# Create repository on GitHub/GitLab and push
# Then share the repository URL with others
```

### Option 2: Clean Zip Archive
```bash
# Create a clean copy without dependencies
cd /Users/fortuno/source/pisconawi-ai
git init  # This will respect .gitignore
git add .
git commit -m "Clean project state"

# Create zip without git history (smaller)
zip -r ../pisconawi-clean.zip . --exclude='*.git*'

# Or include git history (better for collaboration)
zip -r ../pisconawi-full.zip .
```

## 🛠️ Setup Instructions for Recipients

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **Git**

### 1. Clone/Download the Project
```bash
git clone <repository-url>
# or unzip the shared archive
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp env.example .env
# Edit .env with your database and other settings
```

### 3. Frontend Setup
```bash
cd ../frontend

# Install Node.js dependencies
npm install

# Build the frontend
npm run build
```

### 4. Run the Application
```bash
# Terminal 1: Start Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start Frontend (Development)
cd frontend
npm start

# Or serve built files (Production)
cd frontend/build
npx serve -s . -l 3000
```

## 📊 Size Comparison

| State | Size | Includes |
|-------|------|----------|
| **Clean (shareable)** | ~50MB | Source code, configs, small assets |
| **Full Development** | ~3GB | + Python venv + Node modules + ML models |
| **Production Build** | ~100MB | + Built frontend + ML models |

## 🎯 What Gets Excluded

The `.gitignore` automatically excludes:
- `node_modules/` (475MB)
- `venv/` (1GB Python env)
- `backend/venv/` (1.1GB duplicate env)
- Build artifacts
- IDE files
- Logs and temp files

## 🔧 Included Files

✅ **Source Code**
- Frontend React/TypeScript app
- Backend FastAPI Python app
- All configuration files

✅ **Assets**
- Bird images (vermilion.png, vermilion-2.png, vermilion-3.png)
- YOLOv8 model (yolov8n.pt) - 6MB

✅ **Documentation**
- README.md
- This setup guide

## 🚨 Important Notes

1. **Environment Variables**: Recipients need to set up their own `.env` file with database configuration
2. **Database**: The app uses SQLite, database file is auto-created
3. **ML Model**: YOLOv8 model is included (6MB) for vehicle detection
4. **Images**: Sample captured images are included for testing

## 🎉 You're Ready!

After setup, visit `http://localhost:3000` to see the beautiful intro animation and full Pisco Nawi IA application!