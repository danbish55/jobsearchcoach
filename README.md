# JobLeadsTool

A Hermes-compatible, human-in-the-loop job search copilot for Corinne (USC MSBA), focused on entry-level data analyst roles in Los Angeles.

## Current objective
Bring the repo from scaffold to a working **JobLeadsTool** pipeline:
1) ingest job leads,
2) score/rank by fit,
3) enforce approval gates,
4) support operator review before any application action.

## Candidate targeting context (from recent Telegram sessions)
- Candidate: BS in MIS (minor in Psychology, University of Arizona) + MSBA (USC).
- Role focus: Entry-level Data Analyst roles.
- Geography: Los Angeles area preferred.
- Priority industries: finance, banking, healthcare (expandable).

## Confirmed technical decisions
- We attempted WSL-native Playwright and hit browser-binary/platform friction.
- Final decision: run Playwright on **Windows host**, orchestrate from WSL/Hermes.
- Working capture runner is already validated:
  - WSL launcher: `local-playwright-runner`
  - Windows runner project: `local-ui-automation-runner`
  - Example output location: `local-ui-automation-runner\screenshots`

## Product goals
- Aggregate roles from approved target sources.
- Score role fit against candidate profile and hard constraints.
- Generate tailored resume bullets and cover letter drafts.
- Track role state, decisions, actions, and detailed interaction history for each job lead in one place.
- Send concise shortlist updates to Telegram.

## Hard rules / safety gates
- Human-in-the-loop is mandatory.
- No duplicate-company applications.
- No resume submission without final approval.
- No auto-apply behavior that violates platform ToS.

## Phase status
Scaffold exists. Next build focus is **JobLeadsTool core**.

## Immediate build plan (JobLeadsTool)
1. Define normalized `JobLead` schema (source, company, title, location, salary, url, posted_at, id/hash).
2. Add source connectors (start with 1–2 reliable sources, then expand).
3. Add dedupe + persistence layer.
4. Add fit scoring + tiering (Tier 1/2/3) tied to candidate profile.
5. Add review queue with explicit approval state.
6. Add CLI commands for ingest/score/review/export.
7. Add Hermes cron wrapper for scheduled ingest + digest.

## Quick start
```bash
cd /mnt/c/code/Corinne/JobLeadsTool
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m job_leads_tool.cli --profile config/candidate_profile.yaml --jobs data/sample_jobs.json
```

## Notes
- This README was updated to reflect decisions from recent Telegram sessions, so implementation can proceed directly on JobLeadsTool without re-deciding tooling/path.
