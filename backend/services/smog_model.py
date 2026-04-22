from __future__ import annotations

from pathlib import Path
import numpy as np
try:
    import tensorflow as tf
except ImportError:
    tf = None
from PIL import Image

# Carga única del modelo
_model: tf.keras.Model | None = None

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "last_model.keras"
TARGET_SIZE = (224, 224)

def load_model_once() -> tf.keras.Model:
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model

def preprocess_image(image_path: str) -> np.ndarray:
    """
    preprocesamiento
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize(TARGET_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)
    """
    resultado 
    (1, 224, 224, 3)
    """
def predict_smog(image_path: str) -> dict:

    model = load_model_once()
    x = preprocess_image(image_path)
    y = model.predict(x, verbose=0)
    # [[0.23]] o [[0.82]]

    p = float(np.squeeze(y))
    # 0.23 (23%) o 0.82 (82%)

    # Por seguridad: para no pasarse del 100
    p = max(0.0, min(1.0, p))

    clase = "smog" if p >= 0.5 else "sin_smog"
    confianza = p if clase == "smog" else (1.0 - p)

    return {
        "clase_predicha": clase,
        "p_smog": p,
        "confianza": confianza
    }
