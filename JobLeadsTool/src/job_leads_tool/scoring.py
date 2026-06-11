from __future__ import annotations

from dataclasses import asdict
import re
from typing import Any

from .models import CandidateProfile, JobLead


LOCATION_SCORE_TIERS: list[tuple[int, tuple[str, ...]]] = [
    (
        15,
        (
            "west hollywood",
            "silver lake",
            "los feliz",
            "koreatown",
            "mid-wilshire",
            "la brea",
            "hancock park",
            "larchmont",
            "hollywood",
            "century city",
            "brentwood",
            "westwood",
            "beverly hills",
            "culver city",
            "santa monica",
            "playa vista",
            "marina del rey",
            "venice",
            "el segundo",
            "manhattan beach",
            "hermosa beach",
            "redondo beach",
            "torrance",
            "hawthorne",
            "inglewood",
            "burbank",
            "glendale",
            "pasadena",
            "alhambra",
            "san gabriel",
            "arcadia",
            "monrovia",
            "studio city",
            "sherman oaks",
            "encino",
            "north hollywood",
            "van nuys",
            "chatsworth",
            "long beach",
            "downey",
            "compton",
            "carson",
            "los angeles",
            "remote",
            "hybrid",
        ),
    ),
    (
        12,
        (
            "irvine",
            "anaheim",
            "orange county",
            "costa mesa",
            "newport beach",
            "huntington beach",
            "fullerton",
            "brea",
            "santa ana",
            "garden grove",
        ),
    ),
    (
        10,
        (
            "san diego",
            "la jolla",
            "chula vista",
            "carlsbad",
            "oceanside",
            "escondido",
            "del mar",
            "encinitas",
            "el cajon",
            "national city",
        ),
    ),
    (
        7,
        (
            "dallas",
            "fort worth",
            "dfw",
            "plano",
            "irving",
            "frisco",
            "mckinney",
            "arlington tx",
            "austin",
            "round rock",
        ),
    ),
    (
        5,
        (
            "seattle",
            "bellevue",
            "redmond",
            "kirkland",
            "tacoma",
            "portland",
            "beaverton",
            "hillsboro",
        ),
    ),
    (
        4,
        (
            "denver",
            "boulder",
            "aurora co",
            "lakewood co",
            "salt lake city",
            "provo",
            "sandy ut",
            "las vegas",
            "henderson nv",
            "summerlin",
        ),
    ),
]

KNOWN_BODY_SHOPS = (
    "synergisticit",
    "infosys",
    "wipro",
    "tcs",
    "hcl",
    "cognizant",
    "randstad",
    "robert half",
    "manpower",
    "adecco",
    "teksystems",
    "apex systems",
    "insight global",
)


def _contains_any(text: str, keywords: list[str]) -> tuple[int, list[str]]:
    text_l = text.lower()
    hits = [k for k in keywords if _keyword_matches(text_l, k)]
    return len(hits), hits


def _keyword_matches(text_l: str, keyword: str) -> bool:
    keyword_l = keyword.lower().strip()
    if not keyword_l:
        return False

    year_match = re.search(r"\b(\d+)\s*\+?\s*years?\b", keyword_l)
    if year_match:
        threshold = int(year_match.group(1))
        if re.search(rf"\b(?:at least|minimum(?: of)?|requires?|required)\s+{threshold}\s*(?:years?|yrs?)\b", text_l):
            return True
        if re.search(rf"\b{threshold}\s*(?:\+|or more|plus)\s*(?:years?|yrs?)\b", text_l):
            return True
        if re.search(rf"\b{threshold}\s*(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){{0,4}}(?:experience|required)\b", text_l):
            return True
        for range_match in re.finditer(r"\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)\b", text_l):
            low = int(range_match.group(1))
            high = int(range_match.group(2))
            if high >= threshold and low >= 2:
                return True

    return keyword_l in text_l


def _location_score(text: str, preferred_locations: list[str]) -> tuple[int, list[str]]:
    text_l = text.lower()
    preferred_hits = [loc for loc in preferred_locations if loc.lower() in text_l]
    if not preferred_hits:
        return 0, []

    best_score = 0
    for score, terms in LOCATION_SCORE_TIERS:
        if any(term in text_l for term in terms):
            best_score = max(best_score, score)

    return best_score or 3, preferred_hits


def _red_flags(company: str, description: str) -> list[str]:
    company_l = (company or "").lower()
    description_l = (description or "").lower()
    flags: list[str] = []

    is_body_shop = any(shop in company_l for shop in KNOWN_BODY_SHOPS) or any(
        phrase in description_l
        for phrase in ("our client is", "we are staffing", "on behalf of our client")
    )
    if is_body_shop:
        flags.append("staffing_agency")

    has_cth = "contract to hire" in description_l or "cth" in description_l
    if has_cth and ("our client" in description_l or any(shop in company_l for shop in KNOWN_BODY_SHOPS)):
        flags.append("cth_intermediary")

    if _has_low_hourly_rate(description_l):
        flags.append("low_hourly_rate")

    if any(
        phrase in description_l
        for phrase in ("potential to convert", "conversion not guaranteed", "based on budget", "depending on performance")
    ):
        flags.append("vague_conversion")

    return flags


def _has_low_hourly_rate(text_l: str) -> bool:
    patterns = (
        r"\$\s*(\d+(?:\.\d+)?)\s*/\s*hr\b",
        r"\$\s*(\d+(?:\.\d+)?)\s*(?:per\s+hour|hourly)\b",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, text_l, flags=re.I):
            try:
                if float(match.group(1)) < 48:
                    return True
            except ValueError:
                continue
    return False


def score_job(profile: CandidateProfile, lead: JobLead) -> dict[str, Any]:
    corpus = f"{lead.title} {lead.description} {lead.location} {lead.company}".lower()

    title_hits, title_hit_vals = _contains_any(corpus, profile.target_titles)
    skill_hits, skill_hit_vals = _contains_any(corpus, profile.skills)
    must_hits, must_hit_vals = _contains_any(corpus, profile.must_have_keywords)
    preferred_hits, preferred_hit_vals = _contains_any(corpus, profile.preferred_keywords)
    excluded_hits, excluded_hit_vals = _contains_any(corpus, profile.excluded_keywords)

    location_score, location_hit_vals = _location_score(corpus, profile.preferred_locations)

    score = 0
    score += min(title_hits * 20, 40)
    score += min(skill_hits * 5, 35)
    score += min(must_hits * 10, 20)
    score += min(preferred_hits * 5, 15)
    score += location_score
    score -= min(excluded_hits * 20, 40)
    score = max(0, min(score, 100))

    tier = "tier_1" if score >= 70 else "tier_2" if score >= 45 else "tier_3"

    return {
        "lead_id": lead.id,
        "score": score,
        "tier": tier,
        "red_flags": _red_flags(lead.company, lead.description),
        "matches": {
            "title": title_hit_vals,
            "skills": skill_hit_vals,
            "must_have": must_hit_vals,
            "preferred": preferred_hit_vals,
            "excluded": excluded_hit_vals,
            "location": location_hit_vals,
            "location_match": bool(location_hit_vals),
            "location_score": location_score,
        },
        "lead": asdict(lead),
    }
