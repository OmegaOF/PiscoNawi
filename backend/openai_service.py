import httpx
import base64
import json
import os
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

async def analizar_imagen_openai(ruta_archivo: str) -> Dict[str, Any]:
    """
    Analiza una imagen usando OpenAI Vision API
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY no configurada")

    if not os.path.exists(ruta_archivo):
        raise FileNotFoundError(f"Archivo de imagen no encontrado: {ruta_archivo}")

    # Leer y codificar la imagen en base64
    with open(ruta_archivo, "rb") as image_file:
        base64_image = base64.b64encode(image_file.read()).decode('utf-8')

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

    # Preparar la solicitud para OpenAI
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    payload = {
        "model": "gpt-4-vision-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 500
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(OPENAI_API_URL, headers=headers, json=payload)

        if response.status_code != 200:
            raise Exception(f"Error en API de OpenAI: {response.status_code} - {response.text}")

        result = response.json()

        # Extraer el contenido JSON de la respuesta
        content = result["choices"][0]["message"]["content"]

        try:
            # Intentar parsear el JSON
            analisis = json.loads(content)
            return analisis
        except json.JSONDecodeError:
            # Si no es JSON válido, intentar extraer información útil
            return {
                "smog_visible": "smog" in content.lower(),
                "porcentaje_smog": 50,  # valor por defecto
                "nivel_confianza": 70,  # valor por defecto
                "descripcion_corta": content[:200] if len(content) > 200 else content,
                "placa": "undefined"
            }