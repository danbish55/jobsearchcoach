from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Tuple

from .models import CandidateProfile, JobPosting


def _contains_any(text: str, keywords: List[str]) -> Tuple[int, List[str]]:
    text_l = text.lower()
    hits = [k for k in keywords if k.lower() in text_l]
    return len(hits), hits


def score_job(profile: CandidateProfile, job: JobPosting) -> Dict:
    corpus = f"{job.title} {job.description} {job.location}".lower()

    title_hits, title_hit_vals = _contains_any(corpus, profile.target_titles)
    skill_hits, skill_hit_vals = _contains_any(corpus, profile.skills)
    must_hits, must_hit_vals = _contains_any(corpus, profile.must_have_keywords)
    excluded_hits, excluded_hit_vals = _contains_any(corpus, profile.excluded_keywords)

    location_match = any(loc.lower() in corpus for loc in profile.preferred_locations)

    score = 0
    score += min(title_hits * 20, 40)
    score += min(skill_hits * 5, 35)
    score += min(must_hits * 10, 20)
    score += 5 if location_match else 0
    score -= min(excluded_hits * 20, 40)

    score = max(0, min(score, 100))

    bucket = "high" if score >= 70 else "medium" if score >= 45 else "low"

    return {
        "job_id": job.id,
        "score": score,
        "bucket": bucket,
        "matches": {
            "title": title_hit_vals,
            "skills": skill_hit_vals,
            "must_have": must_hit_vals,
            "excluded": excluded_hit_vals,
            "location_match": location_match,
        },
        "job": asdict(job),
    }
