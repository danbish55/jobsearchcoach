from __future__ import annotations

import argparse
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import cast

import yaml

from .connectors import load_json_source, load_rss_source
from .digest import (
    build_approval_digest_from_db,
    build_decision_packet_from_db,
    build_digest_text,
)
from .drive_export import export_file_to_drive
from .models import ApprovalState, CandidateProfile, JobLead
from .normalization import normalize_company, to_job_lead
from .policy import can_transition, normalize_role_track
from .reporting import write_dashboard_html
from .scoring import score_job
from .sources_registry import DEFAULT_SOURCES, export_sources_markdown
from .sources_runner import run_sources_to_sqlite, write_source_health
from .sheets_sync import sync_to_sheets
from .sqlite_store import (
    connect,
    get_lead,
    has_company_role_application,
    list_leads,
    transition_state,
    upsert_leads,
)
from .storage import load_leads as load_json_leads


def load_profile(path: Path) -> CandidateProfile:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return CandidateProfile(**data)


def _load_source(source_type: str, source: str, source_name: str) -> tuple[list[JobLead], str]:
    if source_type == "json":
        raw_jobs = load_json_source(Path(source))
        source_name = source_name or "json"
    else:
        raw_jobs = load_rss_source(source)
        source_name = source_name or "rss"
    incoming = [to_job_lead(raw, source_name) for raw in raw_jobs]
    return incoming, source_name


@contextmanager
def _open_db(path: Path):
    conn = connect(path)
    try:
        yield conn
    finally:
        conn.close()


def cmd_ingest(args: argparse.Namespace) -> None:
    incoming, source_name = _load_source(args.source_type, args.source, args.source_name)
    with _open_db(Path(args.db)) as conn:
        added, dupes = upsert_leads(conn, incoming)
        total = len(list_leads(conn))
        print(json.dumps({"db": args.db, "source": source_name, "incoming": len(incoming), "added": added, "duplicates": dupes, "total": total}, indent=2))


def cmd_migrate_json(args: argparse.Namespace) -> None:
    leads = load_json_leads(Path(args.json_db))
    with _open_db(Path(args.db)) as conn:
        added, dupes = upsert_leads(conn, leads)
        print(json.dumps({"from_json": args.json_db, "to_sqlite": args.db, "incoming": len(leads), "added": added, "duplicates": dupes}, indent=2))


def _normalize_created_at_for_sort(created_at: str | None) -> float:
    if not created_at:
        return float("-inf")

    value = created_at.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return float("-inf")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)

    return parsed.timestamp()



def _score_from_db(profile_path: Path, db_path: Path) -> list[dict]:
    profile = load_profile(profile_path)
    with _open_db(db_path) as conn:
        rows = list_leads(conn)
        scored_rows: list[tuple[int, float, str, dict]] = []
        for r in rows:
            lead = JobLead(
                id=r["id"],
                source=r["source"],
                company=r["company"],
                title=r["title"],
                location=r["location"],
                salary=r.get("salary"),
                url=r["url"],
                posted_at=r.get("posted_at"),
                description=r["description"],
                content_hash=r["content_hash"],
                ingested_at=r["ingested_at"],
                approval_state=r["approval_state"],
            )
            scored = score_job(profile, lead)
            scored_rows.append(
                (
                    scored.get("score", 0),
                    _normalize_created_at_for_sort(r.get("created_at")),
                    r["id"],
                    scored,
                )
            )

        scored_rows.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)
        return [entry[3] for entry in scored_rows]


def cmd_score(args: argparse.Namespace) -> None:
    scored = _score_from_db(Path(args.profile), Path(args.db))
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(scored, indent=2), encoding="utf-8")
    print(json.dumps({"scored": len(scored), "out": str(output)}, indent=2))


def cmd_review(args: argparse.Namespace) -> None:
    scored = _score_from_db(Path(args.profile), Path(args.db))
    path = Path(args.scored_json) if args.scored_json else _write_temp_scored(scored)
    html_path = write_dashboard_html(path, Path(args.out_html))
    print(json.dumps({"review_html": str(html_path), "top": scored[:3]}, indent=2))


