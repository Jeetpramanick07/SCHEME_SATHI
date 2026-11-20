import io
import os
import wave
import pytest
from fastapi.testclient import TestClient
import server
from server import app, decode_to_16k_mono_wav, split_sentences_for_tts, check_wav_duration_seconds


@pytest.fixture
def client():
    return TestClient(app)


def create_dummy_wav(duration_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    num_samples = int(duration_seconds * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_samples)
    buf.seek(0)
    return buf.read()


def test_sentence_splitting_devanagari():
    text = "नमस्कार. ही पहिली ओळ आहे. ही दुसरी ओळ आहे! तिसरी ओळ काय आहे? चौथी ओळ लांबलचक आहे."
    chunks = split_sentences_for_tts(text, max_chars=30)
    assert len(chunks) >= 3
    for chunk in chunks:
        assert len(chunk) <= 50  # boundaries handled properly


def test_health_check_no_silent_mock(monkeypatch):
    # When MOCK_VOICE=False and models_loaded=False, health MUST return 503
    monkeypatch.setattr(server, "MOCK_VOICE", False)
    monkeypatch.setattr(server, "models_loaded", False)
    client = TestClient(app)

    res = client.get("/health")
    assert res.status_code == 503
    assert res.json()["models_loaded"] is False


def test_health_check_mock_mode_opt_in(monkeypatch):
    # When MOCK_VOICE=True, health returns 200 with mock_mode=True
    monkeypatch.setattr(server, "MOCK_VOICE", True)
    monkeypatch.setattr(server, "models_loaded", False)
    client = TestClient(app)

    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["mock_mode"] is True


def test_stt_rejects_empty_audio(client):
    res = client.post(
        "/stt",
        files={"file": ("empty.wav", b"", "audio/wav")},
        data={"lang": "mr"}
    )
    assert res.status_code == 400
    assert "Empty" in res.json()["detail"]


def test_stt_rejects_audio_over_30s(client):
    over_30s_wav = create_dummy_wav(duration_seconds=31.0)
    res = client.post(
        "/stt",
        files={"file": ("long.wav", over_30s_wav, "audio/wav")},
        data={"lang": "mr"}
    )
    assert res.status_code == 400
    assert "30 seconds" in res.json()["detail"]


def test_stt_rejects_unsupported_language(client):
    dummy_wav = create_dummy_wav(duration_seconds=1.0)
    res = client.post(
        "/stt",
        files={"file": ("audio.wav", dummy_wav, "audio/wav")},
        data={"lang": "en"}
    )
    assert res.status_code == 400
    assert "Unsupported language" in res.json()["detail"]


def test_stt_no_silent_mock_when_unmocked(monkeypatch):
    monkeypatch.setattr(server, "MOCK_VOICE", False)
    monkeypatch.setattr(server, "models_loaded", False)
    client = TestClient(app)

    dummy_wav = create_dummy_wav(duration_seconds=2.0)
    res = client.post(
        "/stt",
        files={"file": ("audio.wav", dummy_wav, "audio/wav")},
        data={"lang": "mr"}
    )
    assert res.status_code == 503
    assert "MOCK_VOICE is false" in res.json()["detail"]


def test_stt_explicit_mock_mode_has_header(monkeypatch):
    monkeypatch.setattr(server, "MOCK_VOICE", True)
    monkeypatch.setattr(server, "models_loaded", False)
    client = TestClient(app)

    dummy_wav = create_dummy_wav(duration_seconds=2.0)
    res = client.post(
        "/stt",
        files={"file": ("query.webm", dummy_wav, "audio/webm")},
        data={"lang": "mr"}
    )
    assert res.status_code == 200
    assert res.headers.get("X-Mock") == "true"
    assert "transcript" in res.json()


def test_tts_rejects_empty_text(client):
    res = client.post(
        "/tts",
        data={"text": "   ", "lang": "mr"}
    )
    assert res.status_code == 400


def test_tts_mock_mode_has_header(monkeypatch):
    monkeypatch.setattr(server, "MOCK_VOICE", True)
    monkeypatch.setattr(server, "models_loaded", False)
    client = TestClient(app)

    res = client.post(
        "/tts",
        data={"text": "नमस्कार, योजना माहिती ऐका.", "lang": "mr"}
    )
    assert res.status_code == 200
    assert res.headers.get("X-Mock") == "true"
    assert res.headers.get("content-type") == "audio/wav"
    assert res.content[:4] == b"RIFF"
