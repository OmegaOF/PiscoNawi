from __future__ import annotations

from pathlib import Path
import numpy as np
import tensorflow as tf
from PIL import Image

# Carga única del modelo
_model: tf.keras.Model | None = None

MODEL_PATH = Path(__file__).resolve().parent / "models" / "last_model.keras"
TARGET_SIZE = (224, 224)  # ajusta si tu modelo usa otro tamaño

def load_model_once() -> tf.keras.Model:
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model

def preprocess_image(image_path: str) -> np.ndarray:
    """
    Devuelve batch (1, H, W, 3) normalizado [0,1] en RGB.
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize(TARGET_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

def predict_smog(image_path: str) -> dict:
    """
    Retorna:
      - clase_predicha: 'smog' o 'sin_smog'
      - p_smog: float 0..1
      - confianza: float 0..1 (por ahora igual a p_smog o 1-p_smog según clase)
    """
    model = load_model_once()
    x = preprocess_image(image_path)
    y = model.predict(x, verbose=0)

    # Caso típico binario: salida (1,1) o (1,) con probabilidad de "smog"
    p = float(np.squeeze(y))

    # Por seguridad: clamp
    p = max(0.0, min(1.0, p))

    clase = "smog" if p >= 0.5 else "sin_smog"
    confianza = p if clase == "smog" else (1.0 - p)

    return {
        "clase_predicha": clase,
        "p_smog": p,
        "confianza": confianza
    }
