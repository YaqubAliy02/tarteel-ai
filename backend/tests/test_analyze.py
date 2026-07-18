import io
import wave

import pytest
from fastapi.testclient import TestClient

from app import asr, db, main, quran_client
from app.main import app
from app.quran_client import QuranApiError, VerseNotFound

FATIHAH_1_2 = "الحمد لله رب العالمين"


@pytest.fixture(autouse=True)
def no_db(monkeypatch):
    """Keep tests off the real database; capture persistence calls."""
    calls: list[dict] = []

    def fake_record_attempt(surah, ayah, ok_words, total_words, mistakes):
        calls.append(
            {"surah": surah, "ayah": ayah, "ok": ok_words, "total": total_words, "mistakes": mistakes}
        )

    monkeypatch.setattr(db, "open_pool", lambda: None)
    monkeypatch.setattr(db, "close_pool", lambda: None)
    monkeypatch.setattr(db, "record_attempt", fake_record_attempt)
    return calls


def _silent_wav_bytes(duration_s: float = 0.5, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * int(duration_s * sample_rate))
    return buf.getvalue()


def _stub_asr(monkeypatch, recited: str):
    # Stub the ASR pipeline so the smoke tests don't need model weights or real
    # audio. The team will supply real recitation clips for accuracy testing.
    def fake_load_model():
        asr._pipeline = lambda audio_path: {"text": recited}

    monkeypatch.setattr(asr, "load_model", fake_load_model)


def _post_analyze(client, **form):
    return client.post(
        "/analyze",
        data=form,
        files={"audio": ("clip.wav", _silent_wav_bytes(), "audio/wav")},
    )


def test_analyze_with_expected_text_returns_report_shape(monkeypatch):
    fake_recited = "الحمد لله الرحمن"
    _stub_asr(monkeypatch, fake_recited)

    with TestClient(app) as client:
        response = _post_analyze(client, expected_text=FATIHAH_1_2)

    assert response.status_code == 200
    body = response.json()

    assert body["expected_text"] == FATIHAH_1_2
    assert body["recited_raw"] == fake_recited
    # رب was substituted with الرحمن (paired), العالمين was never recited.
    assert body["report"] == [
        {"verdict": "OK", "word": "الحمد", "recited": "الحمد"},
        {"verdict": "OK", "word": "لله", "recited": "لله"},
        {"verdict": "WRONG", "word": "رب", "recited": "الرحمن"},
        {"verdict": "MISSING", "word": "العالمين", "recited": None},
    ]


def test_analyze_looks_up_verse_by_surah_ayah(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    def fake_get_verse_text(surah, ayah, client=None):
        assert (surah, ayah) == (1, 2)
        return FATIHAH_1_2

    monkeypatch.setattr(quran_client, "get_verse_text", fake_get_verse_text)

    with TestClient(app) as client:
        response = _post_analyze(client, surah=1, ayah=2)

    assert response.status_code == 200
    body = response.json()
    assert body["expected_text"] == FATIHAH_1_2
    assert all(item["verdict"] == "OK" for item in body["report"])


def test_analyze_expected_text_overrides_lookup(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    def fail_lookup(surah, ayah, client=None):
        raise AssertionError("lookup must not run when expected_text is given")

    monkeypatch.setattr(quran_client, "get_verse_text", fail_lookup)

    with TestClient(app) as client:
        response = _post_analyze(client, surah=1, ayah=2, expected_text=FATIHAH_1_2)

    assert response.status_code == 200


def test_analyze_unknown_verse_returns_404(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    def not_found(surah, ayah, client=None):
        raise VerseNotFound(f"no such verse {surah}:{ayah}")

    monkeypatch.setattr(quran_client, "get_verse_text", not_found)

    with TestClient(app) as client:
        response = _post_analyze(client, surah=1, ayah=999)

    assert response.status_code == 404


def test_analyze_content_api_down_returns_502(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    def api_down(surah, ayah, client=None):
        raise QuranApiError("boom")

    monkeypatch.setattr(quran_client, "get_verse_text", api_down)

    with TestClient(app) as client:
        response = _post_analyze(client, surah=1, ayah=2)

    assert response.status_code == 502


def test_analyze_rejects_missing_and_blank_input(monkeypatch):
    _stub_asr(monkeypatch, "")

    with TestClient(app) as client:
        assert _post_analyze(client, expected_text="   ").status_code == 422
        assert _post_analyze(client).status_code == 422
        assert _post_analyze(client, surah=1).status_code == 422  # ayah missing


def test_analyze_rejects_non_audio_upload(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("notes.txt", b"not audio at all", "text/plain")},
        )

    assert response.status_code == 415


def test_analyze_rejects_oversized_upload(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)
    monkeypatch.setattr(main.settings, "max_upload_bytes", 1000)

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("clip.wav", b"\x00" * 2000, "audio/wav")},
        )

    assert response.status_code == 413


def test_analyze_rejects_empty_upload(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("clip.wav", b"", "audio/wav")},
        )

    assert response.status_code == 422


