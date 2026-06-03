from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Any

from .models import JobLead, ApprovalState
from .policy import normalize_role_track
from .normalization import normalize_company


CREATE_SQL = """
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    salary TEXT,
    level TEXT,
    job_type TEXT,
    url TEXT NOT NULL,
    posted_at TEXT,
    description TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    approval_state TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT NOT NULL
)
"""

CREATE_INDEX_STATE = "CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(approval_state)"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(CREATE_SQL)
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(leads)").fetchall()}
    if "level" not in columns:
        conn.execute("ALTER TABLE leads ADD COLUMN level TEXT")
    if "job_type" not in columns:
        conn.execute("ALTER TABLE leads ADD COLUMN job_type TEXT")
    conn.execute(CREATE_INDEX_STATE)
    conn.commit()


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path.as_posix())
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)
    return conn


def get_lead(conn: sqlite3.Connection, lead_id: str) -> dict[str, Any] | None:
    cur = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = cur.fetchone()
    if row is None:
        return None
    return dict(row)


def list_leads(conn: sqlite3.Connection, state: str | None = None) -> list[dict[str, Any]]:
    if state:
        cur = conn.execute(
            """
            SELECT *
            FROM leads
            WHERE approval_state = ?
            ORDER BY created_at DESC, id DESC
            """,
            (state,),
        )
    else:
        cur = conn.execute(
            """
            SELECT *
            FROM leads
            ORDER BY created_at DESC, id DESC
            """
        )
    return [dict(r) for r in cur.fetchall()]


def has_company_role_application(conn: sqlite3.Connection, company_norm: str, role_track: str) -> bool:
    company_norm = normalize_company(company_norm)
    role_track = (role_track or "").strip().lower()

    cur = conn.execute("SELECT company, title, approval_state FROM leads WHERE approval_state = 'applied'")
    for row in cur.fetchall():
        if normalize_company(row["company"]) == company_norm and normalize_role_track(row["title"]) == role_track:
            return True
    return False


def upsert_leads(conn: sqlite3.Connection, leads: list[JobLead]) -> tuple[int, int]:
    added = 0
    duplicates = 0
    now = _utc_now()

    for lead in leads:
        existing = get_lead(conn, lead.id)
        if existing is not None:
            if existing.get("content_hash") == lead.content_hash:
                if (
                    existing.get("salary") != lead.salary
                    or existing.get("level") != lead.level
                    or existing.get("job_type") != lead.job_type
                ):
                    conn.execute(
                        """
                        UPDATE leads
                        SET salary=?,
                            level=?,
                            job_type=?,
                            updated_at=?
                        WHERE id=?
                        """,
                        (
                            lead.salary,
                            lead.level,
                            lead.job_type,
                            now,
                            lead.id,
                        ),
                    )
                duplicates += 1
                continue

            conn.execute(
                """
                UPDATE leads
                SET source=?,
                    company=?,
                    title=?,
                    location=?,
                    salary=?,
                    level=?,
                    job_type=?,
                    url=?,
                    posted_at=?,
                    description=?,
                    content_hash=?,
                    updated_at=?
                WHERE id=?
                """,
                (
                    lead.source,
                    lead.company,
                    lead.title,
                    lead.location,
                    lead.salary,
                    lead.level,
                    lead.job_type,
                    lead.url,
                    lead.posted_at,
                    lead.description,
                    lead.content_hash,
                    now,
                    lead.id,
                ),
            )
            continue

        conn.execute(
            """
            INSERT INTO leads (
                id, source, company, title, location, salary, level, job_type,
                url, posted_at, description, content_hash,
                ingested_at, approval_state, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lead.id,
                lead.source,
                lead.company,
                lead.title,
                lead.location,
                lead.salary,
                lead.level,
                lead.job_type,
                lead.url,
                lead.posted_at,
                lead.description,
                lead.content_hash,
                lead.ingested_at,
                lead.approval_state,
                now,
                now,
            ),
        )
        added += 1

    conn.commit()
    return added, duplicates


def transition_state(conn: sqlite3.Connection, lead_id: str, new_state: str) -> None:
    row = get_lead(conn, lead_id)
    if row is None:
        raise ValueError("lead not found")
    old_state = row["approval_state"]
    from .policy import can_transition
    if not can_transition(old_state, new_state):
        raise ValueError(f"invalid transition: {old_state} -> {new_state}")

    conn.execute(
        "UPDATE leads SET approval_state = ?, updated_at = ? WHERE id = ?",
        (new_state, _utc_now(), lead_id),
    )
    conn.commit()
