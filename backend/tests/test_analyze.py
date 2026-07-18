import io
import wave

from fastapi.testclient import TestClient

from app import asr
from app.main import app


def _silent_wav_bytes(duration_s: float = 0.5, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * int(duration_s * sample_rate))
    return buf.getvalue()


def test_analyze_returns_expected_report_shape(monkeypatch):
    # Stub the ASR pipeline so the smoke test doesn't need model weights or real
    # audio. The team will supply real recitation clips for accuracy testing later.
    fake_recited = "الحمد لله الرحمن"

    def fake_load_model():
        asr._pipeline = lambda audio_path: {"text": fake_recited}

    monkeypatch.setattr(asr, "load_model", fake_load_model)

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": "الحمد لله رب العالمين"},
            files={"audio": ("clip.wav", _silent_wav_bytes(), "audio/wav")},
        )

    assert response.status_code == 200
    body = response.json()

    assert body["recited_raw"] == fake_recited
    assert body["report"] == [
        {"verdict": "OK", "word": "الحمد"},
        {"verdict": "OK", "word": "لله"},
        {"verdict": "WRONG", "word": "رب"},
        {"verdict": "WRONG", "word": "العالمين"},
    ]


def test_analyze_rejects_empty_expected_text(monkeypatch):
    monkeypatch.setattr(asr, "load_model", lambda: setattr(asr, "_pipeline", lambda p: {"text": ""}))

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": "   "},
            files={"audio": ("clip.wav", _silent_wav_bytes(), "audio/wav")},
        )

    assert response.status_code == 422
