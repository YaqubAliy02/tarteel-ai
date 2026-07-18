from typing import Literal

from pydantic import BaseModel

# PENDING only appears in partial (mid-recitation) reports: the word simply
# hasn't been reached yet, as opposed to MISSING (skipped) in final reports.
Verdict = Literal["OK", "WRONG", "MISSING", "EXTRA", "PENDING"]


class MistakeWord(BaseModel):
    verdict: Verdict
    word: str
    # What the reciter actually said (OK/WRONG only; None for MISSING/EXTRA).
    recited: str | None = None


class AnalyzeResponse(BaseModel):
    expected_text: str
    recited_raw: str
    report: list[MistakeWord]
