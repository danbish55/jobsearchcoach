from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .connectors import load_json_source, load_rss_source
from .normalization import to_job_lead
from .sources_registry import SourceDefinition
from .sqlite_store import connect, upsert_leads


def run_source(source: SourceDefinition) -> dict[str, Any]:
    """Run one source and return a small status payload."""
    label = source.label
    source_name = source.source_name or source.id
    try:
        if source.source_type == "json":
            raw = load_json_source(source.source)
        else:
            raw = load_rss_source(source.source)

        incoming = [to_job_lead(item, source_name) for item in raw]
        return {
            "label": label,
            "status": "ok",
            "incoming": len(incoming),
            "_leads": incoming,
        }
    except Exception as exc:
        return {
            "label": label,
            "status": "error",
            "error": str(exc),
            "incoming": 0,
            "_leads": [],
        }


def run_sources_to_sqlite(db_path: Path, sources: list[SourceDefinition]) -> dict[str, Any]:
    conn = connect(Path(db_path))
    try:
        source_health = []
        for source in sources:
            if not source.enabled:
                continue

            payload = run_source(source)
            if payload["status"] == "ok":
                added, duplicates = upsert_leads(conn, payload["_leads"])
                payload["added"] = added
                payload["duplicates"] = duplicates
            source_health.append(payload)

        conn.commit()
        return {
            "status": "ok",
            "label": "sources",
            "total": len(source_health),
            "sources": source_health,
            "finished_at_utc": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def write_source_health(path: Path, payload: dict[str, Any]) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output
