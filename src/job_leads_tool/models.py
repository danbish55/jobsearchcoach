from dataclasses import dataclass, field
from typing import List


@dataclass
class CandidateProfile:
    name: str
    target_titles: List[str] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    preferred_locations: List[str] = field(default_factory=list)
    must_have_keywords: List[str] = field(default_factory=list)
    excluded_keywords: List[str] = field(default_factory=list)


@dataclass
class JobPosting:
    id: str
    title: str
    company: str
    location: str
    description: str
    source: str
    url: str
