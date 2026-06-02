from __future__ import annotations

from argparse import Namespace
from pathlib import Path
from unittest.mock import MagicMock, patch
import json
import tempfile
import unittest

from job_leads_tool import cli
from job_leads_tool.models import JobLead
from job_leads_tool.sqlite_store import connect, upsert_leads


class TestCliDbLifecycle(unittest.TestCase):
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    def test_cmd_queue_closes_db_connection(self, mock_list_leads, mock_connect):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_list_leads.return_value = [{"id": "lead-1"}]

        args = Namespace(db="data/leads.db", state="", limit=2)
        cli.cmd_queue(args)

        conn.close.assert_called_once()
        mock_list_leads.assert_called_once_with(conn, state=None)

    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.transition_state")
    @patch("job_leads_tool.cli.get_lead")
    def test_cmd_approve_closes_db_connection_on_transition_error(
        self,
        mock_get_lead,
        mock_transition_state,
        mock_connect,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_get_lead.return_value = {"id": "lead-1", "approval_state": "pending_review"}
        mock_transition_state.side_effect = RuntimeError("simulated write failure")

        args = Namespace(db="data/leads.db", lead_id="lead-1")

        with self.assertRaises(RuntimeError):
            cli.cmd_approve(args)

        conn.close.assert_called_once()
        mock_get_lead.assert_called_once_with(conn, "lead-1")

    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.transition_state")
    @patch("job_leads_tool.cli.has_company_role_application")
    @patch("job_leads_tool.cli.get_lead")
    def test_cmd_apply_closes_db_connection_on_duplicate_block(
        self,
        mock_get_lead,
        mock_has_duplicate,
        mock_transition_state,
        mock_connect,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_get_lead.return_value = {
            "id": "lead-1",
            "approval_state": "approved",
            "company": "Acme Corp",
            "title": "Data Analyst",
        }
        mock_has_duplicate.return_value = True

        args = Namespace(db="data/leads.db", lead_id="lead-1", override_duplicate=False)

        with self.assertRaises(ValueError):
            cli.cmd_apply(args)

        conn.close.assert_called_once()
        mock_transition_state.assert_not_called()

    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.sync_to_sheets")
    def test_cmd_sync_sheets_closes_db_connection(self, mock_sync_to_sheets, mock_connect):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_sync_to_sheets.return_value = {"sync": "ok"}

        args = Namespace(db="data/leads.db", spreadsheet_id="sheet-123")
        cli.cmd_sync_sheets(args)

        conn.close.assert_called_once()
        mock_sync_to_sheets.assert_called_once_with(conn, "sheet-123")

    @patch("builtins.print")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    def test_cmd_queue_clamps_negative_limit_to_zero(
        self,
        mock_list_leads,
        mock_connect,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_list_leads.return_value = [{"id": "lead-1"}, {"id": "lead-2"}]

        args = Namespace(db="data/leads.db", state="", limit=-1)
        cli.cmd_queue(args)

        mock_list_leads.assert_called_once_with(conn, state=None)
        payload = json.loads(mock_print.call_args.args[0])
        self.assertEqual(payload["count"], 2)
        self.assertEqual(payload["rows"], [])

    @patch("builtins.print")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    def test_cmd_queue_zero_limit_returns_no_rows(
        self,
        mock_list_leads,
        mock_connect,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_list_leads.return_value = [{"id": "lead-1"}, {"id": "lead-2"}]

        args = Namespace(db="data/leads.db", state="pending_review", limit=0)
        cli.cmd_queue(args)

        mock_list_leads.assert_called_once_with(conn, state="pending_review")
        payload = json.loads(mock_print.call_args.args[0])
        self.assertEqual(payload["rows"], [])

    @patch("builtins.print")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    def test_cmd_queue_orders_rows_by_mixed_created_at_formats(
        self,
        mock_list_leads,
        mock_connect,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_list_leads.return_value = [
            {
                "id": "utc-older",
                "created_at": "2026-06-01T23:00:00+00:00",
            },
            {
                "id": "offset-newer",
                "created_at": "2026-06-02T00:00:00+14:00",
            },
        ]

        args = Namespace(db="data/leads.db", state="", limit=10)
        cli.cmd_queue(args)

        mock_list_leads.assert_called_once_with(conn, state=None)
        payload = json.loads(mock_print.call_args.args[0])
        self.assertEqual(payload["rows"][0]["id"], "utc-older")
        self.assertEqual(payload["rows"][1]["id"], "offset-newer")

    @patch("builtins.print")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.list_leads")
    def test_cmd_queue_orders_rows_with_invalid_or_missing_created_at_to_end(
        self,
        mock_list_leads,
        mock_connect,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_list_leads.return_value = [
            {
                "id": "missing",
            },
            {
                "id": "invalid",
                "created_at": "not-a-timestamp",
            },
            {
                "id": "valid",
                "created_at": "2026-06-01T12:00:00Z",
            },
        ]

        args = Namespace(db="data/leads.db", state="", limit=10)
        cli.cmd_queue(args)

        mock_list_leads.assert_called_once_with(conn, state=None)
        payload = json.loads(mock_print.call_args.args[0])
        self.assertEqual(payload["rows"][0]["id"], "valid")
        self.assertEqual(payload["rows"][1]["id"], "missing")
        self.assertEqual(payload["rows"][2]["id"], "invalid")

    @patch("builtins.print")
    @patch("job_leads_tool.cli.build_approval_digest_from_db")
    def test_cmd_approval_digest_clamps_negative_limit_to_zero(
        self,
        mock_build_approval_digest,
        mock_print,
    ):
        args = Namespace(db="data/leads.db", limit=-3, out="")
        mock_build_approval_digest.return_value = "Approved Queue review\nItems awaiting apply approval: 0\n- none"

        cli.cmd_approval_digest(args)

        mock_build_approval_digest.assert_called_once_with(
            Path("data/leads.db"),
            limit=0,
        )

    @patch("builtins.print")
    def test_cmd_approval_digest_orders_created_at_then_id_tiebreak_for_out_file(self, mock_print):
        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / "leads.db"
            conn = connect(db)
            try:
                upsert_leads(
                    conn,
                    [
                        JobLead(
                            id="older",
                            source="sample",
                            company="Acme",
                            title="Data Analyst",
                            location="Remote",
                            salary=None,
                            url="https://example.com/older",
                            posted_at=None,
                            description="General role",
                            content_hash="older-hash",
                            ingested_at="2026-06-01T10:00:00+00:00",
                        ),
                        JobLead(
                            id="newer",
                            source="sample",
                            company="Beta",
                            title="Data Analyst",
                            location="Remote",
                            salary=None,
                            url="https://example.com/newer",
                            posted_at=None,
                            description="General role",
                            content_hash="newer-hash",
                            ingested_at="2026-06-02T10:00:00+00:00",
                        ),
                    ],
                )
                conn.execute("UPDATE leads SET approval_state='approved', created_at=? WHERE id=?", ("2026-06-01T10:00:00+00:00", "older"))
                conn.execute("UPDATE leads SET approval_state='approved', created_at=? WHERE id=?", ("2026-06-02T10:00:00+00:00", "newer"))
                conn.commit()
            finally:
                conn.close()

            out = Path(td) / "approval_digest.txt"
            args = Namespace(db=str(db), limit=10, out=str(out))
            cli.cmd_approval_digest(args)

            payload = json.loads(mock_print.call_args.args[0])
            self.assertEqual(payload["approval_digest_file"], str(out))
            preview = payload["preview"]
            self.assertEqual(preview[2], "- [row 2] newer | Beta | Data Analyst | Remote")
            self.assertEqual(preview[3], "- [row 3] older | Acme | Data Analyst | Remote")

    @patch("builtins.print")
    @patch("job_leads_tool.cli.build_decision_packet_from_db")
    def test_cmd_decision_packet_clamps_negative_limit_to_zero(
        self,
        mock_build_decision_packet,
        mock_print,
    ):
        args = Namespace(db="data/leads.db", profile="", limit=-9, out="")
        mock_build_decision_packet.return_value = "Decision packet\nPending leads: 0 | Showing: 0\n\n- no pending leads"

        cli.cmd_decision_packet(args)

        mock_build_decision_packet.assert_called_once_with(
            Path("data/leads.db"),
            limit=0,
            profile_path=None,
        )

    @patch("builtins.print")
    def test_cmd_decision_packet_orders_equal_score_rows_by_created_at_and_id_tiebreak(self, mock_print):
        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / "leads.db"
            conn = connect(db)
            try:
                upsert_leads(
                    conn,
                    [
                        JobLead(
                            id="alpha",
                            source="sample",
                            company="Acme",
                            title="Data Analyst",
                            location="Remote",
                            salary=None,
                            url="https://example.com/alpha",
                            posted_at=None,
                            description="General role",
                            content_hash="alpha-hash",
                            ingested_at="2026-06-01T10:00:00+00:00",
                        ),
                        JobLead(
                            id="zeta",
                            source="sample",
                            company="Beta",
                            title="Data Analyst",
                            location="Remote",
                            salary=None,
                            url="https://example.com/zeta",
                            posted_at=None,
                            description="General role",
                            content_hash="zeta-hash",
                            ingested_at="2026-06-04T10:00:00+00:00",
                        ),
                        JobLead(
                            id="newer",
                            source="sample",
                            company="Apex",
                            title="Data Analyst",
                            location="Remote",
                            salary=None,
                            url="https://example.com/newer",
                            posted_at=None,
                            description="General role",
                            content_hash="newer-hash",
                            ingested_at="2026-06-04T10:00:00+00:00",
                        ),
                    ],
                )
                conn.execute("UPDATE leads SET created_at=? WHERE id=?", ("2026-06-01T09:00:00+00:00", "alpha"))
                conn.execute("UPDATE leads SET created_at=? WHERE id=?", ("2026-06-03T09:00:00+00:00", "zeta"))
                conn.execute("UPDATE leads SET created_at=? WHERE id=?", ("2026-06-03T09:00:00+00:00", "newer"))
                conn.commit()
            finally:
                conn.close()

            profile = Path(td) / "profile.yaml"
            profile.write_text("name: test\n", encoding="utf-8")
            out = Path(td) / "decision_packet.txt"
            args = Namespace(db=str(db), profile=str(profile), limit=5, out=str(out))

            cli.cmd_decision_packet(args)

            payload = json.loads(mock_print.call_args.args[0])
            self.assertEqual(payload["decision_packet_file"], str(out))
            file_lines = out.read_text(encoding="utf-8").splitlines()
            rows = [line for line in file_lines if line.startswith("- [row")]
            self.assertEqual(rows[0], "- [row 2] zeta | Beta | Data Analyst | Remote")
            self.assertEqual(rows[1], "- [row 3] newer | Apex | Data Analyst | Remote")
            self.assertEqual(rows[2], "- [row 4] alpha | Acme | Data Analyst | Remote")

    @patch("builtins.print")
    @patch("job_leads_tool.cli.write_dashboard_html")
    @patch("job_leads_tool.cli._write_temp_scored")
    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_cmd_review_orders_equal_score_rows_by_created_at_and_id_tiebreak(
        self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
        mock_write_temp_scored,
        mock_write_dashboard_html,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
        mock_list_leads.return_value = [
            {
                "id": "older",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/older",
                "posted_at": None,
                "description": "General role",
                "content_hash": "older-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
            {
                "id": "newer",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/newer",
                "posted_at": None,
                "description": "General role",
                "content_hash": "newer-hash",
                "ingested_at": "2026-06-02T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-02T12:00:00+00:00",
            },
            {
                "id": "zeta",
                "source": "sample",
                "company": "Gamma",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/zeta",
                "posted_at": None,
                "description": "General role",
                "content_hash": "zeta-hash",
                "ingested_at": "2026-06-03T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
            {
                "id": "aaa",
                "source": "sample",
                "company": "Delta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/alpha",
                "posted_at": None,
                "description": "General role",
                "content_hash": "alpha-hash",
                "ingested_at": "2026-06-03T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
        ]

        def _fake_score(_profile, lead):
            return {
                "lead_id": lead.id,
                "score": 10,
                "tier": "tier_3",
                "matches": {},
                "lead": {
                    "id": lead.id,
                    "title": lead.title,
                    "company": lead.company,
                    "location": lead.location,
                    "description": lead.description,
                    "url": lead.url,
                },
            }

        with tempfile.TemporaryDirectory() as tmpdir:
            scored_path = Path(tmpdir) / "scored.json"
            review_path = Path(tmpdir) / "review.html"
            mock_write_temp_scored.return_value = scored_path
            mock_write_dashboard_html.return_value = review_path

            mock_score_job.side_effect = _fake_score

            args = Namespace(profile="profile.yaml", db="data/leads.db", scored_json="", out_html=str(review_path))
            cli.cmd_review(args)

            mock_write_dashboard_html.assert_called_once_with(scored_path, review_path)

            printed = json.loads(mock_print.call_args.args[0])
            self.assertEqual(printed["review_html"], str(review_path))
            self.assertEqual([item["lead_id"] for item in printed["top"]], ["newer", "zeta", "older"])

    @patch("builtins.print")
    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_cmd_score_orders_equal_score_rows_by_created_at_and_id_tiebreak(
        self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
        mock_print,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
        mock_list_leads.return_value = [
            {
                "id": "lead-old",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/old",
                "posted_at": None,
                "description": "General role",
                "content_hash": "lead-old-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
            {
                "id": "lead-new",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/new",
                "posted_at": None,
                "description": "General role",
                "content_hash": "lead-new-hash",
                "ingested_at": "2026-06-02T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-02T12:00:00+00:00",
            },
            {
                "id": "lead-high",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/high",
                "posted_at": None,
                "description": "General role",
                "content_hash": "lead-high-hash",
                "ingested_at": "2026-06-01T10:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T10:00:00+00:00",
            },
        ]

        def _fake_score(_profile, lead):
            return {
                "lead_id": lead.id,
                "score": 20 if lead.id == "lead-high" else 10,
                "tier": "tier_3",
                "matches": {},
            }

        mock_score_job.side_effect = _fake_score

        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "scored.json"
            args = Namespace(profile="profile.yaml", db="data/leads.db", out=str(out))

            cli.cmd_score(args)

            payload = json.loads(out.read_text(encoding="utf-8"))

        self.assertEqual(payload[0]["lead_id"], "lead-high")
        self.assertEqual(payload[1]["lead_id"], "lead-new")
        self.assertEqual(payload[2]["lead_id"], "lead-old")
        mock_print.assert_called_once()
        printed = json.loads(mock_print.call_args.args[0])
        self.assertEqual(printed["scored"], 3)
        self.assertEqual(printed["out"], str(out))

    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_score_from_db_prefers_newer_created_at_on_equal_score(
        self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
        mock_list_leads.return_value = [
            {
                "id": "older",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/older",
                "posted_at": None,
                "description": "General role",
                "content_hash": "older-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
            {
                "id": "newer",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/newer",
                "posted_at": None,
                "description": "General role",
                "content_hash": "newer-hash",
                "ingested_at": "2026-06-02T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-02T12:00:00+00:00",
            },
        ]

        def _fake_score(_profile, lead):
            return {
                "lead_id": lead.id,
                "score": 15,
                "tier": "tier_3",
                "matches": {},
            }

        mock_score_job.side_effect = _fake_score

        scored = cli._score_from_db(Path("profile.yaml"), Path("data/leads.db"))

        mock_list_leads.assert_called_once_with(conn)
        self.assertEqual(scored[0]["lead_id"], "newer")
        self.assertEqual(scored[1]["lead_id"], "older")

    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_score_from_db_stable_orders_equal_score_rows_by_id_tiebreaker(
        self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
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
                "description": "General role",
                "content_hash": "alpha-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
            {
                "id": "zeta",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/zeta",
                "posted_at": None,
                "description": "General role",
                "content_hash": "zeta-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T12:00:00+00:00",
            },
        ]

        def _fake_score(_profile, lead):
            return {
                "lead_id": lead.id,
                "score": 15,
                "tier": "tier_3",
                "matches": {},
            }

        mock_score_job.side_effect = _fake_score

        scored = cli._score_from_db(Path("profile.yaml"), Path("data/leads.db"))

        self.assertEqual(scored[0]["lead_id"], "zeta")
        self.assertEqual(scored[1]["lead_id"], "alpha")

    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_score_from_db_orders_invalid_created_at_last(self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
        mock_list_leads.return_value = [
            {
                "id": "invalid-1",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/invalid",
                "posted_at": None,
                "description": "General role",
                "content_hash": "invalid-hash-1",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "not-a-time",
            },
            {
                "id": "missing-ts",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/missing",
                "posted_at": None,
                "description": "General role",
                "content_hash": "missing-ts-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
            },
            {
                "id": "valid",
                "source": "sample",
                "company": "Gamma",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/valid",
                "posted_at": None,
                "description": "General role",
                "content_hash": "valid-hash",
                "ingested_at": "2026-06-01T12:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-02T00:00:00+00:00",
            },
        ]

        mock_score_job.side_effect = lambda _profile, lead: {
            "lead_id": lead.id,
            "score": 15,
            "tier": "tier_3",
            "matches": {},
        }

        scored = cli._score_from_db(Path("profile.yaml"), Path("data/leads.db"))

        self.assertEqual(scored[0]["lead_id"], "valid")
        self.assertEqual(scored[1]["lead_id"], "missing-ts")
        self.assertEqual(scored[2]["lead_id"], "invalid-1")

    @patch("job_leads_tool.cli.score_job")
    @patch("job_leads_tool.cli.list_leads")
    @patch("job_leads_tool.cli.connect")
    @patch("job_leads_tool.cli.load_profile")
    def test_score_from_db_orders_created_at_across_mixed_time_formats(
        self,
        mock_load_profile,
        mock_connect,
        mock_list_leads,
        mock_score_job,
    ):
        conn = MagicMock()
        mock_connect.return_value = conn
        mock_load_profile.return_value = MagicMock()
        mock_list_leads.return_value = [
            {
                "id": "utc-older",
                "source": "sample",
                "company": "Acme",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/older",
                "posted_at": None,
                "description": "General role",
                "content_hash": "older-hash",
                "ingested_at": "2026-06-02T10:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-01T23:00:00+00:00",
            },
            {
                "id": "offset-newer",
                "source": "sample",
                "company": "Beta",
                "title": "Data Analyst",
                "location": "Remote",
                "salary": None,
                "url": "https://example.com/newer",
                "posted_at": None,
                "description": "General role",
                "content_hash": "newer-hash",
                "ingested_at": "2026-06-02T00:00:00+00:00",
                "approval_state": "pending_review",
                "created_at": "2026-06-02T00:00:00+14:00",
            },
        ]

        mock_score_job.side_effect = lambda _profile, lead: {
            "lead_id": lead.id,
            "score": 15,
            "tier": "tier_3",
            "matches": {},
        }

        scored = cli._score_from_db(Path("profile.yaml"), Path("data/leads.db"))

        self.assertEqual(scored[0]["lead_id"], "utc-older")
        self.assertEqual(scored[1]["lead_id"], "offset-newer")


if __name__ == "__main__":
    unittest.main()
