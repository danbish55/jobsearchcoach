from __future__ import annotations

import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from job_leads_tool import cli


class TestRunCycleSync(unittest.TestCase):
    def _args(self, td: str, spreadsheet_id: str = "") -> Namespace:
        return Namespace(
            profile=str(Path(td) / "profile.yaml"),
            db=str(Path(td) / "leads.db"),
            health_out=str(Path(td) / "health.json"),
            scored_out=str(Path(td) / "scored.json"),
            review_html=str(Path(td) / "review.html"),
            digest_out=str(Path(td) / "digest.txt"),
            spreadsheet_id=spreadsheet_id,
        )

    def test_run_cycle_default_does_not_sync_sheets(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td, "profile.yaml").write_text("name: x\n", encoding="utf-8")
            args = self._args(td, spreadsheet_id="")
            with patch("job_leads_tool.cli.run_sources_to_sqlite", return_value={"ok": True}), \
                patch("job_leads_tool.cli.write_source_health", return_value=Path(args.health_out)), \
                patch("job_leads_tool.cli._score_from_db", return_value=[]), \
                patch("job_leads_tool.cli.write_dashboard_html", return_value=Path(args.review_html)), \
                patch("job_leads_tool.cli.build_digest_text", return_value="ok"), \
                patch("job_leads_tool.cli.sync_to_sheets") as sync_mock:
                cli.cmd_run_cycle(args)
                sync_mock.assert_not_called()

    def test_run_cycle_syncs_when_spreadsheet_id_provided(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td, "profile.yaml").write_text("name: x\n", encoding="utf-8")
            args = self._args(td, spreadsheet_id="sheet123")
            with patch("job_leads_tool.cli.run_sources_to_sqlite", return_value={"ok": True}), \
                patch("job_leads_tool.cli.write_source_health", return_value=Path(args.health_out)), \
                patch("job_leads_tool.cli._score_from_db", return_value=[]), \
                patch("job_leads_tool.cli.write_dashboard_html", return_value=Path(args.review_html)), \
                patch("job_leads_tool.cli.build_digest_text", return_value="ok"), \
                patch("job_leads_tool.cli.connect") as connect_mock, \
                patch("job_leads_tool.cli.sync_to_sheets", return_value={"ok": True}) as sync_mock:
                connect_mock.return_value = type("DummyConn", (), {"close": lambda self: None})()
                cli.cmd_run_cycle(args)
                sync_mock.assert_called_once()

    @patch("job_leads_tool.cli.write_source_health")
    @patch("job_leads_tool.cli.run_sources_to_sqlite")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.load_profile")
    @patch("job_leads_tool.cli.write_dashboard_html")
    @patch("job_leads_tool.cli.build_digest_text")
    def test_run_cycle_scores_sorted_with_tiebreaker_before_scored_out(
        self,
        mock_build_digest,
        mock_write_dashboard_html,
        mock_load_profile,
        mock_score_job,
        mock_list_leads,
        mock_connect,
        mock_run_sources,
        mock_write_health,
    ):
        with tempfile.TemporaryDirectory() as td:
            profile_path = Path(td) / "profile.yaml"
            profile_path.write_text("name: x\n", encoding="utf-8")
            args = self._args(td)

            mock_run_sources.return_value = {"ok": True}
            mock_write_health.return_value = Path(args.health_out)
            mock_load_profile.return_value = type("DummyProfile", (), {"name": "x", "target_titles": [], "skills": [], "preferred_locations": [], "must_have_keywords": [], "excluded_keywords": []})()
            mock_connect.return_value = type("DummyConn", (), {"close": lambda self: None})()
            mock_write_dashboard_html.return_value = Path(args.review_html)
            mock_build_digest.return_value = "digest ok"

            mock_list_leads.return_value = [
                {
                    "id": "alpha",
                    "source": "sample",
                    "company": "Acme",
                    "title": "Data Analyst",
                    "location": "Remote",
                    "salary": None,
                    "url": "https://example.com/alpha",
                    "posted_at": None,
                    "description": "Role",
                    "content_hash": "h1",
                    "ingested_at": "2026-06-01T12:00:00+00:00",
                    "approval_state": "pending_review",
                    "created_at": "2026-06-01T09:00:00+00:00",
                },
                {
                    "id": "beta",
                    "source": "sample",
                    "company": "Beta",
                    "title": "Data Analyst",
                    "location": "Remote",
                    "salary": None,
                    "url": "https://example.com/beta",
                    "posted_at": None,
                    "description": "Role",
                    "content_hash": "h2",
                    "ingested_at": "2026-06-02T12:00:00+00:00",
                    "approval_state": "pending_review",
                    "created_at": "2026-06-03T12:00:00+00:00",
                },
                {
                    "id": "gamma",
                    "source": "sample",
                    "company": "Gamma",
                    "title": "Data Analyst",
                    "location": "Remote",
                    "salary": None,
                    "url": "https://example.com/gamma",
                    "posted_at": None,
                    "description": "Role",
                    "content_hash": "h3",
                    "ingested_at": "2026-06-01T14:00:00+00:00",
                    "approval_state": "pending_review",
                    "created_at": "2026-06-01T09:00:00+00:00",
                },
                {
                    "id": "zeta",
                    "source": "sample",
                    "company": "Delta",
                    "title": "Data Analyst",
                    "location": "Remote",
                    "salary": None,
                    "url": "https://example.com/zeta",
                    "posted_at": None,
                    "description": "Role",
                    "content_hash": "h4",
                    "ingested_at": "2026-06-03T14:00:00+00:00",
                    "approval_state": "pending_review",
                    "created_at": None,
                },
            ]

            def _fake_score(_profile, lead):
                return {
                    "lead_id": lead.id,
                    "score": {
                        "beta": 10,
                        "alpha": 10,
                        "gamma": 10,
                        "zeta": 9,
                    }.get(lead.id, 0),
                    "tier": "tier_3",
                    "matches": {},
                    "lead": {"id": lead.id, "title": lead.title},
                }

            mock_score_job.side_effect = _fake_score

            cli.cmd_run_cycle(args)

            scored = json.loads(Path(args.scored_out).read_text(encoding="utf-8"))
            self.assertEqual([row["lead_id"] for row in scored], ["beta", "gamma", "alpha", "zeta"])


if __name__ == "__main__":
    unittest.main()