def _write_temp_scored(scored: list[dict]) -> Path:
    path = Path("outputs/scored_tmp.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(scored, indent=2), encoding="utf-8")
    return path


def cmd_queue(args: argparse.Namespace) -> None:
    with _open_db(Path(args.db)) as conn:
        rows = list_leads(conn, state=args.state if args.state else None)
        safe_limit = max(0, args.limit)
        print(json.dumps({"count": len(rows), "rows": rows[:safe_limit]}, indent=2))


def _assert_transition(old: str, new: ApprovalState) -> None:
    if not can_transition(cast(ApprovalState, old), new):
        raise ValueError(f"invalid transition: {old} -> {new}")


def cmd_approve(args: argparse.Namespace) -> None:
    with _open_db(Path(args.db)) as conn:
        lead = get_lead(conn, args.lead_id)
        if not lead:
            raise ValueError("lead not found")
        _assert_transition(lead["approval_state"], "approved")
        transition_state(conn, args.lead_id, "approved")
        print(json.dumps({"lead_id": args.lead_id, "state": "approved"}, indent=2))


def cmd_reject(args: argparse.Namespace) -> None:
    with _open_db(Path(args.db)) as conn:
        lead = get_lead(conn, args.lead_id)
        if not lead:
            raise ValueError("lead not found")
        _assert_transition(lead["approval_state"], "rejected")
        transition_state(conn, args.lead_id, "rejected")
        print(json.dumps({"lead_id": args.lead_id, "state": "rejected"}, indent=2))


def cmd_apply(args: argparse.Namespace) -> None:
    with _open_db(Path(args.db)) as conn:
        lead = get_lead(conn, args.lead_id)
        if not lead:
            raise ValueError("lead not found")

        _assert_transition(lead["approval_state"], "applied")

        company_norm = normalize_company(lead["company"])
        role_track = normalize_role_track(lead["title"])
        if has_company_role_application(conn, company_norm, role_track) and not args.override_duplicate:
            raise ValueError("duplicate-company-role apply blocked. Re-run with --override-duplicate if explicitly approved.")

        transition_state(conn, args.lead_id, "applied")
        print(json.dumps({"lead_id": args.lead_id, "state": "applied", "override_duplicate": bool(args.override_duplicate)}, indent=2))


def cmd_sources(args: argparse.Namespace) -> None:
    rows = [s.__dict__ for s in DEFAULT_SOURCES]
    out = {"count": len(rows), "sources": rows}
    if args.out_md:
        path = export_sources_markdown(Path(args.out_md))
        out["markdown"] = str(path)
    print(json.dumps(out, indent=2))


def cmd_ingest_sources(args: argparse.Namespace) -> None:
    payload = run_sources_to_sqlite(Path(args.db), DEFAULT_SOURCES)
    health_path = write_source_health(Path(args.health_out), payload)
    payload["health_out"] = str(health_path)
    print(json.dumps(payload, indent=2))


def cmd_export_drive(args: argparse.Namespace) -> None:
    result = export_file_to_drive(Path(args.file), args.name)
    print(json.dumps(result, indent=2))


def cmd_digest(args: argparse.Namespace) -> None:
    text = build_digest_text(Path(args.db))
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(json.dumps({"digest_file": str(out), "preview": text.splitlines()[:5]}, indent=2))
        return
    print(text)


def cmd_approval_digest(args: argparse.Namespace) -> None:
    safe_limit = max(0, args.limit)
    text = build_approval_digest_from_db(Path(args.db), limit=safe_limit)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(json.dumps({"approval_digest_file": str(out), "preview": text.splitlines()[:8]}, indent=2))
        return
    print(text)


def cmd_decision_packet(args: argparse.Namespace) -> None:
    safe_limit = max(0, args.limit)
    text = build_decision_packet_from_db(
        Path(args.db),
        limit=safe_limit,
        profile_path=Path(args.profile) if args.profile else None,
    )
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(json.dumps({"decision_packet_file": str(out), "preview": text.splitlines()[:10]}, indent=2))
        return
    print(text)


def cmd_run_cycle(args: argparse.Namespace) -> None:
    db = Path(args.db)
    health = run_sources_to_sqlite(db, DEFAULT_SOURCES)
    health_path = write_source_health(Path(args.health_out), health)

    scored = _score_from_db(Path(args.profile), db)
    scored_out = Path(args.scored_out)
    scored_out.parent.mkdir(parents=True, exist_ok=True)
    scored_out.write_text(json.dumps(scored, indent=2), encoding="utf-8")

    html_path = write_dashboard_html(scored_out, Path(args.review_html))

    digest_text = build_digest_text(db)
    digest_file = Path(args.digest_out)
    digest_file.parent.mkdir(parents=True, exist_ok=True)
    digest_file.write_text(digest_text, encoding="utf-8")

    out = {
        "db": str(db),
        "health_out": str(health_path),
        "scored_out": str(scored_out),
        "review_html": str(html_path),
        "digest_out": str(digest_file),
        "digest_preview": digest_text.splitlines()[:6],
    }

    spreadsheet_id = getattr(args, "spreadsheet_id", "")
    if spreadsheet_id:
        with _open_db(db) as conn:
            out["sheets_sync"] = sync_to_sheets(conn, spreadsheet_id)

    print(json.dumps(out, indent=2))


def cmd_sync_sheets(args: argparse.Namespace) -> None:
    with _open_db(Path(args.db)) as conn:
        result = sync_to_sheets(conn, args.spreadsheet_id)
        print(json.dumps(result, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="JobLeadsTool")
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="Ingest from source into SQLite lead DB")
    p_ingest.add_argument("--source-type", choices=["json", "rss"], required=True)
    p_ingest.add_argument("--source", required=True, help="Path for json or URL/file URL for rss")
    p_ingest.add_argument("--source-name", default="")
    p_ingest.add_argument("--db", default="data/leads.db")
    p_ingest.set_defaults(func=cmd_ingest)

    p_mig = sub.add_parser("migrate-json", help="Import prior JSON DB into SQLite")
    p_mig.add_argument("--json-db", default="data/leads_db.json")
    p_mig.add_argument("--db", default="data/leads.db")
    p_mig.set_defaults(func=cmd_migrate_json)

    p_score = sub.add_parser("score", help="Score leads from SQLite DB")
    p_score.add_argument("--profile", required=True)
    p_score.add_argument("--db", default="data/leads.db")
    p_score.add_argument("--out", default="outputs/scored_leads.json")
    p_score.set_defaults(func=cmd_score)

    p_review = sub.add_parser("review", help="Build visual review dashboard HTML")
    p_review.add_argument("--profile", required=True)
    p_review.add_argument("--db", default="data/leads.db")
    p_review.add_argument("--scored-json", default="")
    p_review.add_argument("--out-html", default="outputs/review_dashboard.html")
    p_review.set_defaults(func=cmd_review)

    p_queue = sub.add_parser("queue", help="List review queue")
    p_queue.add_argument("--db", default="data/leads.db")
    p_queue.add_argument("--state", choices=["pending_review", "approved", "rejected", "applied"], default="")
    p_queue.add_argument("--limit", type=int, default=25)
    p_queue.set_defaults(func=cmd_queue)

    p_appr = sub.add_parser("approve", help="Approve a lead")
    p_appr.add_argument("lead_id")
    p_appr.add_argument("--db", default="data/leads.db")
    p_appr.set_defaults(func=cmd_approve)

    p_rej = sub.add_parser("reject", help="Reject a lead")
    p_rej.add_argument("lead_id")
    p_rej.add_argument("--db", default="data/leads.db")
    p_rej.set_defaults(func=cmd_reject)

    p_apply = sub.add_parser("apply", help="Mark approved lead as applied with duplicate guard")
    p_apply.add_argument("lead_id")
    p_apply.add_argument("--db", default="data/leads.db")
    p_apply.add_argument("--override-duplicate", action="store_true")
    p_apply.set_defaults(func=cmd_apply)

    p_sources = sub.add_parser("sources", help="List source registry scaffold")
    p_sources.add_argument("--out-md", default="")
    p_sources.set_defaults(func=cmd_sources)

    p_ingest_sources = sub.add_parser("ingest-sources", help="Run all enabled registry sources and log health")
    p_ingest_sources.add_argument("--db", default="data/leads.db")
    p_ingest_sources.add_argument("--health-out", default="outputs/source_health.json")
    p_ingest_sources.set_defaults(func=cmd_ingest_sources)

    p_drive = sub.add_parser("export-drive", help="Optional: upload file to authenticated Google Drive")
    p_drive.add_argument("--file", required=True)
    p_drive.add_argument("--name", default="")
    p_drive.set_defaults(func=cmd_export_drive)

    p_digest = sub.add_parser("digest", help="Build cron-friendly summary text")
    p_digest.add_argument("--db", default="data/leads.db")
    p_digest.add_argument("--out", default="")
    p_digest.set_defaults(func=cmd_digest)

    p_approval_digest = sub.add_parser("approval-digest", help="Build approval queue digest with sheet row references")
    p_approval_digest.add_argument("--db", default="data/leads.db")
    p_approval_digest.add_argument("--limit", type=int, default=10)
    p_approval_digest.add_argument("--out", default="")
    p_approval_digest.set_defaults(func=cmd_approval_digest)

    p_decision_packet = sub.add_parser("decision-packet", help="Build top pending lead packet with rationale + approve/reject snippets")
    p_decision_packet.add_argument("--db", default="data/leads.db")
    p_decision_packet.add_argument("--profile", default="")
    p_decision_packet.add_argument("--limit", type=int, default=5)
    p_decision_packet.add_argument("--out", default="")
    p_decision_packet.set_defaults(func=cmd_decision_packet)

    p_cycle = sub.add_parser("run-cycle", help="Phase 6: run ingest->score->review->digest in one cron-friendly command")
    p_cycle.add_argument("--profile", required=True)
    p_cycle.add_argument("--db", default="data/leads.db")
    p_cycle.add_argument("--health-out", default="outputs/source_health.json")
    p_cycle.add_argument("--scored-out", default="outputs/scored_leads_cycle.json")
    p_cycle.add_argument("--review-html", default="outputs/review_dashboard_cycle.html")
    p_cycle.add_argument("--digest-out", default="outputs/digest_cycle.txt")
    p_cycle.add_argument("--spreadsheet-id", default="", help="Optional: also sync tracker sheets at end of cycle")
    p_cycle.set_defaults(func=cmd_run_cycle)

    p_sheets = sub.add_parser("sync-sheets", help="Sync SQLite queue into Google Sheets tracker tabs")
    p_sheets.add_argument("--db", default="data/leads.db")
    p_sheets.add_argument("--spreadsheet-id", required=True)
    p_sheets.set_defaults(func=cmd_sync_sheets)

    return parser


def _preflight_repo_guard() -> None:
    if os.environ.get("JLT_ALLOW_ANY_CWD", "") == "1":
        return

    cwd = Path.cwd().resolve()
    looks_like_repo = (
        cwd.name.lower() == "jobleadstool"
        and (cwd / "src" / "job_leads_tool" / "cli.py").exists()
        and (cwd / "README.md").exists()
    )
    if not looks_like_repo:
        raise RuntimeError(
            "Safety guard: run JobLeadsTool commands from the JobLeadsTool repo root. "
            f"Current cwd: {cwd}. Set JLT_ALLOW_ANY_CWD=1 to bypass intentionally."
        )


def main() -> None:
    _preflight_repo_guard()
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
