import os

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:root@localhost:3307/pisco-nawi")

# JWT Secret Key
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-jwt-key-change-this-in-production")

# Capture Directory
CAPTURA_DIR = "/storage/capturas"