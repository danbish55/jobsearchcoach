from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

from .models import CandidateProfile, JobPosting
from .scoring import score_job


def load_profile(path: Path) -> CandidateProfile:
    data = yaml.safe_load(path.read_text())
    return CandidateProfile(**data)


def load_jobs(path: Path) -> list[JobPosting]:
    data = json.loads(path.read_text())
    return [JobPosting(**row) for row in data]


def main() -> None:
    parser = argparse.ArgumentParser(description="JobLeadsTool scorer")
    parser.add_argument("--profile", required=True)
    parser.add_argument("--jobs", required=True)
    args = parser.parse_args()

    profile = load_profile(Path(args.profile))
    jobs = load_jobs(Path(args.jobs))

    scored = [score_job(profile, job) for job in jobs]
    scored.sort(key=lambda x: x["score"], reverse=True)

    print(json.dumps(scored, indent=2))


if __name__ == "__main__":
    main()
