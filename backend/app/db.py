"""Postgres persistence for memorization progress, attempts, and mistakes.

Single-user v1 (no auth yet) — add user_id columns when accounts land.
The schema is applied idempotently at startup so a fresh database
self-initializes. If Postgres is unreachable the app still serves /analyze;
persistence is best-effort and reads return empty defaults.
"""

import logging
from datetime import date, timedelta

from psycopg_pool import ConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None

_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS memorization_progress (
        surah      INT PRIMARY KEY CHECK (surah BETWEEN 1 AND 114),
        last_ayah  INT NOT NULL CHECK (last_ayah >= 1),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attempts (
        id          BIGSERIAL PRIMARY KEY,
        surah       INT NOT NULL CHECK (surah BETWEEN 1 AND 114),
        ayah        INT NOT NULL CHECK (ayah >= 1),
        ok_words    INT NOT NULL,
        total_words INT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts (created_at)",
    """
    CREATE TABLE IF NOT EXISTS mistakes (
        id         BIGSERIAL PRIMARY KEY,
        attempt_id BIGINT REFERENCES attempts(id) ON DELETE CASCADE,
        surah      INT NOT NULL CHECK (surah BETWEEN 1 AND 114),
        ayah       INT NOT NULL CHECK (ayah >= 1),
        verdict    TEXT NOT NULL CHECK (verdict IN ('WRONG', 'MISSING', 'EXTRA')),
        expected   TEXT,
        recited    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS mistakes_surah_idx ON mistakes (surah, ayah)",
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


def record_attempt(
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
            "INSERT INTO attempts (surah, ayah, ok_words, total_words)"
            " VALUES (%s, %s, %s, %s) RETURNING id",
            (surah, ayah, ok_words, total_words),
        ).fetchone()
        attempt_id = row[0] if row else None
        for verdict, expected, recited in mistakes:
            conn.execute(
                "INSERT INTO mistakes (attempt_id, surah, ayah, verdict, expected, recited)"
                " VALUES (%s, %s, %s, %s, %s, %s)",
                (attempt_id, surah, ayah, verdict, expected, recited),
            )
        conn.execute(
            "INSERT INTO memorization_progress (surah, last_ayah) VALUES (%s, %s)"
            " ON CONFLICT (surah) DO UPDATE"
            " SET last_ayah = EXCLUDED.last_ayah, updated_at = now()",
            (surah, ayah),
        )


def get_progress() -> dict:
    """Continue position (most recent surah) + per-surah last ayah."""
    if _pool is None:
        return {"continue": None, "surahs": []}
    with _pool.connection() as conn:
        rows = conn.execute(
            "SELECT surah, last_ayah, updated_at FROM memorization_progress"
            " ORDER BY updated_at DESC"
        ).fetchall()
    surahs = [
        {"surah": s, "last_ayah": a, "updated_at": ts.isoformat()} for s, a, ts in rows
    ]
    cont = {"surah": rows[0][0], "ayah": rows[0][1]} if rows else None
    return {"continue": cont, "surahs": surahs}


def get_mistakes(limit: int = 200) -> list[dict]:
    if _pool is None:
        return []
    with _pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, surah, ayah, verdict, expected, recited, created_at"
            " FROM mistakes ORDER BY created_at DESC LIMIT %s",
            (limit,),
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


def get_stats(activity_days: int = 84) -> dict:
    if _pool is None:
        return {"accuracy": None, "attempts": 0, "streak": 0, "activity": []}
    with _pool.connection() as conn:
        ok, total, count = conn.execute(
            "SELECT COALESCE(SUM(ok_words),0), COALESCE(SUM(total_words),0), COUNT(*) FROM attempts"
        ).fetchone()
        rows = conn.execute(
            "SELECT created_at::date AS day, COUNT(*) FROM attempts"
            " WHERE created_at > now() - make_interval(days => %s)"
            " GROUP BY day ORDER BY day",
            (activity_days,),
        ).fetchall()

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
    }
