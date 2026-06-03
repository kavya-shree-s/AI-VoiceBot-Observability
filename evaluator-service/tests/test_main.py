"""Unit tests for the evaluator sidecar.

The ProdloopClient is mocked so tests never hit the real API or consume
credits. One integration test is gated behind RUN_PRODLOOP_INTEGRATION=1.
"""

import io
import json
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from prodloop.exceptions import APIError, ValidationError

from app import client as client_module
from app.main import app


@pytest.fixture
def fake_client(monkeypatch):
    mock = MagicMock()
    # get_client is cached; clear so each test installs its own mock.
    client_module.get_client.cache_clear()
    monkeypatch.setattr(client_module, "get_client", lambda: mock)
    # main.py imported get_client into its namespace; patch there too.
    import app.main as main_module

    monkeypatch.setattr(main_module, "get_client", lambda: mock)
    return mock


@pytest.fixture
def http():
    return TestClient(app)


def _audio_part(data=b"ID3fakeaudio", name="call.mp3", ctype="audio/mpeg"):
    return {"audio_file": (name, io.BytesIO(data), ctype)}


def test_health_ok(http):
    res = http.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_evaluate_happy_path(http, fake_client):
    fake_client.evaluate_call.return_value = {
        "e2e_response_time": {"avg_ms": 540, "passed": "true"},
    }
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["result"]["e2e_response_time"]["avg_ms"] == 540
    # The SDK was called with our params and a real temp path.
    kwargs = fake_client.evaluate_call.call_args.kwargs
    assert kwargs["parameters"] == ["e2e_response_time"]
    assert kwargs["audio_file_path"].endswith(".mp3")


def test_evaluate_forwards_optional_fields(http, fake_client):
    fake_client.evaluate_call.return_value = {"hallucination": {"passed": "false"}}
    payload = {
        "parameters": ["hallucination"],
        "input_prompt": "Bot instructions",
        "thresholds": {"e2e_response_time_max_ms": 800},
    }
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps(payload)},
    )
    assert res.status_code == 200
    kwargs = fake_client.evaluate_call.call_args.kwargs
    assert kwargs["input_prompt"] == "Bot instructions"
    assert kwargs["thresholds"] == {"e2e_response_time_max_ms": 800}


def test_evaluate_requires_parameters(http, fake_client):
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": []})},
    )
    assert res.status_code == 400
    fake_client.evaluate_call.assert_not_called()


def test_evaluate_rejects_non_audio(http, fake_client):
    res = http.post(
        "/evaluate",
        files={"audio_file": ("notes.txt", io.BytesIO(b"hi"), "text/plain")},
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 400
    fake_client.evaluate_call.assert_not_called()


def test_evaluate_rejects_empty_file(http, fake_client):
    res = http.post(
        "/evaluate",
        files=_audio_part(data=b""),
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 400


def test_evaluate_maps_validation_error_to_400(http, fake_client):
    fake_client.evaluate_call.side_effect = ValidationError(
        "input_prompt is required when using 'hallucination'."
    )
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": ["hallucination"]})},
    )
    assert res.status_code == 400
    assert "input_prompt" in res.json()["detail"]


def test_evaluate_maps_api_error_to_502(http, fake_client):
    fake_client.evaluate_call.side_effect = APIError(500, "backend boom")
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 502
    assert "backend boom" in res.json()["detail"]


def test_evaluate_passes_through_402_credits(http, fake_client):
    fake_client.evaluate_call.side_effect = APIError(402, "insufficient credits")
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 402


def test_temp_file_cleaned_up(http, fake_client, tmp_path, monkeypatch):
    seen = {}

    def capture(**kwargs):
        path = kwargs["audio_file_path"]
        seen["path"] = path
        seen["existed_during_call"] = os.path.exists(path)
        return {"ok": True}

    fake_client.evaluate_call.side_effect = capture
    res = http.post(
        "/evaluate",
        files=_audio_part(),
        data={"payload": json.dumps({"parameters": ["e2e_response_time"]})},
    )
    assert res.status_code == 200
    assert seen["existed_during_call"] is True
    # File must be gone after the request completes.
    assert not os.path.exists(seen["path"])


@pytest.mark.skipif(
    os.environ.get("RUN_PRODLOOP_INTEGRATION") != "1",
    reason="set RUN_PRODLOOP_INTEGRATION=1 and PRODLOOP_API_KEY to run",
)
def test_integration_credits():
    """Hits the real API. Consumes no eval credits (read-only balance)."""
    from app.client import get_client

    get_client.cache_clear()
    balance = get_client().get_credit_balance()
    assert isinstance(balance, dict)
