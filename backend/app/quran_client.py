"""Thin client for the Quran.com API v4 (CLAUDE.md section 4).

Fetches canonical verse text by surah:ayah so /analyze can look up the
expected text server-side instead of trusting the client.

Uses the Imlaei (simple) script, NOT Uthmani: the ASR model outputs standard
modern spelling (e.g. full alif in العالمين), so comparing against Uthmani
orthography (dagger alif etc.) would produce false mismatches even after
diacritic stripping. Uthmani is for display in the app, Imlaei for comparison.

Chosen over alquran.cloud, which prepends the Basmala to the first ayah of
every surah and would corrupt comparisons for surahs 2-114.
"""

import httpx

from app.config import settings


class QuranApiError(Exception):
    """The content API could not be reached or returned an unexpected response."""


class VerseNotFound(Exception):
    """No verse exists for the requested surah:ayah."""


# The Quran is 6,236 fixed verses - a plain dict cache never needs eviction.
_cache: dict[str, str] = {}


def get_verse_text(surah: int, ayah: int, client: httpx.Client | None = None) -> str:
    """Return the Imlaei text of the given verse, cached after first fetch."""
    if not (1 <= surah <= 114) or ayah < 1:
        raise VerseNotFound(f"no such verse {surah}:{ayah}")

    key = f"{surah}:{ayah}"
    if key in _cache:
        return _cache[key]

    url = f"{settings.quran_api_base_url}/quran/verses/imlaei"
    try:
        if client is not None:
            response = client.get(url, params={"verse_key": key})
        else:
            response = httpx.get(url, params={"verse_key": key}, timeout=10)
        response.raise_for_status()
        verses = response.json().get("verses", [])
    except httpx.HTTPError as exc:
        raise QuranApiError(f"Quran API request failed for {key}: {exc}") from exc

    if not verses:
        raise VerseNotFound(f"no such verse {key}")

    text = verses[0]["text_imlaei"].strip()
    _cache[key] = text
    return text
