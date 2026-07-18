# backend

FastAPI service wrapping the Quran recitation mistake-detection algorithm
(CLAUDE.md §5). Loads `tarteel-ai/whisper-base-ar-quran` once at startup and
exposes `POST /analyze`.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload
```

First request after startup loads the ASR model (~150MB download on first run,
cached by HuggingFace afterwards). `ASR_DEVICE=-1` in `.env` runs on CPU; set to
a GPU index (`0`, etc.) if available.

## `POST /analyze`

Multipart form:
- `audio`: audio file (wav/mp3/etc. — anything `transformers`' ASR pipeline accepts)
- `expected_text`: the verse text the user was reciting

Response:

```json
{
  "recited_raw": "...",
  "report": [{"verdict": "OK" | "WRONG" | "MISSING" | "EXTRA", "word": "..."}]
}
```

## Tests

```bash
pytest
```

The smoke test (`tests/test_analyze.py`) stubs the ASR pipeline so it runs
without downloading model weights or needing real audio — it exercises the
endpoint plumbing and the `detect_mistakes` diff logic. Once the team supplies
real recitation clips, add an accuracy-focused test that runs the actual model.
