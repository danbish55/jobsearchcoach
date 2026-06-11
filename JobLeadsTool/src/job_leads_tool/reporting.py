from __future__ import annotations

import html
import json
from datetime import datetime
from pathlib import Path

from .normalization import normalize_company
from .policy import normalize_role_track


def _as_text(value: object) -> str:
    if value is None:
        return ""
    return str(value)


def _coerce_value(value: object, default: str = "") -> str:
    if value is None or value == "":
        return default
    return str(value)


def _normalize_dt(value: object) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value).isoformat()
        except Exception:
            return _as_text(value)
    return _as_text(value)


def write_dashboard_html(scored_json: Path, output_path: Path) -> Path:
    """Render a compact review dashboard HTML for scored leads output.

    Keeping this intentionally deterministic and simple so it's easy to open from JSC.
    """
    data = json.loads(Path(scored_json).read_text(encoding="utf-8"))

    headers = [
        "Company (Key)",
        "Company Name",
        "Job Title",
        "Role Type",
        "Location",
        "Posting ID",
        "Job Link",
        "Source",
        "Salary",
        "Date Found",
        "Date Applied",
        "Status",
        "Duplicate Flag",
        "Notes",
        "Open",
        "Recommended Resume",
        "Resume Used",
        "Approval",
        "Fit Score",
        "Network School Match",
        "Network Contact",
        "Network Profile Link",
        "Alumni Match",
        "Network Notes",
        "Resume Final Approval",
    ]

    rows = []
    for item in data[:100]:
        lead = item.get("lead", {})
        company = _as_text(lead.get("company", ""))
        role_type = normalize_role_track(_as_text(lead.get("title", "")))
        score = _as_text(item.get("score", ""))

        row_values = [
            normalize_company(company),
            company,
            _as_text(lead.get("title", "")),
            role_type,
            _as_text(lead.get("location", "")),
            _as_text(lead.get("id", "")),
            _as_text(lead.get("url", "")),
            _as_text(lead.get("source", "")),
            _as_text(lead.get("salary", "")),
            _normalize_dt(lead.get("ingested_at", "")),
            _normalize_dt(lead.get("date_applied", "")),
            _as_text(lead.get("approval_state", "")),
            _coerce_value(lead.get("duplicate_flag"), ""),
            _as_text(lead.get("notes", "")),
            _as_text(lead.get("open", "")),
            _as_text(lead.get("recommended_resume", "")),
            _as_text(lead.get("resume_used", "")),
            _as_text(lead.get("approval", item.get("approval", ""))),
            score,
            _as_text(lead.get("network_school_match", "")),
            _as_text(lead.get("network_contact", "")),
            _as_text(lead.get("network_profile_link", "")),
            _as_text(lead.get("alumni_match", "")),
            _as_text(lead.get("network_notes", "")),
            _as_text(lead.get("resume_final_approval", "")),
        ]

        # Render job link as clickable text for readability.
        link = row_values[6]
        if link:
            row_values[6] = f'<a href="{html.escape(link, quote=True)}" target="_blank" rel="noopener">Open</a>'

        rendered_cells = []
        for idx, value in enumerate(row_values):
            if idx == 6 and value.startswith("<a "):
                rendered_cells.append(value)
            else:
                rendered_cells.append(html.escape(value, quote=True))
        rows.append(f"<tr><td>{'</td><td>'.join(rendered_cells)}</td></tr>")

    if not rows:
        rows.append(f"<tr><td colspan=\"{len(headers)}\" style=\"text-align:center; color:#666;\">No Leads Loaded Yet.</td></tr>")

    html_rows = "".join(rows)
    html_cells = "".join(f"<th>{h}</th>" for h in headers)

    dashboard_html = (
        "<html><head><title>Review Dashboard</title></head><body>"
        "<h1>Review Dashboard</h1>"
        "<table><thead><tr>"
        f"{html_cells}"
        "</tr></thead>"
        f"<tbody>{html_rows}</tbody></table>"
        "</body></html>"
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    output = Path(output_path)
    output.write_text(dashboard_html, encoding="utf-8")
    return output
