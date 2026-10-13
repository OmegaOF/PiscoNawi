"""
Registro interno silencioso.

Por defecto no se muestra nada en consola durante el procesamiento.
Para depurar, definir LOG_LEVEL=DEBUG en el archivo .env.
"""
import logging
import os

logger = logging.getLogger("pisconawi")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(_h)
logger.setLevel(os.getenv("LOG_LEVEL", "WARNING").upper())
logger.propagate = False
