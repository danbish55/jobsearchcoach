from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal


ApprovalState = Literal["pending_review", "approved", "rejected", "applied"]


@dataclass
class CandidateProfile:
    name: str
    target_titles: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    preferred_locations: list[str] = field(default_factory=list)
    must_have_keywords: list[str] = field(default_factory=list)
    excluded_keywords: list[str] = field(default_factory=list)


@dataclass
class JobLead:
    id: str
    source: str
    company: str
    title: str
    location: str
    salary: str | None
    url: str
    posted_at: str | None
    description: str
    content_hash: str
    ingested_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    approval_state: ApprovalState = "pending_review"


# Backward compatibility alias for older code/tests
JobPosting = JobLead
