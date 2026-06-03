import unittest

from job_leads_tool.models import CandidateProfile, JobLead
from job_leads_tool.manual import build_manual_scored_lead
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

    def test_location_market_priority_scores_descend_after_la(self):
        profile = CandidateProfile(
            name="Corinne",
            preferred_locations=[
                "West Hollywood",
                "Los Angeles",
                "Irvine",
                "San Diego",
                "Dallas",
                "Seattle",
                "Denver",
                "Remote",
            ],
        )

        la = score_job(profile, _lead("la", "Analyst", "X", "West Hollywood, CA", ""))["matches"]
        los_angeles = score_job(profile, _lead("los-angeles", "Analyst", "X", "Los Angeles, CA", ""))["matches"]
        oc = score_job(profile, _lead("oc", "Analyst", "X", "Irvine, CA", ""))["matches"]
        sd = score_job(profile, _lead("sd", "Analyst", "X", "San Diego, CA", ""))["matches"]
        tx = score_job(profile, _lead("tx", "Analyst", "X", "Dallas, TX", ""))["matches"]
        pnw = score_job(profile, _lead("pnw", "Analyst", "X", "Seattle, WA", ""))["matches"]
        mountain = score_job(profile, _lead("mountain", "Analyst", "X", "Denver, CO", ""))["matches"]
        remote = score_job(profile, _lead("remote", "Analyst", "X", "Remote", ""))["matches"]

        self.assertEqual(la["location_score"], 15)
        self.assertEqual(los_angeles["location_score"], 15)
        self.assertEqual(remote["location_score"], 15)
        self.assertGreater(la["location_score"], oc["location_score"])
        self.assertGreater(oc["location_score"], sd["location_score"])
        self.assertGreater(sd["location_score"], tx["location_score"])
        self.assertGreater(tx["location_score"], pnw["location_score"])
        self.assertGreater(pnw["location_score"], mountain["location_score"])

    def test_excluded_experience_matches_description_text(self):
        profile = CandidateProfile(
            name="Corinne",
            target_titles=["Data Analyst"],
            preferred_locations=["Los Angeles"],
            excluded_keywords=["3 years of experience"],
        )
        lead = _lead(
            "experience",
            "Data Analyst",
            "X",
            "Los Angeles, CA",
            "This role requires 3 years of experience building dashboards.",
        )

        scored = score_job(profile, lead)

        self.assertIn("3 years of experience", scored["matches"]["excluded"])
        self.assertLess(scored["score"], 40)

    def test_excluded_experience_matches_year_ranges_in_description(self):
        profile = CandidateProfile(
            name="Corinne",
            target_titles=["Data Analyst"],
            preferred_locations=["Los Angeles"],
            excluded_keywords=["3+ years"],
        )
        lead = _lead(
            "experience-range",
            "Data Analyst",
            "X",
            "Los Angeles, CA",
            "Relevant Work Experience: A minimum of 2-5 years of experience in analytics.",
        )

        scored = score_job(profile, lead)

        self.assertIn("3+ years", scored["matches"]["excluded"])
        self.assertLess(scored["score"], 40)

    def test_excluded_experience_matches_professional_experience_phrase(self):
        profile = CandidateProfile(
            name="Corinne",
            target_titles=["Business Analyst"],
            preferred_locations=["San Diego"],
            excluded_keywords=["3+ years"],
        )
        lead = _lead(
            "professional-experience",
            "Business Analyst",
            "Loch Harbour Group",
            "San Diego, CA",
            "Experience Requirements: 3 years of professional experience.",
        )

        scored = score_job(profile, lead)

        self.assertIn("3+ years", scored["matches"]["excluded"])
        self.assertLess(scored["score"], 40)

    def test_preferred_keywords_boost_new_grad_signals(self):
        profile = CandidateProfile(
            name="Corinne",
            preferred_keywords=["new grad", "MSBA"],
        )
        lead = _lead("new-grad", "Analyst", "X", "Remote", "New grad role; MSBA preferred.")

        matches = score_job(profile, lead)["matches"]

        self.assertEqual(matches["preferred"], ["new grad", "MSBA"])

    def test_red_flags_staffing_agency_and_cth_intermediary(self):
        profile = CandidateProfile(name="Corinne")
        lead = _lead(
            "red-flag",
            "Data Analyst",
            "SynergisticIT",
            "Remote",
            "Our client is looking for a Data Analyst. This is a CTH opportunity.",
        )

        red_flags = score_job(profile, lead)["red_flags"]

        self.assertIn("staffing_agency", red_flags)
        self.assertIn("cth_intermediary", red_flags)

    def test_manual_ingestion_scores_raw_text_as_manual_source(self):
        profile = CandidateProfile(
            name="Corinne",
            target_titles=["Data Analyst"],
            skills=["SQL"],
            preferred_locations=["Los Angeles"],
            must_have_keywords=["dashboard"],
        )

        scored = build_manual_scored_lead(
            profile,
            raw_text="Data Analyst\nExample Co\nLocation: Los Angeles, CA\nBuild SQL dashboards for business teams.",
        )

        self.assertGreater(scored["score"], 0)
        self.assertEqual(scored["lead"]["source"], "manual")


if __name__ == "__main__":
    unittest.main()
