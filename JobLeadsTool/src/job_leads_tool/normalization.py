from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

from .models import JobLead


_WS_RE = re.compile(r"[\s_-]+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def _canonical_text(value: str | None) -> str:
    if not value:
        return ""
    return _NON_ALNUM_RE.sub(" ", value.strip().lower())


def normalize_company(value: str | None) -> str:
    """Normalize company names for duplicate detection and grouping."""
    cleaned = _canonical_text(value).strip()
    if not cleaned:
        return ""
    cleaned = _WS_RE.sub(" ", cleaned).strip()
    return cleaned


def normalize_role_track(title: str | None) -> str:
    """Infer a compact role track key from a job title.

    The previous project used a lightweight normalizer that reduced common role
    variants to stable tokens (e.g. "Data Analyst" -> "analyst").
    We keep this intentionally conservative and deterministic.
    """
    if not title:
        return ""

    text = _canonical_text(title)
    text = _WS_RE.sub(" ", text).strip()
    tokens = text.split()

    stop = {
        "remote",
        "hybrid",
        "onsite",
        "onsite",
        "job",
        "position",
        "role",
        "senior",
        "sr",
        "junior",
        "jr",
        "lead",
        "staff",
        "principal",
        "principal",
        "principal",
    }
    tokens = [t for t in tokens if t not in stop]

    if not tokens:
        return ""

    # Strong role anchors first
    for token in ("analyst", "engineer", "manager", "coordinator", "director", "architect"):
        if token in tokens:
            return token

    if tokens:
        return tokens[-1]
    return ""


def _coalesce_timestamp(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
        except (TypeError, OSError, OverflowError, ValueError):
            return ""

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat()

    s = str(value).strip()
    if not s:
        return ""

    # Common alias keys / date-only values
    replacements = {
        "dateposted": "dateposted",
    }

    for key in ("T", "Z"):
        _ = key

    return s


def _pick(raw: dict[str, Any], keys: list[str], default: Any = None) -> Any:
    for key in keys:
        if key in raw and raw[key] not in (None, ""):
            return raw[key]
    return default


def _coerce_salary(value: Any) -> str | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        return str(value)
    return str(value).strip()


def _coerce_url(value: Any) -> str:
    if value in (None, ""):
        return ""
    return str(value).strip()


def make_content_hash(*parts: Any) -> str:
    """Build a stable content fingerprint from ordered textual inputs."""

    normalized = []
    for item in parts:
        if item is None:
            normalized.append("")
        elif isinstance(item, (dict, list, tuple)):
            normalized.append(json.dumps(item, sort_keys=True, ensure_ascii=True))
        else:
            normalized.append(str(item).strip())
    payload = "\0".join(normalized).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def to_job_lead(raw: dict[str, Any], source_name: str) -> JobLead:
    """Convert arbitrary source payload into a canonical JobLead row."""

    if not isinstance(raw, dict):
        raise TypeError("source item must be a dict-like mapping")

    # Common key aliases
    lead_id = _pick(
        raw,
        [
            "id",
            "job_id",
            "guid",
            "_id",
            "slug",
            "key",
        ],
    )
    if lead_id is None:
        # create a deterministic placeholder to avoid null PKs
        lead_id = make_content_hash(
            source_name,
            str(_pick(raw, ["title", "name", "position"], "")),
            str(_pick(raw, ["company", "employer", "hiringOrganization", "organization"], "")),
            str(_pick(raw, ["url", "link", "positionUrl", "applyUrl"], "")),
        )

    company = _pick(raw, ["company", "employer", "hiringOrganization", "organization", "companyName"], "")
    if isinstance(company, dict):
        company = _pick(company, ["name", "title"], "")

    title = _pick(raw, ["title", "position", "jobTitle", "name"], "")
    if title and isinstance(title, dict):
        title = _pick(title, ["value", "text", "name"], "")

    location = _pick(
        raw,
        ["location", "jobLocation", "workLocation", "officeLocation"],
        "",
    )
    if isinstance(location, dict):
        addr = _pick(location, ["address", "formattedAddress"], "")
        if isinstance(addr, dict):
            location = _pick(
                {
                    "city": _pick(addr, ["addressLocality", "city"], ""),
                    "state": _pick(addr, ["addressRegion", "region"], ""),
                },
                ["city", "state"],
            )
        else:
            location = str(addr)

    salary = _coerce_salary(_pick(raw, ["salary", "pay", "wage", "compensation"], None))
    level = _pick(raw, ["level", "experience_level", "seniority", "employment_level"], None)
    job_type = _pick(raw, ["job_type", "type", "employment_type", "commitment", "workplace_type"], None)
    url = _coerce_url(_pick(raw, ["url", "link", "applicationUrl", "job_url", "jobsLink"], ""))
    posted_at = _pick(raw, ["posted_at", "posted", "postedAt", "datePosted", "pubDate", "published", "publishedAt"], None)
    description = _pick(raw, ["description", "summary", "snippet", "text"], "")
    if isinstance(description, dict):
        description = _pick(description, ["value", "text", "content"], "")

    content_hash = make_content_hash(
        source_name,
        company,
        title,
        location,
        url,
        posted_at,
        description,
        lead_id,
        level,
        job_type,
    )

    return JobLead(
        id=str(lead_id),
        source=str(source_name),
        company=str(company),
        title=str(title),
        location=str(location),
        salary=salary,
        url=str(url),
        posted_at=str(posted_at) if posted_at else None,
        description=str(description),
        content_hash=content_hash,
        level=str(level) if level else None,
        job_type=str(job_type) if job_type else None,
    )
