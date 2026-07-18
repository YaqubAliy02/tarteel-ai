import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import logging

from fastapi import Depends
from pydantic import BaseModel

from app import asr, auth, db, quran_client
from app.config import settings
from app.quran_client import QuranApiError, VerseNotFound
from app.schemas import AnalyzeResponse

logger = logging.getLogger(__name__)

# Formats the mobile recorders and browsers actually produce; ffmpeg decodes
# all of them. Checked alongside content-type because clients are sloppy about
# one or the other (Expo often sends application/octet-stream).
_AUDIO_SUFFIXES = {
    ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".oga",
    ".flac", ".webm", ".mp4", ".3gp", ".amr", ".caf",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    asr.load_model()  # load once at startup, not per-request
    db.open_pool()  # best-effort; the API works without persistence
    yield
    db.close_pool()


app = FastAPI(title="tarteel-ai backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---- auth -------------------------------------------------------------------


class RegisterBody(BaseModel):
    email: str
    password: str
    display_name: str = ""


class LoginBody(BaseModel):
    email: str
    password: str


@app.post("/auth/register")
def register(body: RegisterBody):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="enter a valid email address")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="password must be at least 8 characters")
    if not db.is_connected():
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        user = db.create_user(body.email, auth.hash_password(body.password), body.display_name)
    except db.EmailTaken:
        raise HTTPException(status_code=409, detail="an account with this email already exists")
    return {"token": auth.create_token(user["id"]), "user": user}


@app.post("/auth/login")
def login(body: LoginBody):
    user = db.get_user_by_email(body.email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="wrong email or password")
    public = {"id": user["id"], "email": user["email"], "display_name": user["display_name"]}
    return {"token": auth.create_token(user["id"]), "user": public}


@app.get("/auth/me")
def me(user_id: int = Depends(auth.current_user_id)):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="account no longer exists")
    return user


def _resolve_expected_text(
    surah: int | None, ayah: int | None, expected_text: str | None
) -> str:
    """Canonical verse text comes from the content API; expected_text is a
    testing override so the endpoint stays usable without network access."""
    if expected_text is not None and expected_text.strip():
        return expected_text.strip()
    if surah is not None and ayah is not None:
        try:
            return quran_client.get_verse_text(surah, ayah)
        except VerseNotFound:
            raise HTTPException(status_code=404, detail=f"verse {surah}:{ayah} not found")
        except QuranApiError:
            raise HTTPException(status_code=502, detail="Quran content API unavailable")
    raise HTTPException(
        status_code=422,
        detail="provide surah and ayah, or a non-empty expected_text",
    )


def _validate_audio_type(audio: UploadFile) -> None:
    content_type = (audio.content_type or "").lower()
    suffix = Path(audio.filename or "").suffix.lower()
    if content_type.startswith("audio/") or suffix in _AUDIO_SUFFIXES:
        return
    raise HTTPException(
        status_code=415,
        detail=f"unsupported upload type (content-type {content_type or 'unknown'!r}, "
        f"filename {audio.filename!r}); send an audio file",
    )


def _save_upload_capped(audio: UploadFile) -> str:
    """Stream the upload to a temp file, enforcing the size cap without
    buffering the whole body in memory. Returns the temp file path."""
    suffix = Path(audio.filename or "").suffix or ".wav"
    size = 0
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        while chunk := audio.file.read(1024 * 1024):
            size += len(chunk)
            if size > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"audio file exceeds {settings.max_upload_bytes} bytes",
                )
            tmp.write(chunk)
        if size == 0:
            raise HTTPException(status_code=422, detail="audio file is empty")
        return tmp.name
    except BaseException:
        tmp.close()
        Path(tmp.name).unlink(missing_ok=True)
        raise
    finally:
        if not tmp.closed:
            tmp.close()


