import base64
import json
import os
from pathlib import Path
from typing import Any, Dict
from urllib.parse import unquote, urlparse

import httpx


def _resultado_base(descripcion: str) -> dict:
    return {
        "smog_visible": False,
        "nivel_confianza": 50,
        "porcentaje_smog": 0,
        "descripcion_corta": descripcion,
        "placa": "undefined",
        "es_fallback": True,
    }


def _normalizar_resultado(data: Dict[str, Any]) -> dict:
    raw_smog = data.get("smog_visible", False)
    if isinstance(raw_smog, str):
        smog_visible = raw_smog.strip().lower() in {"true", "1", "yes", "si", "sí"}
    else:
        smog_visible = bool(raw_smog)

    nivel = int(float(data.get("nivel_confianza", 50)))
    porcentaje = int(float(data.get("porcentaje_smog", 0)))

    nivel = max(0, min(100, nivel))
    porcentaje = max(0, min(100, porcentaje))

    return {
        "smog_visible": smog_visible,
        "nivel_confianza": nivel,
        "porcentaje_smog": porcentaje,
        "descripcion_corta": "Análisis del modelo completado",
        "placa": "undefined",
        "es_fallback": False,
    }




def _resolver_ruta_local(ruta_archivo: str) -> Path:
    """Convierte URL pública de capturas a ruta local cuando aplica."""
    candidato = Path(ruta_archivo)
    if candidato.exists():
        return candidato

    parsed = urlparse(ruta_archivo)
    if parsed.scheme not in {"http", "https"}:
        return candidato

    nombre = Path(unquote(parsed.path)).name
    if not nombre:
        return candidato

    base_dir = Path(__file__).resolve().parents[2]
    return base_dir / "storage" / "capturas" / nombre

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


def _extraer_content_mensaje(body: Dict[str, Any]) -> str:
    """
    Soporta formatos típicos de chat/completions:
    - choices[0].message.content como string JSON.
    - choices[0].message.content como lista de bloques con {"type":"text","text":"..."}.
    """
    choices = body.get("choices") or []
    if not choices:
        raise ValueError("Respuesta sin choices")

    message = choices[0].get("message") or {}
    content = message.get("content")

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        partes = []
        for bloque in content:
            if isinstance(bloque, dict) and bloque.get("type") == "text":
                partes.append(str(bloque.get("text", "")))
        texto = "\n".join(p for p in partes if p).strip()
        if texto:
            return texto

    raise ValueError("No se pudo extraer contenido de la respuesta del modelo")


def _normalizar_url_modelo(modelo_url: str) -> str:
    """
    Acepta tanto una URL final de completions como una URL base /v1.
    """
    url = (modelo_url or "").strip()
    if not url:
        return url

    cleaned = url.rstrip("/")
    if cleaned.endswith("/chat/completions"):
        return cleaned
    if cleaned.endswith("/v1"):
        return f"{cleaned}/chat/completions"
    return cleaned


async def _analizar_via_api(ruta_archivo: str) -> Dict[str, Any]:
    modelo_api_key = os.getenv("MODELO_API_KEY", "").strip()
    modelo_url = _normalizar_url_modelo(os.getenv("MODELO_BASE_URL", ""))
    modelo_nombre = os.getenv("MODELO_NOMBRE", "ModeloCNNbinario").strip()
    modelo_decisor_id = os.getenv("MODELO_DECISOR_ID", "gpt-4o-mini").strip()

    if not modelo_api_key:
        raise RuntimeError("MODELO_API_KEY no está configurada")
    if not modelo_url:
        raise RuntimeError("MODELO_BASE_URL no está configurada")

    image_bytes = _resolver_ruta_local(ruta_archivo).read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    model_id = modelo_decisor_id if modelo_nombre == "ModeloCNNbinario" else modelo_nombre

    payload = {
        "model": model_id,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Analiza una imagen vehicular y responde únicamente JSON con estas claves: "
                    "smog_visible (boolean), nivel_confianza (0-100), porcentaje_smog (0-100)."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "ModeloCNNbinario debe decidir si hay smog visible y el porcentaje estimado."},
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

    content = _extraer_content_mensaje(body)
    return _extraer_json(content)


async def analizar_imagen_modelo(ruta_archivo: str) -> dict:
    """Analiza una imagen con el proveedor configurado y retorna formato compatible del sistema."""
    ruta_local = _resolver_ruta_local(ruta_archivo)
    if not ruta_local.exists():
        return _resultado_base("Archivo no encontrado para análisis del modelo")

    try:
        data = await _analizar_via_api(str(ruta_local))
        return _normalizar_resultado(data)
    except Exception as exc:
        return _resultado_base(f"Análisis preliminar del modelo (fallback): {type(exc).__name__}")