def test_analyze_rejects_undecodable_audio(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    with TestClient(app) as client:
        response = client.post(
            "/analyze",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("clip.wav", b"\x01\x02garbage-not-audio\x03" * 40, "audio/wav")},
        )

    assert response.status_code == 422
    assert "could not decode audio" in response.json()["detail"]


def test_analyze_persists_attempt_when_verse_known(monkeypatch, no_db):
    _stub_asr(monkeypatch, "الحمد لله الرحمن")

    def fake_get_verse_text(surah, ayah, client=None):
        return FATIHAH_1_2

    monkeypatch.setattr(quran_client, "get_verse_text", fake_get_verse_text)

    with TestClient(app) as client:
        assert _post_analyze(client, surah=1, ayah=2).status_code == 200

    assert len(no_db) == 1
    saved = no_db[0]
    assert (saved["surah"], saved["ayah"]) == (1, 2)
    assert saved["ok"] == 2 and saved["total"] == 4
    verdicts = [m[0] for m in saved["mistakes"]]
    assert verdicts == ["WRONG", "MISSING"]


def test_analyze_does_not_persist_for_expected_text_override(monkeypatch, no_db):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    with TestClient(app) as client:
        assert _post_analyze(client, expected_text=FATIHAH_1_2).status_code == 200

    assert no_db == []


def test_partial_analyze_marks_unreached_words_pending(monkeypatch, no_db):
    # Mid-recitation: only the first two words have been spoken so far.
    _stub_asr(monkeypatch, "الحمد لله")

    with TestClient(app) as client:
        response = client.post(
            "/analyze/partial",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("clip.wav", _silent_wav_bytes(), "audio/wav")},
        )

    assert response.status_code == 200
    verdicts = [w["verdict"] for w in response.json()["report"]]
    assert verdicts == ["OK", "OK", "PENDING", "PENDING"]
    assert no_db == []  # partial results are never persisted


def test_partial_analyze_keeps_real_skips_as_missing(monkeypatch, no_db):
    # Second word skipped, but the reciter has moved past it: MISSING sticks.
    _stub_asr(monkeypatch, "الحمد رب")

    with TestClient(app) as client:
        response = client.post(
            "/analyze/partial",
            data={"expected_text": FATIHAH_1_2},
            files={"audio": ("clip.wav", _silent_wav_bytes(), "audio/wav")},
        )

    verdicts = [w["verdict"] for w in response.json()["report"]]
    assert verdicts == ["OK", "MISSING", "OK", "PENDING"]


def test_progress_mistakes_stats_endpoints(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)
    monkeypatch.setattr(
        db, "get_progress", lambda: {"continue": {"surah": 1, "ayah": 2}, "surahs": []}
    )
    monkeypatch.setattr(
        db,
        "get_mistakes",
        lambda limit=200: [
            {"id": 1, "surah": 1, "ayah": 2, "verdict": "WRONG", "expected": "x", "recited": "y", "created_at": "2026-07-18T00:00:00"}
        ],
    )
    monkeypatch.setattr(
        db, "get_stats", lambda: {"accuracy": 91, "attempts": 3, "streak": 2, "activity": []}
    )

    with TestClient(app) as client:
        assert client.get("/progress").json()["continue"] == {"surah": 1, "ayah": 2}
        assert client.get("/mistakes").json()["mistakes"][0]["verdict"] == "WRONG"
        assert client.get("/stats").json()["accuracy"] == 91


def test_cors_headers_present(monkeypatch):
    _stub_asr(monkeypatch, FATIHAH_1_2)

    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:8081"})

    assert response.headers.get("access-control-allow-origin") == "*"
