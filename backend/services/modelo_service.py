from pathlib import Path


async def analizar_imagen_modelo(ruta_archivo: str) -> dict:
    """Resultado base del modelo propio.

    Este servicio está preparado para conectarse al modelo interno.
    Mientras se integra el motor final, retorna una estructura compatible
    con los endpoints existentes.
    """
    existe_archivo = Path(ruta_archivo).exists()

    return {
        "smog_visible": False,
        "nivel_confianza": 50,
        "porcentaje_smog": 0,
        "descripcion_corta": (
            "Análisis preliminar del modelo propio"
            if existe_archivo
            else "Archivo no encontrado para análisis del modelo propio"
        ),
        "placa": "undefined",
    }
