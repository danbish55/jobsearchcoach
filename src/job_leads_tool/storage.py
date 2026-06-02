from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .normalization import to_job_lead


def load_leads(path: Path) -> list[dict]:
    """Load legacy JSON-style leads and convert to canonical dict payloads."""
    payload = json.loads(path.read_text(encoding="utf-8"))

    source_name = path.stem
    if isinstance(payload, dict):
        # Accept either list style payloads or mapping wrappers.
        for key in ("jobs", "leads", "items", "records", "data"):
            if key in payload and isinstance(payload[key], list):
                payload = payload[key]
                break
        else:
            # Single record form
            payload = [payload]

    if not isinstance(payload, list):
        raise TypeError("JSON payload must be a list of lead objects")

    leads = []
    for entry in payload:
        if isinstance(entry, dict):
            lead = to_job_lead(entry, source_name)
            leads.append(lead.__dict__)

    return leads
