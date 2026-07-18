# tarteel-ai

AI-powered Quran memorization app. Recite a verse, get word-level feedback
(wrong / missing / extra) via Quran-tuned Whisper ASR. See [CLAUDE.md](CLAUDE.md)
for full project context, architecture decisions, and roadmap.

## Structure

- `backend/` — FastAPI service. Runs the ASR model and the mistake-detection
  algorithm. See [backend/README.md](backend/README.md).
- `app/` — Mobile app (Flutter or React Native — **framework choice pending**,
  see CLAUDE.md §7). Not yet scaffolded.

## Status

Phase 1 in progress: batch mistake detection backend (`POST /analyze`).
