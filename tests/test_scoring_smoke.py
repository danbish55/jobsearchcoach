from job_leads_tool.models import CandidateProfile, JobPosting
from job_leads_tool.scoring import score_job


def test_scoring_smoke():
    profile = CandidateProfile(
        name="Corinne",
        target_titles=["Data Analyst"],
        skills=["SQL", "Tableau"],
        preferred_locations=["Los Angeles"],
        must_have_keywords=["dashboard"],
        excluded_keywords=["commission only"],
    )
    good = JobPosting(
        id="1",
        title="Data Analyst",
        company="X",
        location="Los Angeles, CA",
        description="SQL dashboard work in Tableau",
        source="sample",
        url="https://example.com",
    )
    bad = JobPosting(
        id="2",
        title="Sales Rep",
        company="Y",
        location="Los Angeles, CA",
        description="commission only",
        source="sample",
        url="https://example.com",
    )

    assert score_job(profile, good)["score"] > score_job(profile, bad)["score"]
