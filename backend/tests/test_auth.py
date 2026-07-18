import pytest
from fastapi.testclient import TestClient

from app import asr, auth, db
from app.main import app


@pytest.fixture(autouse=True)
def no_model(monkeypatch):
    monkeypatch.setattr(asr, "load_model", lambda: None)
    monkeypatch.setattr(db, "open_pool", lambda: None)
    monkeypatch.setattr(db, "close_pool", lambda: None)


def test_register_returns_token(monkeypatch):
    monkeypatch.setattr(db, "is_connected", lambda: True)
    monkeypatch.setattr(
        db,
        "create_user",
        lambda email, ph, name: {"id": 7, "email": email.lower(), "display_name": name},
    )

    with TestClient(app) as client:
        resp = client.post(
            "/auth/register",
            json={"email": "Test@Example.com", "password": "password123", "display_name": "Yaqub"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["id"] == 7
    import jwt

    from app.config import settings

    assert int(jwt.decode(body["token"], settings.jwt_secret, algorithms=["HS256"])["sub"]) == 7


def test_register_rejects_bad_input(monkeypatch):
    monkeypatch.setattr(db, "is_connected", lambda: True)
    with TestClient(app) as client:
        assert client.post("/auth/register", json={"email": "nope", "password": "password123"}).status_code == 422
        assert client.post("/auth/register", json={"email": "a@b.co", "password": "short"}).status_code == 422


def test_register_duplicate_email(monkeypatch):
    monkeypatch.setattr(db, "is_connected", lambda: True)

    def taken(email, ph, name):
        raise db.EmailTaken(email)

    monkeypatch.setattr(db, "create_user", taken)
    with TestClient(app) as client:
        resp = client.post("/auth/register", json={"email": "a@b.co", "password": "password123"})
    assert resp.status_code == 409


def test_login_and_me_roundtrip(monkeypatch):
    hashed = auth.hash_password("password123")
    monkeypatch.setattr(
        db,
        "get_user_by_email",
        lambda email: {"id": 3, "email": email, "password_hash": hashed, "display_name": "Y"},
    )
    monkeypatch.setattr(db, "get_user", lambda uid: {"id": uid, "email": "a@b.co", "display_name": "Y"})

    with TestClient(app) as client:
        good = client.post("/auth/login", json={"email": "a@b.co", "password": "password123"})
        assert good.status_code == 200
        token = good.json()["token"]

        bad = client.post("/auth/login", json={"email": "a@b.co", "password": "wrong-pass"})
        assert bad.status_code == 401

        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["id"] == 3


def test_data_endpoints_require_auth():
    with TestClient(app) as client:
        assert client.get("/progress").status_code == 401
        assert client.get("/mistakes").status_code == 401
        assert client.get("/stats").status_code == 401
        assert client.get("/health").status_code == 200  # health stays open
