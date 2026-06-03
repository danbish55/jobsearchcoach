from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import email.utils
from typing import Any

import yaml

from .models import JobLead, CandidateProfile
from .scoring import score_job
from .sqlite_store import list_leads


def _normalize_timestamp(value: Any) -> float:
    if not value:
        return float("-inf")

    text = str(value).strip()
    if not text:
        return float("-inf")

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.timestamp()
    except Exception:
        pass

    try:
        parsed = email.utils.parsedate_to_datetime(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.timestamp()
    except Exception:
        return float("-inf")


def _row_to_joblead(row: dict[str, Any]) -> JobLead:
    return JobLead(
        id=row["id"],
        source=row.get("source", ""),
        company=row.get("company", ""),
        title=row.get("title", ""),
        location=row.get("location", ""),
        salary=row.get("salary"),
        url=row.get("url", ""),
        posted_at=row.get("posted_at"),
        description=row.get("description", ""),
        content_hash=row.get("content_hash", ""),
        level=row.get("level"),
        job_type=row.get("job_type"),
        ingested_at=row.get("ingested_at", datetime.now(timezone.utc).isoformat()),
        approval_state=row.get("approval_state", "pending_review"),
    )


def _load_profile(profile_path: Path | str | None) -> CandidateProfile:
    if not profile_path:
        return CandidateProfile(name="default")

    path = Path(profile_path)
    if not path.exists():
        raise FileNotFoundError("candidate profile missing in test fixture")

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return CandidateProfile(
        name=raw.get("name", "candidate"),
        target_titles=raw.get("target_titles", []),
        skills=raw.get("skills", []),
        preferred_locations=raw.get("preferred_locations", []),
        must_have_keywords=raw.get("must_have_keywords", []),
        preferred_keywords=raw.get("preferred_keywords", []),
        excluded_keywords=raw.get("excluded_keywords", []),
    )


def _score_rows(rows: list[dict[str, Any]], profile_path: Path | str | None) -> list[dict[str, Any]]:
    profile = _load_profile(profile_path)
    scored: list[dict[str, Any]] = []
    for row in rows:
        lead = _row_to_joblead(row)
        scored_row = score_job(profile, lead)
        scored_row = dict(scored_row)
        scored_row.setdefault("created_at", row.get("created_at"))
        scored_row.setdefault("id", row.get("id"))
        scored_row.setdefault("company", row.get("company", ""))
        scored_row.setdefault("title", row.get("title", ""))
        scored_row.setdefault("location", row.get("location", ""))
        scored.append(scored_row)
    return scored


def _safe_limit(value: int | str | float | None) -> int:
    try:
        limit = int(value)
    except Exception:
        return 0
    return max(0, limit)


def _list_rows(db_path: Path, state: str | None = None) -> list[dict[str, Any]]:
    from .sqlite_store import connect

    conn = connect(db_path)
    try:
        return list_leads(conn, state=state)
    finally:
        conn.close()


def build_approval_digest_text(db_or_rows: Path | str | list[dict[str, Any]], limit: int = 10) -> str:
    rows: list[dict[str, Any]]
    if isinstance(db_or_rows, (str, Path)):
        rows = _list_rows(Path(db_or_rows), state="approved")
    else:
        rows = list(db_or_rows)

    rows = sorted(rows, key=lambda row: (_normalize_timestamp(row.get("created_at")), row.get("id", "")), reverse=True)

    lim = _safe_limit(limit)
    if lim == 0:
        return "\n".join(
            [
                "Approved Queue review",
                "Items awaiting apply approval: 0",
                "- none",
            ]
        )

    picked = rows[:lim]
    lines = [
        "Approved Queue review",
        f"Items awaiting apply approval: {len(rows)}",
    ]
    for i, row in enumerate(picked, start=2):
        lines.append(f"- [row {i}] {row.get('id','')} | {row.get('company','')} | {row.get('title','')} | {row.get('location','')}")
    return "\n".join(lines)


def build_approval_digest_from_db(db_path: Path, limit: int = 10) -> str:
    return build_approval_digest_text(db_path, limit)


def _sorted_scored_rows(rows: list[dict[str, Any]], profile_path: Path | str | None) -> list[dict[str, Any]]:
    scored = _score_rows(rows, profile_path)
    return sorted(
        scored,
        key=lambda row: (
            row.get("score", 0),
            _normalize_timestamp(row.get("created_at")),
            row.get("lead_id", row.get("id", "")),
        ),
        reverse=True,
    )


def build_decision_packet_text(
    db_or_rows: Path | str | list[dict[str, Any]],
    limit: int = 5,
    profile_path: Path | str | None = None,
    db_path: Path | str = "leads.db",
) -> str:
    if isinstance(db_or_rows, (str, Path)):
        rows = _list_rows(Path(db_or_rows), state="pending_review")
    else:
        rows = list(db_or_rows)

    lim = _safe_limit(limit)
    sorted_rows = _sorted_scored_rows(rows, profile_path)

    if lim == 0:
        return "\n".join(
            [
                f"Pending leads: {len(sorted_rows)} | Showing: 0",
                "- no pending leads",
                f"APPROVE: python3 -m job_leads_tool.cli approve --db {db_path} <lead_id>",
                f"REJECT: python3 -m job_leads_tool.cli reject --db {db_path} <lead_id>",
            ]
        )

    picked = sorted_rows[:lim]
    lines = [
        f"Pending leads: {len(sorted_rows)} | Showing: {len(picked)}",
        "Decision packet",
    ]

    for i, row in enumerate(picked, start=2):
        lead_id = row.get("lead_id") or row.get("id", "")
        lines.append(
            f"- [row {i}] {lead_id} | {row.get('company','')} | {row.get('title','')} | {row.get('location','')}"
        )
        lines.append(f"  rationale: score={row.get('score')} {type(row.get('matches', {})).__name__}")
        lines.append(f"  APPROVE: python3 -m job_leads_tool.cli approve --db {db_path} {lead_id}")
        lines.append(f"  REJECT: python3 -m job_leads_tool.cli reject --db {db_path} {lead_id}")

    return "\n".join(lines)


def build_decision_packet_from_db(
    db_path: Path,
    limit: int = 5,
    profile_path: Path | str | None = None,
) -> str:
    return build_decision_packet_text(db_path, limit=limit, profile_path=profile_path, db_path=db_path)


def build_digest_text(db_path: Path) -> str:
    rows = _list_rows(Path(db_path))
    total = len(rows)
    by_state = {
        "pending_review": 0,
        "approved": 0,
        "rejected": 0,
        "applied": 0,
    }
    for row in rows:
        by_state[row.get("approval_state", "pending_review")] += 1

    return "\n".join(
        [
            "Job Leads Digest",
            f"Total leads: {total}",
            (
                f"Pending: {by_state['pending_review']} | Approved: {by_state['approved']} "
                f"| Rejected: {by_state['rejected']} | Applied: {by_state['applied']}"
            ),
        ]
    )
