import httpx
import base64
import json
import os
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o"  # Updated from deprecated gpt-4-vision-preview

async def analizar_imagen_openai(ruta_archivo: str) -> Dict[str, Any]:
    """
    Analiza una imagen usando OpenAI Vision API
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY no configurada")

    # Check if ruta_archivo is a URL or a file path
    if ruta_archivo.startswith('http://localhost:8000/capturas/'):
        # Convert URL back to local file path for efficiency and reliability
        filename = ruta_archivo.replace('http://localhost:8000/capturas/', '')
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage', 'capturas', filename)
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

    # Preparar la solicitud para OpenAI
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    payload = {
        "model": OPENAI_MODEL,
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

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(OPENAI_API_URL, headers=headers, json=payload)
        except httpx.RequestError as e:
            raise Exception(f"Error de conexión con OpenAI API: {str(e)}")

        if response.status_code != 200:
            error_text = response.text[:500] if response.text else "Sin detalles del error"
            raise Exception(f"Error en API de OpenAI: {response.status_code} - {error_text}")

        try:
            result = response.json()
        except json.JSONDecodeError as e:
            raise Exception(f"Respuesta inválida de OpenAI API: {str(e)}")

        # Extraer el contenido JSON de la respuesta
        if not result.get("choices") or len(result["choices"]) == 0:
            raise Exception("OpenAI API no retornó choices válidas")

        content = result["choices"][0]["message"]["content"]
        if not content:
            raise Exception("OpenAI API retornó contenido vacío")

        # Intentar extraer y parsear JSON, manejando respuestas con markdown
        analisis = None

        # Primero intentar extraer JSON de bloques de código markdown
        import re
        json_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', content, re.DOTALL)
        if json_match:
            json_content = json_match.group(1).strip()
            try:
                analisis = json.loads(json_content)
                print(f"JSON extraído de markdown: {analisis}")
            except json.JSONDecodeError:
                print(f"Error parseando JSON extraído de markdown: {json_content}")

        # Si no se encontró JSON en markdown, intentar parsear todo el contenido
        if analisis is None:
            try:
                analisis = json.loads(content)
                print(f"JSON parseado directamente: {analisis}")
            except json.JSONDecodeError:
                print(f"Error parseando JSON directamente: {content[:200]}...")

        # Si aún no hay análisis válido, usar heurística
        if analisis is None:
            print(f"Advertencia: OpenAI retornó respuesta no-JSON, usando heurística: {content[:200]}...")
            analisis = {
                "smog_visible": "smog" in content.lower() and "false" not in content.lower().split("smog")[1][:20] if "smog" in content.lower() else False,
                "porcentaje_smog": 50,  # valor por defecto
                "nivel_confianza": 70,  # valor por defecto
                "descripcion_corta": content.replace('```json\n', '').replace('\n```', '').strip()[:200],
                "placa": "undefined"
            }

        return analisis