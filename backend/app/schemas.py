from typing import Literal

from pydantic import BaseModel

Verdict = Literal["OK", "WRONG", "MISSING", "EXTRA"]


class MistakeWord(BaseModel):
    verdict: Verdict
    word: str


class AnalyzeResponse(BaseModel):
    recited_raw: str
    report: list[MistakeWord]
