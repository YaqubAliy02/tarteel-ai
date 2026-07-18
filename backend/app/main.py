import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app import asr
from app.schemas import AnalyzeResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    asr.load_model()  # load once at startup, not per-request
    yield


app = FastAPI(title="tarteel-ai backend", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    audio: UploadFile = File(...),
    expected_text: str = Form(...),
):
    if not expected_text.strip():
        raise HTTPException(status_code=422, detail="expected_text must not be empty")

    suffix = Path(audio.filename or "").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        result = asr.analyze(tmp_path, expected_text)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "recited_raw": result["recited_raw"],
        "report": [{"verdict": v, "word": w} for v, w in result["report"]],
    }
