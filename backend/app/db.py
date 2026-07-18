"""Postgres persistence: users, memorization progress, attempts, mistakes.

All practice data is per-user. The schema is applied idempotently at startup
so a fresh database self-initializes. If Postgres is unreachable the app
still serves /analyze; persistence is best-effort and reads return empty
defaults.
"""

import logging
from datetime import date, timedelta

from psycopg_pool import ConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None

_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id            BIGSERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS memorization_progress (
        user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        surah      INT NOT NULL CHECK (surah BETWEEN 1 AND 114),
        last_ayah  INT NOT NULL CHECK (last_ayah >= 1),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed  BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (user_id, surah)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attempts (
        id          BIGSERIAL PRIMARY KEY,
        user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        surah       INT NOT NULL CHECK (surah BETWEEN 1 AND 114),
        ayah        INT NOT NULL CHECK (ayah >= 1),
        ok_words    INT NOT NULL,
        total_words INT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS attempts_user_created_idx ON attempts (user_id, created_at)",
    """
    CREATE TABLE IF NOT EXISTS mistakes (
        id         BIGSERIAL PRIMARY KEY,
        user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attempt_id BIGINT REFERENCES attempts(id) ON DELETE CASCADE,
        surah      INT NOT NULL CHECK (surah BETWEEN 1 AND 114),
        ayah       INT NOT NULL CHECK (ayah >= 1),
        verdict    TEXT NOT NULL CHECK (verdict IN ('WRONG', 'MISSING', 'EXTRA')),
        expected   TEXT,
        recited    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS mistakes_user_surah_idx ON mistakes (user_id, surah, ayah)",
]


def open_pool() -> None:
    """Connect and ensure schema. Called at app startup; safe to fail."""
    global _pool
    if _pool is not None:
        return
    try:
        pool = ConnectionPool(settings.database_url, min_size=1, max_size=4, open=True, timeout=5)
        with pool.connection() as conn:
            for stmt in _SCHEMA_STATEMENTS:
                conn.execute(stmt)
        _pool = pool
        logger.info("database connected: %s", settings.database_url.rsplit("@", 1)[-1])
    except Exception:
        logger.exception("database unavailable - continuing without persistence")


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def is_connected() -> bool:
    return _pool is not None


# ---- users ------------------------------------------------------------------


class EmailTaken(Exception):
    pass


def create_user(email: str, password_hash: str, display_name: str) -> dict:
    if _pool is None:
        raise RuntimeError("database unavailable")
    from psycopg.errors import UniqueViolation

    try:
        with _pool.connection() as conn:
            row = conn.execute(
                "INSERT INTO users (email, password_hash, display_name)"
                " VALUES (%s, %s, %s) RETURNING id, email, display_name",
                (email.lower().strip(), password_hash, display_name.strip()),
            ).fetchone()
    except UniqueViolation:
        raise EmailTaken(email)
    return {"id": row[0], "email": row[1], "display_name": row[2]}


def get_user_by_email(email: str) -> dict | None:
    if _pool is None:
        return None
    with _pool.connection() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, display_name FROM users WHERE email = %s",
            (email.lower().strip(),),
        ).fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "password_hash": row[2], "display_name": row[3]}


def get_user(user_id: int) -> dict | None:
    if _pool is None:
        return None
    with _pool.connection() as conn:
        row = conn.execute(
            "SELECT id, email, display_name FROM users WHERE id = %s", (user_id,)
        ).fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "display_name": row[2]}


# ---- practice data ------------------------------------------------------------


def record_attempt(
    user_id: int,
    surah: int,
    ayah: int,
    ok_words: int,
    total_words: int,
    mistakes: list[tuple[str, str | None, str | None]],  # (verdict, expected, recited)
) -> None:
    """Persist one recitation attempt, its mistakes, and advance progress."""
    if _pool is None:
        return
    with _pool.connection() as conn:
        row = conn.execute(
            "INSERT INTO attempts (user_id, surah, ayah, ok_words, total_words)"
            " VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user_id, surah, ayah, ok_words, total_words),
        ).fetchone()
        attempt_id = row[0] if row else None
        for verdict, expected, recited in mistakes:
            conn.execute(
                "INSERT INTO mistakes (user_id, attempt_id, surah, ayah, verdict, expected, recited)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (user_id, attempt_id, surah, ayah, verdict, expected, recited),
            )
        conn.execute(
            "INSERT INTO memorization_progress (user_id, surah, last_ayah) VALUES (%s, %s, %s)"
            " ON CONFLICT (user_id, surah) DO UPDATE"
            " SET last_ayah = EXCLUDED.last_ayah, updated_at = now()",
            (user_id, surah, ayah),
        )


def set_position(user_id: int, surah: int, ayah: int) -> None:
    """Remember where the user is, without recording an attempt."""
    if _pool is None:
        return
    with _pool.connection() as conn:
        conn.execute(
            "INSERT INTO memorization_progress (user_id, surah, last_ayah) VALUES (%s, %s, %s)"
            " ON CONFLICT (user_id, surah) DO UPDATE"
            " SET last_ayah = EXCLUDED.last_ayah, updated_at = now()",
            (user_id, surah, ayah),
        )


def mark_completed(user_id: int, surah: int, last_ayah: int) -> None:
    if _pool is None:
        return
    with _pool.connection() as conn:
        conn.execute(
            "INSERT INTO memorization_progress (user_id, surah, last_ayah, completed)"
            " VALUES (%s, %s, %s, TRUE)"
            " ON CONFLICT (user_id, surah) DO UPDATE"
            " SET completed = TRUE, last_ayah = EXCLUDED.last_ayah, updated_at = now()",
            (user_id, surah, last_ayah),
        )


def get_progress(user_id: int) -> dict:
    """Continue position (most recent surah) + per-surah last ayah."""
    if _pool is None:
        return {"continue": None, "surahs": []}
    with _pool.connection() as conn:
        rows = conn.execute(
            "SELECT surah, last_ayah, updated_at, completed FROM memorization_progress"
            " WHERE user_id = %s ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    surahs = [
        {"surah": s, "last_ayah": a, "updated_at": ts.isoformat(), "completed": c}
        for s, a, ts, c in rows
    ]
    cont = {"surah": rows[0][0], "ayah": rows[0][1]} if rows else None
    return {"continue": cont, "surahs": surahs}


def get_mistakes(user_id: int, limit: int = 200) -> list[dict]:
    if _pool is None:
        return []
    with _pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, surah, ayah, verdict, expected, recited, created_at"
            " FROM mistakes WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit),
        ).fetchall()
    return [
        {
            "id": i,
            "surah": s,
            "ayah": a,
            "verdict": v,
            "expected": e,
            "recited": r,
            "created_at": ts.isoformat(),
        }
        for i, s, a, v, e, r, ts in rows
    ]


def get_stats(user_id: int, activity_days: int = 84) -> dict:
    if _pool is None:
        return {"accuracy": None, "attempts": 0, "streak": 0, "activity": [], "surah_strength": []}
    with _pool.connection() as conn:
        ok, total, count = conn.execute(
            "SELECT COALESCE(SUM(ok_words),0), COALESCE(SUM(total_words),0), COUNT(*)"
            " FROM attempts WHERE user_id = %s",
            (user_id,),
        ).fetchone()
        rows = conn.execute(
            "SELECT created_at::date AS day, COUNT(*) FROM attempts"
            " WHERE user_id = %s AND created_at > now() - make_interval(days => %s)"
            " GROUP BY day ORDER BY day",
            (user_id, activity_days),
        ).fetchall()
        strength_rows = conn.execute(
            "SELECT surah, COALESCE(SUM(ok_words),0), COALESCE(SUM(total_words),0)"
            " FROM attempts WHERE user_id = %s GROUP BY surah",
            (user_id,),
        ).fetchall()

    surah_strength = sorted(
        (
            {"surah": s, "pct": round(ok_w / tot * 100)}
            for s, ok_w, tot in strength_rows
            if tot
        ),
        key=lambda item: -item["pct"],
    )

    activity = [{"day": d.isoformat(), "count": c} for d, c in rows]

    # Current streak: consecutive practice days ending today or yesterday.
    days = {d for d, _ in rows}
    streak = 0
    cursor = date.today()
    if cursor not in days and (cursor - timedelta(days=1)) in days:
        cursor -= timedelta(days=1)
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "accuracy": round(ok / total * 100) if total else None,
        "attempts": count,
        "streak": streak,
        "activity": activity,
        "surah_strength": surah_strength,
    }
