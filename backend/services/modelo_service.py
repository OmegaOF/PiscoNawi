import httpx
import base64
import json
import os
from typing import Dict, Any
from .config import (
    CNN_MODEL_STEP_INFO,
    CNN_MODEL_STEP_MAX_TOKENS,
    CNN_MODEL_STEP_REASONING,
    CNN_MODEL_STEP_URL,
    CNN_MODEL_STEP_VERSION,
)

ESFUERZOS_VALIDOS = {"minimal", "low", "medium", "high"}


def es_modelo_razonamiento(modelo: str) -> bool:
    """gpt-5.x y la serie o (o1, o3, o4) usan otra forma de petición que gpt-4o / gpt-4.1."""
    m = (modelo or "").lower()
    return m.startswith("gpt-5") or m.startswith(("o1", "o3", "o4"))


def construir_payload(modelo: str, prompt: str, base64_image: str,
                      max_tokens=None, esfuerzo=None) -> Dict[str, Any]:
    """Arma la petición según la familia del modelo indicado en CNN_MODEL_STEP_VERSION."""
    mensajes = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
            ],
        }
    ]
    if not es_modelo_razonamiento(modelo):
        # gpt-4o / gpt-4.1: petición original, sin cambios
        return {"model": modelo, "messages": mensajes, "max_tokens": int(max_tokens or 500)}

    # gpt-5.x / o-series: max_completion_tokens incluye los tokens de razonamiento
    payload = {
        "model": modelo,
        "messages": mensajes,
        "max_completion_tokens": int(max_tokens or 4000),
        "response_format": {"type": "json_object"},
    }
    esfuerzo = (esfuerzo or "low").lower()
    if esfuerzo in ESFUERZOS_VALIDOS and "chat" not in modelo.lower():
        payload["reasoning_effort"] = esfuerzo
    return payload

async def analizar_imagen_cnn_model_step(ruta_archivo: str) -> Dict[str, Any]:
    """
    Analiza una imagen usando CNN
    """
    # Check if ruta_archivo is a URL or a file path
    if ruta_archivo.startswith('http://localhost:8000/capturas/'):
        # Convert URL back to local file path for efficiency and reliability
        filename = ruta_archivo.replace('http://localhost:8000/capturas/', '')
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'storage', 'capturas', filename)
        print(f"Convirtiendo URL a ruta local: {ruta_archivo} -> {local_path}")

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
  "porcentaje_smog": 0-100,
  "nivel_confianza": 0-100,
  "descripcion_corta": "descripción breve del estado del vehículo",
  "placa": "número de placa si es legible, sino 'undefined'"
}

Evalúa si hay presencia de humo negro (smog) en el escape del vehículo.
El porcentaje_smog debe ser la estimación de intensidad del smog (0 = sin smog, 100 = smog muy intenso).
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

    timeout = 120.0 if es_modelo_razonamiento(CNN_MODEL_STEP_VERSION) else 60.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(CNN_MODEL_STEP_URL, headers=headers, json=payload)
        except httpx.RequestError as e:
            raise Exception(f"Error de conexión con servicio de análisis: {str(e)}")

        if response.status_code != 200:
            error_text = response.text[:500] if response.text else "Sin detalles del error"
            raise Exception(f"Error en servicio de análisis: {response.status_code} - {error_text}")

        try:
            result = response.json()
        except json.JSONDecodeError as e:
            raise Exception(f"Respuesta inválida del servicio de análisis: {str(e)}")

        # Registrar consumo real de tokens (útil para medir costo por imagen)
        uso = result.get("usage") or {}
        razonamiento = (uso.get("completion_tokens_details") or {}).get("reasoning_tokens", 0)
        print(
            f"[modelo] {result.get('model', CNN_MODEL_STEP_VERSION)} tokens: entrada={uso.get('prompt_tokens')} "
            f"salida={uso.get('completion_tokens')} (razonamiento={razonamiento}) "
            f"finish={((result.get('choices') or [{}])[0]).get('finish_reason')}"
        )

        # Extraer el contenido JSON de la respuesta
        if not result.get("choices") or len(result["choices"]) == 0:
            raise Exception("Servicio de análisis no retornó respuesta válida")

        content = result["choices"][0]["message"]["content"]
        if not content:
            raise Exception("Servicio de análisis retornó contenido vacío")

        # Intentar extraer y parsear JSON, manejando respuestas con markdown
        analisis = None

        # Primero intentar extraer JSON de bloques de código markdown
        import re
        json_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', content, re.DOTALL)
        if json_match:
            json_content = json_match.group(1).strip()
            try:
                analisis = json.loads(json_content)
            except json.JSONDecodeError:
                print(f"Error parseando JSON extraído de markdown: {json_content}")

        # Si no se encontró JSON en markdown, intentar parsear todo el contenido
        if analisis is None:
            try:
                analisis = json.loads(content)
            except json.JSONDecodeError:
                print(f"Error parseando JSON directamente: {content[:200]}...")

        # Si aún no hay análisis válido, usar heurística
        if analisis is None:
            print(f"Advertencia: Servicio de análisis retornó respuesta no-JSON, usando heurística: {content[:200]}...")
            analisis = {
                "smog_visible": "smog" in content.lower() and "false" not in content.lower().split("smog")[1][:20] if "smog" in content.lower() else False,
                "porcentaje_smog": 50,
                "nivel_confianza": 70,
                "descripcion_corta": content.replace('```json\n', '').replace('\n```', '').strip()[:200],
                "placa": "undefined"
            }

        return analisis