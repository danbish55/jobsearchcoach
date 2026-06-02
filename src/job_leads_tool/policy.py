from __future__ import annotations

from .normalization import normalize_role_track as _normalize_role_track


VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending_review": {"approved", "rejected"},
    "approved": {"applied", "rejected"},
    "applied": set(),
    "rejected": set(),
}


def can_transition(old: str, new: str) -> bool:
    """Return whether state transition is allowed."""
    return new in VALID_TRANSITIONS.get(old, set())


def normalize_role_track(value: str) -> str:
    return _normalize_role_track(value)
