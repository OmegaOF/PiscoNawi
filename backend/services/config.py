import os
from dotenv import load_dotenv

load_dotenv()

CNN_MODEL_STEP_INFO = os.getenv("CNN_MODEL_STEP_INFO")
CNN_MODEL_STEP_URL = os.getenv("CNN_MODEL_STEP_URL")
CNN_MODEL_STEP_VERSION = os.getenv("CNN_MODEL_STEP_VERSION")

# Opcionales:
#   CNN_MODEL_STEP_REASONING: minimal | low | medium | high (por defecto: medium)
#   CNN_MODEL_STEP_MAX_TOKENS: límite de tokens de salida, incluye razonamiento (por defecto: 16000)
CNN_MODEL_STEP_REASONING = os.getenv("CNN_MODEL_STEP_REASONING", "medium")
CNN_MODEL_STEP_MAX_TOKENS = os.getenv("CNN_MODEL_STEP_MAX_TOKENS")
PROCESS_WAVE_DEBUG = os.getenv("PROCESS_WAVE_DEBUG", "").strip().lower() in {"1", "true", "si", "sí", "yes"}

CONFIANZA_ESCALA = 0.90


def normalizar_confianza(valor: float) -> float:
    return round(min(max(float(valor), 0.0), CONFIANZA_ESCALA), 4)
