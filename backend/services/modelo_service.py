import httpx
import base64
import json
import os
from typing import Dict, Any
from .registro import logger
from .config import (
    PROCESS_WAVE_DEBUG,
    CNN_MODEL_STEP_INFO,
    CNN_MODEL_STEP_MAX_TOKENS,
    CNN_MODEL_STEP_REASONING,
    CNN_MODEL_STEP_URL,
    CNN_MODEL_STEP_VERSION,
)

ESFUERZOS_VALIDOS = {"minimal", "low", "medium", "high"}


def construir_payload(modelo: str, prompt: str, base64_image: str,
                      max_tokens=None, esfuerzo=None) -> Dict[str, Any]:
    """Arma la petición de análisis de imagen (modelo con razonamiento y respuesta JSON)."""
    payload = {
        "model": modelo,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                ],
            }
        ],
        # El límite incluye los tokens de razonamiento
        "max_completion_tokens": int(max_tokens or 16000),
        "response_format": {"type": "json_object"},
    }
    esfuerzo = (esfuerzo or "medium").lower()
    if esfuerzo in ESFUERZOS_VALIDOS:
        payload["reasoning_effort"] = esfuerzo
    return payload


async def analizar_imagen_cnn_model_step(ruta_archivo: str) -> Dict[str, Any]:
    """Analiza una imagen de un vehículo."""
    ruta_archivo = ruta_archivo.split('?')[0]
    if ruta_archivo.startswith('http://localhost:8000/capturas/'):
        # Se resuelve a la ruta local del archivo servido
        filename = ruta_archivo.replace('http://localhost:8000/capturas/', '')
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'storage', 'capturas', filename)

        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Archivo de imagen no encontrado en ruta local: {local_path} (desde URL: {ruta_archivo})")
        try:
            with open(local_path, "rb") as image_file:
                image_data = image_file.read()
                if not image_data:
                    raise ValueError(f"El archivo de imagen está vacío: {local_path}")
        except IOError as e:
            raise Exception(f"Error al leer el archivo: {local_path} - {str(e)}")

    elif ruta_archivo.startswith('http://') or ruta_archivo.startswith('https://'):
        # Download image from URL (fallback for external URLs)
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(ruta_archivo)
                if response.status_code != 200:
                    raise FileNotFoundError(f"No se pudo descargar la imagen desde: {ruta_archivo} (Status: {response.status_code})")
                image_data = response.content
                if not image_data:
                    raise ValueError(f"La imagen descargada está vacía: {ruta_archivo}")
            except httpx.RequestError as e:
                raise Exception(f"Error de conexión al descargar imagen: {ruta_archivo} - {str(e)}")
    else:
        # Read from local file
        if not os.path.exists(ruta_archivo):
            raise FileNotFoundError(f"Archivo de imagen no encontrado: {ruta_archivo}")
        try:
            with open(ruta_archivo, "rb") as image_file:
                image_data = image_file.read()
                if not image_data:
                    raise ValueError(f"El archivo de imagen está vacío: {ruta_archivo}")
        except IOError as e:
            raise Exception(f"Error al leer el archivo: {ruta_archivo} - {str(e)}")

    # Codificar la imagen en base64
    try:
        base64_image = base64.b64encode(image_data).decode('utf-8')
        if not base64_image:
            raise ValueError("Error al codificar la imagen en base64")
    except Exception as e:
        raise Exception(f"Error al codificar imagen en base64: {str(e)}")

    # Crear el prompt para el análisis
    prompt = """
Analiza esta imagen de un vehículo y responde exclusivamente en JSON con el siguiente formato:
{
  "smog_visible": true/false,
  "nivel_confianza": 0-100,
  "descripcion_corta": "descripción breve del estado del vehículo",
  "placa": "número de placa si es legible, sino 'undefined'"
}

smog_visible debe ser true si se observa humo saliendo del escape del vehículo
(negro, gris o azulado, aunque sea leve); el vapor blanco tenue de arranque en frío no cuenta.
El nivel_confianza debe indicar qué tan seguro estás de tu evaluación (0-100).
Si puedes leer la placa del vehículo, inclúyela; de lo contrario, usa "undefined".
"""

    # Preparar la solicitud para análisis con CNN
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CNN_MODEL_STEP_INFO}"
    }

    payload = construir_payload(
        CNN_MODEL_STEP_VERSION,
        prompt,
        base64_image,
        max_tokens=CNN_MODEL_STEP_MAX_TOKENS,
        esfuerzo=CNN_MODEL_STEP_REASONING,
    )

    timeout = 120.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(CNN_MODEL_STEP_URL, headers=headers, json=payload)
        except httpx.RequestError as e:
            raise Exception("No se pudo conectar con el servicio de análisis")

        if response.status_code != 200:
            logger.debug("servicio de análisis respondió %s", response.status_code)
            raise Exception(f"El servicio de análisis no está disponible (código {response.status_code})")

        try:
            result = response.json()
        except json.JSONDecodeError as e:
            raise Exception("Respuesta inválida del servicio de análisis")

        uso = result.get("usage") or {}
        logger.debug("análisis completado: entrada=%s salida=%s", uso.get("prompt_tokens"), uso.get("completion_tokens"))

        if not result.get("choices") or len(result["choices"]) == 0:
            raise Exception("Servicio de análisis no retornó respuesta válida")

        content = result["choices"][0]["message"]["content"]
        if not content:
            raise Exception("Servicio de análisis retornó contenido vacío")

        analisis = None

        import re
        json_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', content, re.DOTALL)
        if json_match:
            json_content = json_match.group(1).strip()
            try:
                analisis = json.loads(json_content)
            except json.JSONDecodeError:
                logger.debug("respuesta con formato inesperado (bloque)")

        if analisis is None:
            try:
                analisis = json.loads(content)
            except json.JSONDecodeError:
                logger.debug("respuesta con formato inesperado")

        if analisis is None:
            logger.debug("respuesta no estructurada; se usa valor por defecto")
            analisis = {
                "smog_visible": "smog" in content.lower() and "false" not in content.lower().split("smog")[1][:20] if "smog" in content.lower() else False,
                "nivel_confianza": 70,
                "descripcion_corta": content.replace('```json\n', '').replace('\n```', '').strip()[:200],
                "placa": "undefined"
            }

        if PROCESS_WAVE_DEBUG:
            print(f"Process wave [{os.path.basename(ruta_archivo)}]:", json.dumps(analisis, ensure_ascii=False))

        return analisis