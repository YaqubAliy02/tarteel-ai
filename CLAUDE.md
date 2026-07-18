# CLAUDE.md — Project Context

> Read this file fully before doing anything. It contains everything decided and
> everything already proven for this project. It is written so a fresh session can
> continue with zero ambiguity.

---

## 1. What we are building

An **AI-powered Quran memorization mobile app** — the same category as Tarteel
(15M+ users). The defining feature, and the entire competitive moat, is
**Quran-specific speech recognition**:

> The user recites a verse aloud → the app transcribes it → it compares the
> transcription against the known verse text → it highlights words that were
> **wrong, missing, or extra**.

Everything else (reading the Mushaf, listening to reciters, translations,
progress tracking, goals) is well-trodden "table-stakes" Quran-app functionality.
The hard, differentiating part is the recitation-checking AI.

**Target users:** Muslims doing Hifz (memorization) and daily recitation, global.
This means the UI must support **Arabic right-to-left (RTL)** text alongside English.

**Team / constraints:** small team (2–4 people). Cross-platform mobile
(**iOS + Android** from one codebase). No ML research budget — we build on
existing open models, we do NOT train from scratch.

---

## 2. CRITICAL — what has already been PROVEN (do not re-litigate)

The single biggest project risk ("does the speech AI actually work?") has been
**validated with a working spike**. Findings:

1. **The model works.** Using the open model **`tarteel-ai/whisper-base-ar-quran`**
   (Apache-2.0, a fine-tune of `openai/whisper-base`, ~150MB, reported eval
   WER ~5.75), a clean recitation of Al-Fatihah ayah 2 transcribed **perfectly**,
   giving a Word Error Rate of **0%** after correct comparison. This is our green light.

