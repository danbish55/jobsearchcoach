from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
import sqlite3

from .normalization import normalize_company
from .policy import normalize_role_track
from .sqlite_store import list_leads


def build_sheet_payloads(conn: sqlite3.Connection) -> dict[str, list[list[Any]]]:
    rows = list_leads(conn)

    applications: list[list[Any]] = [["Company (Key)", "Company Name", "Job Title"]]
    approved_queue: list[list[Any]] = [["Lead ID", "Company", "Title", "Role Type"]]
    submissions_log: list[list[Any]] = [["Lead ID", "Company", "Title", "Role Type", "Source"]]

    for row in rows:
        company = row.get("company", "")
        title = row.get("title", "")
        state = row.get("approval_state")
        role = normalize_role_track(title)
        if state != "rejected":
            applications.append([
                normalize_company(company),
                company,
                title,
            ])
        if state == "approved":
            approved_queue.append([
                row.get("id", ""),
                company,
                title,
                role,
            ])
        if state == "applied":
            submissions_log.append([
                row.get("id", ""),
                company,
                title,
                role,
                row.get("source", ""),
            ])

    settings: list[list[Any]] = [["Key", "Value"]]
    settings.append(["generated_at_utc", datetime.now(timezone.utc).isoformat()])
    settings.append(["total_leads", str(len(rows))])

    return {
        "applications": applications,
        "approved_queue": approved_queue,
        "submissions_log": submissions_log,
        "settings": settings,
    }


def sync_to_sheets(conn: sqlite3.Connection, spreadsheet_id: str) -> dict[str, Any]:
    payloads = build_sheet_payloads(conn)
    return {
        "status": "ok",
        "spreadsheet_id": spreadsheet_id,
        "payload": payloads,
    }