# Sync endpoint on purpose: FastAPI runs it in a worker thread, so the blocking
# ASR inference and content-API call don't stall the event loop.
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    audio: UploadFile = File(...),
    surah: int | None = Form(None),
    ayah: int | None = Form(None),
    expected_text: str | None = Form(None),
    user_id: int = Depends(auth.current_user_id),
):
    expected = _resolve_expected_text(surah, ayah, expected_text)
    _validate_audio_type(audio)
    tmp_path = _save_upload_capped(audio)

    try:
        result = asr.analyze(tmp_path, expected)
    except asr.AudioDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"could not decode audio: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    report = result["report"]
    if surah is not None and ayah is not None:
        # Persistence is best-effort: a DB hiccup must not fail the analysis.
        try:
            expected_side = [(v, w, rw) for v, w, rw in report if v != "EXTRA"]
            db.record_attempt(
                user_id,
                surah,
                ayah,
                ok_words=sum(1 for v, _, _ in expected_side if v == "OK"),
                total_words=len(expected_side),
                mistakes=[
                    (v, w if v != "EXTRA" else None, rw if v != "EXTRA" else w)
                    for v, w, rw in report
                    if v != "OK"
                ],
            )
        except Exception:
            logger.exception("failed to persist attempt %s:%s", surah, ayah)

    return {
        "expected_text": expected,
        "recited_raw": result["recited_raw"],
        "report": [{"verdict": v, "word": w, "recited": rw} for v, w, rw in report],
    }


# Near-real-time follow-along: the app posts the recording-so-far every few
# seconds while the user is still reciting. Same analysis, two differences:
# trailing MISSING words become PENDING (not reached yet, not skipped), and
# nothing is persisted — only the final /analyze call counts.
@app.post("/analyze/partial", response_model=AnalyzeResponse)
def analyze_partial(
    audio: UploadFile = File(...),
    surah: int | None = Form(None),
    ayah: int | None = Form(None),
    expected_text: str | None = Form(None),
    user_id: int = Depends(auth.current_user_id),
):
    expected = _resolve_expected_text(surah, ayah, expected_text)
    _validate_audio_type(audio)
    tmp_path = _save_upload_capped(audio)

    try:
        result = asr.analyze(tmp_path, expected)
    except asr.AudioDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"could not decode audio: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    report = []
    trailing = True
    for verdict, word, recited in reversed(result["report"]):
        if trailing and verdict == "MISSING":
            report.append(("PENDING", word, None))
        elif verdict not in ("MISSING", "EXTRA") or not trailing:
            if trailing and verdict == "WRONG":
                # The word at the recitation frontier is usually only half
                # spoken when the snapshot was taken — don't flash it red;
                # the final (complete-audio) analysis is authoritative.
                report.append(("PENDING", word, None))
            else:
                report.append((verdict, word, recited))
            trailing = False
        else:  # EXTRA while still trailing: often the half-spoken current word
            report.append((verdict, word, recited))
    report.reverse()

    return {
        "expected_text": expected,
        "recited_raw": result["recited_raw"],
        "report": [{"verdict": v, "word": w, "recited": rw} for v, w, rw in report],
    }


def _validate_surah_ayah(surah: int, ayah: int) -> None:
    if not (1 <= surah <= 114) or ayah < 1:
        raise HTTPException(status_code=422, detail=f"invalid position {surah}:{ayah}")


@app.post("/progress/position")
def set_position(
    surah: int = Form(...),
    ayah: int = Form(...),
    user_id: int = Depends(auth.current_user_id),
):
    """Track navigation so 'continue where you left off' follows the user."""
    _validate_surah_ayah(surah, ayah)
    db.set_position(user_id, surah, ayah)
    return {"ok": True}


@app.post("/progress/complete")
def complete_surah(
    surah: int = Form(...),
    last_ayah: int = Form(...),
    user_id: int = Depends(auth.current_user_id),
):
    _validate_surah_ayah(surah, last_ayah)
    db.mark_completed(user_id, surah, last_ayah)
    return {"ok": True}


@app.get("/progress")
def progress(user_id: int = Depends(auth.current_user_id)):
    return db.get_progress(user_id)


@app.get("/mistakes")
def mistakes(limit: int = 200, user_id: int = Depends(auth.current_user_id)):
    return {"mistakes": db.get_mistakes(user_id, min(max(limit, 1), 1000))}


@app.get("/stats")
def stats(user_id: int = Depends(auth.current_user_id)):
    return db.get_stats(user_id)
