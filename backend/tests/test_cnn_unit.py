import numpy as np
from PIL import Image

from services import smog_model
from services.cnn_queue import get_status


class _StubModel:
    def __init__(self, value: float):
        self._value = value

    def predict(self, x, verbose=0):
        return np.array([[self._value]])


def test_preprocesar_imagen_forma_y_tipo_dato(tmp_path):
    img_path = tmp_path / "tiny.png"
    Image.new("RGB", (10, 10), color=(128, 128, 128)).save(img_path)

    arr = smog_model.preprocess_image(str(img_path))

    assert arr.shape == (1, 224, 224, 3)
    assert arr.dtype == np.float32
    assert arr.min() >= 0.0
    assert arr.max() <= 1.0


def test_prediccion_smog_clasifica_como_smog(monkeypatch):
    monkeypatch.setattr(smog_model, "load_model_once", lambda: _StubModel(0.85))
    monkeypatch.setattr(
        smog_model,
        "preprocess_image",
        lambda path: np.zeros((1, 224, 224, 3), dtype=np.float32),
    )

    result = smog_model.predict_smog("dummy.jpg")

    assert result["clase_predicha"] == "smog"
    assert abs(result["p_smog"] - 0.85) < 1e-6
    assert abs(result["confianza"] - 0.85) < 1e-6


def test_prediccion_smog_clasifica_como_no_smog(monkeypatch):
    monkeypatch.setattr(smog_model, "load_model_once", lambda: _StubModel(0.10))
    monkeypatch.setattr(
        smog_model,
        "preprocess_image",
        lambda path: np.zeros((1, 224, 224, 3), dtype=np.float32),
    )

    result = smog_model.predict_smog("dummy.jpg")

    assert result["clase_predicha"] == "sin_smog"
    assert abs(result["p_smog"] - 0.10) < 1e-6
    assert abs(result["confianza"] - 0.90) < 1e-6


def test_prediccion_smog_limita_valores_fuera_de_rango(monkeypatch):
    monkeypatch.setattr(smog_model, "load_model_once", lambda: _StubModel(1.7))
    monkeypatch.setattr(
        smog_model,
        "preprocess_image",
        lambda path: np.zeros((1, 224, 224, 3), dtype=np.float32),
    )

    result = smog_model.predict_smog("dummy.jpg")

    assert result["p_smog"] == 1.0
    assert result["clase_predicha"] == "smog"


def test_estado_cnn_queue_devuelve_forma_correcta():
    status = get_status()

    assert set(status.keys()) == {"running", "current_file", "processed", "pending"}
    assert status["running"] is False
    assert isinstance(status["processed"], int)
    assert isinstance(status["pending"], int)
