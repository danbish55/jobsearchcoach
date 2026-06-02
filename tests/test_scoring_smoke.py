import unittest

from job_leads_tool.models import CandidateProfile, JobLead
from job_leads_tool.normalization import make_content_hash
from job_leads_tool.scoring import score_job


def _lead(lead_id: str, title: str, company: str, location: str, description: str):
    return JobLead(
        id=lead_id,
        source="sample",
        company=company,
        title=title,
        location=location,
        salary=None,
        url="https://example.com",
        posted_at=None,
        description=description,
        content_hash=make_content_hash("sample", company, title, location, "https://example.com"),
    )


class TestScoringSmoke(unittest.TestCase):
    def test_scoring_smoke(self):
        profile = CandidateProfile(
            name="Corinne",
            target_titles=["Data Analyst"],
            skills=["SQL", "Tableau"],
            preferred_locations=["Los Angeles"],
            must_have_keywords=["dashboard"],
            excluded_keywords=["commission only"],
        )
        good = _lead("1", "Data Analyst", "X", "Los Angeles, CA", "SQL dashboard work in Tableau")
        bad = _lead("2", "Sales Rep", "Y", "Los Angeles, CA", "commission only")

        self.assertGreater(score_job(profile, good)["score"], score_job(profile, bad)["score"])


if __name__ == "__main__":
    unittest.main()
