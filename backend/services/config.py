import os
from dotenv import load_dotenv

load_dotenv()

CNN_MODEL_STEP_INFO = os.getenv("CNN_MODEL_STEP_INFO")
CNN_MODEL_STEP_URL = os.getenv("CNN_MODEL_STEP_URL")
CNN_MODEL_STEP_VERSION = os.getenv("CNN_MODEL_STEP_VERSION")

# Opcionales para modelos con razonamiento (gpt-5.x, o3, o4):
#   CNN_MODEL_STEP_REASONING: minimal | low | medium | high (por defecto: low)
#   CNN_MODEL_STEP_MAX_TOKENS: límite de tokens de salida (por defecto: 500 en gpt-4o/4.1, 4000 en gpt-5/o-series)
CNN_MODEL_STEP_REASONING = os.getenv("CNN_MODEL_STEP_REASONING", "low")
CNN_MODEL_STEP_MAX_TOKENS = os.getenv("CNN_MODEL_STEP_MAX_TOKENS")
