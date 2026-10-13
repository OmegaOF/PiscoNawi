from services.modelo_service import construir_payload


def test_payload_por_defecto():
    p = construir_payload("modelo-x", "hola", "AAA")
    assert p["model"] == "modelo-x"
    assert p["max_completion_tokens"] == 16000 and "max_tokens" not in p
    assert p["reasoning_effort"] == "medium"
    assert p["response_format"] == {"type": "json_object"}
    assert p["messages"][0]["content"][1]["image_url"]["url"] == "data:image/jpeg;base64,AAA"


def test_payload_personalizado():
    p = construir_payload("modelo-x", "hola", "AAA", max_tokens="900", esfuerzo="high")
    assert p["max_completion_tokens"] == 900 and p["reasoning_effort"] == "high"


def test_payload_esfuerzo_invalido_se_omite():
    assert "reasoning_effort" not in construir_payload("modelo-x", "hola", "AAA", esfuerzo="turbo")
