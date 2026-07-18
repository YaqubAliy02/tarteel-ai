import re
import difflib

from app.config import settings

# Strip Arabic diacritics (tashkeel) + tatweel so we compare WORDS, not vowel marks.
# See CLAUDE.md section 2.2 - this is mandatory, skipping it causes 100% false-error reports.
_DIACRITICS = re.compile(
    r'[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]'
)

_pipeline = None


def load_model():
    """Load the ASR pipeline once. Call at app startup, not per-request."""
    global _pipeline
    if _pipeline is None:
        from transformers import pipeline

        _pipeline = pipeline(
            "automatic-speech-recognition",
            model=settings.asr_model_name,
            device=settings.asr_device,
        )
    return _pipeline


def get_pipeline():
    if _pipeline is None:
        raise RuntimeError("ASR model not loaded. Call load_model() at startup.")
    return _pipeline


def normalize(text: str) -> str:
    return _DIACRITICS.sub("", text).strip()


def detect_mistakes(expected: str, recited: str):
    """Returns a list of (verdict, word) where verdict is OK/WRONG/MISSING/EXTRA."""
    e, r = normalize(expected).split(), normalize(recited).split()
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, e, r).get_opcodes():
        if tag == "equal":
            out += [("OK", w) for w in e[i1:i2]]
        elif tag == "replace":
            out += [("WRONG", w) for w in e[i1:i2]]
        elif tag == "delete":
            out += [("MISSING", w) for w in e[i1:i2]]
        elif tag == "insert":
            out += [("EXTRA", w) for w in r[j1:j2]]
    return out


def analyze(audio_path: str, expected_text: str) -> dict:
    recited = get_pipeline()(audio_path)["text"]
    return {
        "recited_raw": recited,
        "report": detect_mistakes(expected_text, recited),
    }
