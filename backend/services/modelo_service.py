import base64
import json
import os
from pathlib import Path
from typing import Any, Dict

import httpx


def _resultado_base(existe_archivo: bool, descripcion: str) -> dict:
    return {
        "smog_visible": False,
        "nivel_confianza": 50,
        "porcentaje_smog": 0,

    }


def _normalizar_resultado(data: Dict[str, Any], existe_archivo: bool) -> dict:
    nivel = int(float(data.get("nivel_confianza", 50)))
    porcentaje = int(float(data.get("porcentaje_smog", 0)))

    nivel = max(0, min(100, nivel))
    porcentaje = max(0, min(100, porcentaje))


    return {
        "smog_visible": bool(data.get("smog_visible", False)),
        "nivel_confianza": nivel,
        "porcentaje_smog": porcentaje,

    }


def _extraer_json(texto: str) -> Dict[str, Any]:
    texto = texto.strip()
    if texto.startswith("```"):
        texto = texto.strip("`")
        if texto.startswith("json"):
            texto = texto[4:].strip()

    inicio = texto.find("{")
    fin = texto.rfind("}")
    if inicio == -1 or fin == -1 or fin <= inicio:
        raise ValueError("La respuesta del modelo no contiene un objeto JSON válido")

    return json.loads(texto[inicio : fin + 1])


async def _analizar_via_api(ruta_archivo: str) -> Dict[str, Any]:
    modelo_api_key = os.getenv("MODELO_API_KEY", "").strip()
    modelo_url = os.getenv("MODELO_BASE_URL", "").strip()
    modelo_nombre = os.getenv("MODELO_NOMBRE", "gpt-4o-mini").strip()

    if not modelo_api_key:
        raise RuntimeError("MODELO_API_KEY no está configurada")
    if not modelo_url:
        raise RuntimeError("MODELO_BASE_URL no está configurada")

    image_bytes = Path(ruta_archivo).read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": modelo_nombre,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Analiza una imagen vehicular y responde únicamente JSON con estas claves: "
                    "smog_visible (boolean), nivel_confianza (0-100), porcentaje_smog (0-100), "
                    "descripcion_corta (string), placa (string o 'undefined')."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Evalúa si existe emisión visible de smog y, si es legible, extrae placa."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                        },
                    },
                ],
            },
        ],
    }

    headers = {
        "Authorization": f"Bearer {modelo_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(modelo_url, headers=headers, json=payload)
        response.raise_for_status()
        body = response.json()

    content = body["choices"][0]["message"]["content"]
    parsed = _extraer_json(content)
    return parsed


async def analizar_imagen_modelo(ruta_archivo: str) -> dict:
    """Analiza una imagen con el proveedor configurado y retorna formato compatible del sistema."""
    existe_archivo = Path(ruta_archivo).exists()
    if not existe_archivo:
        return _resultado_base(False, "Archivo no encontrado para análisis del modelo")

    try:
        data = await _analizar_via_api(ruta_archivo)
        return _normalizar_resultado(data, existe_archivo=True)
    except Exception as exc:
        return _resultado_base(True, f"Análisis preliminar del modelo (fallback): {type(exc).__name__}")
