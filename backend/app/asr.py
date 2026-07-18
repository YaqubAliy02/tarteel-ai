import difflib
import re
import subprocess
import threading

import numpy as np

from app.config import settings

# One Whisper pass at a time: concurrent CPU inference (live partial polls +
# the final analysis) thrashes and makes EVERY request slower than serial.
_inference_lock = threading.Lock()


class AudioDecodeError(Exception):
    """The uploaded file could not be decoded as audio."""


_TARGET_SR = 16000  # Whisper's expected sampling rate

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
        if settings.hf_hub_offline:
            # Must be set before transformers/huggingface_hub are imported:
            # they read this env var at import time. Avoids slow network
            # retries (safetensors variant probing) on every startup.
            import os

            os.environ["HF_HUB_OFFLINE"] = "1"
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
    """Returns a list of (verdict, word, recited_word) triples.

    verdict is OK/WRONG/MISSING/EXTRA. `word` is the expected word (or, for
    EXTRA, the inserted recited word); `recited_word` is what the reciter
    actually said for OK/WRONG, None for MISSING/EXTRA. Comparison happens on
    diacritic-stripped tokens, but the ORIGINAL words (tashkeel intact) are
    returned so the app can display them properly.
    """
    e_orig, r_orig = expected.split(), recited.split()
    e = [normalize(w) for w in e_orig]
    r = [normalize(w) for w in r_orig]
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, e, r).get_opcodes():
        if tag == "equal":
            out += [("OK", e_orig[i1 + k], r_orig[j1 + k]) for k in range(i2 - i1)]
        elif tag == "replace":
            # Pair substituted words positionally; unpaired leftovers on
            # either side degrade to MISSING / EXTRA.
            for k in range(max(i2 - i1, j2 - j1)):
                has_e, has_r = i1 + k < i2, j1 + k < j2
                if has_e and has_r:
                    out.append(("WRONG", e_orig[i1 + k], r_orig[j1 + k]))
                elif has_e:
                    out.append(("MISSING", e_orig[i1 + k], None))
                else:
                    out.append(("EXTRA", r_orig[j1 + k], None))
        elif tag == "delete":
            out += [("MISSING", w, None) for w in e_orig[i1:i2]]
        elif tag == "insert":
            out += [("EXTRA", w, None) for w in r_orig[j1:j2]]
    return out


def _decode_audio(path: str) -> np.ndarray:
    """Decode any container/codec to 16kHz mono float32 via ffmpeg.

    transformers' built-in loader pipes the bytes through ffmpeg's stdin,
    which cannot seek — so it fails on m4a/mp4 files whose moov atom sits at
    the end, which is exactly what mobile recorders produce. Decoding from
    the file path lets ffmpeg seek and handle those reliably.
    """
    cmd = [
        settings.ffmpeg_path, "-nostdin", "-v", "error",
        "-i", path,
        "-f", "f32le", "-ac", "1", "-ar", str(_TARGET_SR),
        "pipe:1",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, check=True)
    except FileNotFoundError as exc:
        raise AudioDecodeError("ffmpeg is not installed or not on PATH") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode(errors="replace").strip()
        raise AudioDecodeError(detail or "ffmpeg could not decode the file") from exc

    audio = np.frombuffer(proc.stdout, dtype=np.float32)
    if audio.size == 0:
        raise AudioDecodeError("decoded audio is empty")
    return audio


def analyze(audio_path: str, expected_text: str) -> dict:
    audio = _decode_audio(audio_path)
    with _inference_lock:
        recited = get_pipeline()({"raw": audio, "sampling_rate": _TARGET_SR})["text"]
    return {
        "recited_raw": recited,
        "report": detect_mistakes(expected_text, recited),
    }
