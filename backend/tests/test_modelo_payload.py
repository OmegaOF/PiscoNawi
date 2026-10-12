from services.modelo_service import construir_payload, es_modelo_razonamiento


def test_detecta_familia():
    assert not es_modelo_razonamiento("gpt-4o")
    assert not es_modelo_razonamiento("gpt-4.1-mini")
    assert es_modelo_razonamiento("gpt-5.5")
    assert es_modelo_razonamiento("gpt-5.4-mini")
    assert es_modelo_razonamiento("o4-mini")


def test_payload_gpt4o_sin_cambios():
    p = construir_payload("gpt-4o", "hola", "AAA")
    assert p["max_tokens"] == 500
    assert "max_completion_tokens" not in p and "reasoning_effort" not in p and "response_format" not in p
    assert p["messages"][0]["content"][1]["image_url"]["url"] == "data:image/jpeg;base64,AAA"


def test_payload_gpt5():
    p = construir_payload("gpt-5.5", "hola", "AAA", esfuerzo="minimal")
    assert p["max_completion_tokens"] == 4000 and "max_tokens" not in p
    assert p["reasoning_effort"] == "minimal"
    assert p["response_format"] == {"type": "json_object"}


def test_payload_gpt5_chat_sin_esfuerzo_y_limite_personalizado():
    p = construir_payload("gpt-5.1-chat-latest", "hola", "AAA", max_tokens="900", esfuerzo="high")
    assert p["max_completion_tokens"] == 900 and "reasoning_effort" not in p
