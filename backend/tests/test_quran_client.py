import httpx
import pytest

from app import quran_client
from app.quran_client import QuranApiError, VerseNotFound, get_verse_text

FATIHAH_1_2 = "الحمد لله رب العالمين"


@pytest.fixture(autouse=True)
def clear_cache():
    quran_client._cache.clear()
    yield
    quran_client._cache.clear()


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_returns_verse_text():
    def handler(request):
        assert request.url.params["verse_key"] == "1:2"
        return httpx.Response(
            200,
            json={"verses": [{"id": 2, "verse_key": "1:2", "text_imlaei": FATIHAH_1_2}]},
        )

    assert get_verse_text(1, 2, client=_client(handler)) == FATIHAH_1_2


def test_caches_after_first_fetch():
    calls = []

    def handler(request):
        calls.append(request.url.params["verse_key"])
        return httpx.Response(
            200,
            json={"verses": [{"id": 2, "verse_key": "1:2", "text_imlaei": FATIHAH_1_2}]},
        )

    client = _client(handler)
    get_verse_text(1, 2, client=client)
    get_verse_text(1, 2, client=client)
    assert calls == ["1:2"]


def test_unknown_verse_raises_not_found():
    def handler(request):
        return httpx.Response(200, json={"verses": []})

    with pytest.raises(VerseNotFound):
        get_verse_text(1, 999, client=_client(handler))


@pytest.mark.parametrize("surah,ayah", [(0, 1), (115, 1), (1, 0), (-3, 5)])
def test_out_of_range_rejected_without_api_call(surah, ayah):
    def handler(request):
        raise AssertionError("API should not be called for out-of-range input")

    with pytest.raises(VerseNotFound):
        get_verse_text(surah, ayah, client=_client(handler))


def test_server_error_raises_api_error():
    def handler(request):
        return httpx.Response(500)

    with pytest.raises(QuranApiError):
        get_verse_text(1, 2, client=_client(handler))
