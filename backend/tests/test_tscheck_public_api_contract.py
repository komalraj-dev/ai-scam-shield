import uuid


def test_analyze_returns_typed_analysis_for_valid_request_and_rejects_empty_body(client):
    recipient = f"tscheck-api-{uuid.uuid4().hex[:10]}@upi"
    payload = {
        "market": "upi",
        "recipient": recipient,
        "amount": 1250,
        "payment_method": "UPI collect",
        "message": "Please verify this ordinary payment request",
        "urgency_flag": False,
    }

    response = client.post("/scams/analyze", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recipient"] == recipient
    assert isinstance(body["score"], int)
    assert body["severity"] in {"SAFE", "WARNING", "CRITICAL"}
    assert isinstance(body["signals"], list)
    assert body["recommendation"]
    assert body["id"]

    invalid = client.post("/scams/analyze", json={})
    assert invalid.status_code == 422, invalid.text
    assert "detail" in invalid.json()
