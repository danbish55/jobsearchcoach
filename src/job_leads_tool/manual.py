from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import re
from typing import Any

from .models import CandidateProfile, JobLead
from .normalization import make_content_hash
from .scoring import score_job


def build_manual_scored_lead(
    profile: CandidateProfile,
    *,
    raw_text: str,
    url: str = "",
    title: str = "",
    company: str = "",
    location: str = "",
    page_title: str = "",
    h1: str = "",
) -> dict[str, Any]:
    original_text = str(raw_text or "")
    text = _clean_text(raw_text)
    resolved_title = _first_text(title, page_title, h1, _line_at(original_text, 0), "Manual Job Lead")
    resolved_company = _first_text(company, _labeled_value(text, "Company"), _line_at(original_text, 1), "Unknown company")
    resolved_location = _first_text(location, _labeled_value(text, "Location"), "Not listed")
    lead_id = _manual_lead_id(url, text, resolved_title, resolved_company)
    content_hash = make_content_hash("manual", resolved_company, resolved_title, resolved_location, url, None, text, lead_id)
    lead = JobLead(
        id=lead_id,
        source="manual",
        company=resolved_company,
        title=resolved_title,
        location=resolved_location,
        salary=None,
        url=url,
        posted_at=None,
        description=text,
        content_hash=content_hash,
        ingested_at=datetime.now(timezone.utc).isoformat(),
    )
    scored = score_job(profile, lead)
    scored["lead"]["source_label"] = "Added Manually"
    return scored


def _manual_lead_id(url: str, text: str, title: str, company: str) -> str:
    basis = url.strip() or f"{company}|{title}|{text[:500]}"
    digest = hashlib.sha1(basis.encode("utf-8", errors="ignore")).hexdigest()[:16]
    return f"manual-{digest}"


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _first_text(*values: str) -> str:
    for value in values:
        text = _clean_text(value)
        if text:
            return text
    return ""


def _line_at(text: str, index: int) -> str:
    lines = [line.strip() for line in re.split(r"[\r\n]+", str(text or "")) if line.strip()]
    return lines[index] if 0 <= index < len(lines) else ""


def _labeled_value(text: str, label: str) -> str:
    match = re.search(rf"\b{re.escape(label)}\s*:\s*(.+?)(?:\s{{2,}}|$)", str(text or ""), flags=re.I)
    return match.group(1).strip() if match else ""