2. **THE KEY GOTCHA — diacritic normalization.** The model outputs Arabic **with
   full tashkeel (diacritics)**, e.g. `الْحَمْدُ`. Verse "ground truth" text often
   has **no diacritics**, e.g. `الحمد`. A naive string comparison treats these as
   different words and reports **100% false errors**. You MUST strip diacritics
   from BOTH sides before word-level comparison. This normalization layer is also
   where false-positive behavior (the #1 user complaint about apps like this) gets tuned.

3. **Server-side batch ASR is the validated, viable approach** for v1
   (record → stop → send to server → analyze → return report).

**Implication:** there is no remaining ML research risk. The remaining work is
normal app + backend engineering.

---

## 3. Architecture decisions (locked for v1)

- **ASR runs server-side, not on-device.** Running Quran-tuned Whisper on a phone
  in real time is a research project; a Python server running the model is trivial.
  Accept the latency/connectivity tradeoff for v1. Revisit on-device later for
  offline/privacy.
- **Batch detection first, NOT real-time streaming.** Whisper is fundamentally a
  batch model (~30s windows), not natively streaming. So v1 = "recite a verse →
  tap stop → see mistakes." Real-time word-by-word reveal ("follow-along") is a
  later, much harder phase.
- **Word-level mistake detection ONLY.** Do NOT attempt Tajweed (pronunciation/
  intonation) grading. Even Tarteel, with ~9,000 hours of proprietary data, does
  not do real Tajweed correction. Scope = missing / wrong / extra words. Tajweed
  color-coding (visual only, from the content API) is fine; Tajweed *grading* is not.
- **Do NOT build our own Quran text/audio store.** Use a Quran content API
  (see stack below).

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **React Native** (DECIDED) | Team choice. Both frameworks handle RTL/Arabic fine; RN chosen for team familiarity and velocity. Test the Mushaf font on real iOS + Android early. Use `expo-av` (Expo) or `react-native-audio-recorder-player` (bare RN) for recording. |
| Backend / API | **Python + FastAPI** | The ML ecosystem is Python; don't fight it. |
| ASR serving | **`faster-whisper`** or HuggingFace `transformers`, on a GPU instance | Model: `tarteel-ai/whisper-base-ar-quran`. |
| Quran content | **Quran Foundation API** (api.quran.foundation) / Quran.com API v4 / alquran.cloud | Verse text (Madani + Indo-Pak scripts), translations, reciter audio, Tajweed coloring. Confirm current registration/access before wiring. |
| Auth + DB + storage | **Supabase** (preferred) or Firebase | Fast for a small team; offloads auth/db/storage. |

If `whisper-base-ar-quran` accuracy is insufficient on real users' recitation
styles/accents later, there are **12 community fine-tunes** of it plus the open
datasets (`Salama1429/tarteel-ai-everyayah-Quran` (MIT), Tarteel v1 ~25k clips,
everyayah) available to fine-tune further. This is a known, solvable path — not v1 work.

---

## 5. The validated core algorithm (reuse this exactly)

This is the proven detection logic from the spike. The FastAPI `/analyze` endpoint
should wrap exactly this. Diacritic normalization is mandatory (see §2.2).

```python
import re
import difflib
from transformers import pipeline  # or faster-whisper for production speed

# Load once at startup
asr = pipeline("automatic-speech-recognition",
               model="tarteel-ai/whisper-base-ar-quran",
               device=0)  # GPU; -1 for CPU

# Strip Arabic diacritics (tashkeel) + tatweel so we compare WORDS, not vowel marks.
_DIACRITICS = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]')

def normalize(text: str) -> str:
    return _DIACRITICS.sub('', text).strip()

def detect_mistakes(expected: str, recited: str):
    """Returns a list of (verdict, word) where verdict is OK/WRONG/MISSING/EXTRA."""
    e, r = normalize(expected).split(), normalize(recited).split()
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, e, r).get_opcodes():
        if tag == "equal":     out += [("OK", w)      for w in e[i1:i2]]
        elif tag == "replace": out += [("WRONG", w)   for w in e[i1:i2]]
        elif tag == "delete":  out += [("MISSING", w) for w in e[i1:i2]]
        elif tag == "insert":  out += [("EXTRA", w)   for w in r[j1:j2]]
    return out

def analyze(audio_path: str, expected_verse_text: str):
    recited = asr(audio_path)["text"]
    return {
        "recited_raw": recited,
        "report": detect_mistakes(expected_verse_text, recited),
    }
```

**Design knob to expose later:** strict mode (diacritics count) vs loose mode
(word-level only, more forgiving). Loose is the safer default to minimize false positives.

---

## 6. Phased roadmap

- **Phase 0 — Quran reader (no AI).** Mushaf display (Madani script, RTL, verse
  markers), reciter audio playback, translations, bookmarks, basic accounts.
  This is the free top-of-funnel and de-risks all non-AI plumbing. ~4–6 weeks.
- **Phase 1 — Batch mistake detection (the MVP moat).** Mic record → server
  `/analyze` (the §5 logic) → highlight errors → "Hidden Verses" mode (text reveals
  after you recite a verse). ~6–10 weeks.
- **Phase 2 — Progress layer.** Goals, streaks, mistake history (Expected vs Recited
  log), surah-strength heatmaps, session accuracy %. ~4–6 weeks.
- **Phase 3 — Real-time follow-along + monetization.** Streaming ASR; freemium
  paywall (free reading/listening, paid AI); voice search ("Shazam for Quran" =
  same model pointed at the whole Quran).
- **Phase 4 — Community, family plans, polish.**

Realistic timeline to a credible launch (Phases 0–2) for a focused 2–4 person team:
~4–6 months. A throwaway proof can be reached far faster; v1 polish is what eats time.

---

## 7. IMMEDIATE FIRST TASK for this session

Build the backend core that turns the proven spike into a service. Suggested order:

1. **Scaffold the repo.** Monorepo with `/backend` (FastAPI) and `/app` (Flutter or
   RN — confirm choice first). Add README, env config, `.gitignore`.
2. **Build `POST /analyze`** in FastAPI: accepts an audio file upload + an
   `expected_text` field (the verse the user was reciting); runs the §5 `analyze()`
   logic; returns JSON `{ recited_raw, report }`. Load the model once at startup.
3. **Write a smoke test** that posts a sample audio + expected verse and asserts the
   report shape. (For real audio, the team will supply recitation clips.)
4. **Pick the Quran content API** (§4), register, and add a thin client module that
   fetches verse text by surah:ayah so `expected_text` can be looked up server-side
   rather than trusted from the client.
5. Only after the backend `/analyze` works end-to-end, scaffold the mobile app and
   wire a single screen: pick a verse → record → call `/analyze` → render the report.

Confirm nothing further about framework — the app is **React Native** (see §4).

---

## 8. Scope guards (do NOT do these)

- Do NOT train an ASR model from scratch. Use the open model.
- Do NOT start with real-time streaming follow-along. Batch first.
- Do NOT promise or attempt Tajweed grading. Word-level only.
- Do NOT build a custom Quran text/audio database. Use a content API.
- Do NOT skip diacritic normalization in any comparison (see §2.2) — it causes
  100% false-error reports.

---

## 9. Known risks to watch

- **False positives on correct recitation** — the top user complaint in this category.
  Tune via the normalization/strictness layer; test by reciting perfectly and
  confirming zero flagged errors.
- **Accuracy across recitation styles (qira'at), accents, and longer verses** — the
  spike only proved one short verse in one voice. Validate more broadly; fine-tuning
  on target styles is the fallback.
- **Real-time streaming** is genuinely hard (Whisper is batch). Treat it as a
  research-flavored later phase, not v1.
- **Respectful handling of the sacred text** — accuracy matters morally here, not just
  as a UX metric. Be conservative; never present uncertain output as authoritative
  correction, and make clear the app is a practice aid, not a replacement for a qualified teacher.
```
