from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


def _read_source_text(source: str) -> str:
    if str(source).startswith("http://") or str(source).startswith("https://"):
        with urllib.request.urlopen(str(source)) as response:
            data = response.read()
        return data.decode("utf-8", errors="ignore")

    path = Path(source)
    return path.read_text(encoding="utf-8", errors="ignore")


def _parse_pub_date(raw: str | None) -> str:
    if not raw:
        return ""
    return str(raw).strip()


def _safe_xml(s: str) -> str:
    # Handle unescaped ampersands that often appear in RSS titles/fields.
    # Only repair obviously broken entities to avoid touching legitimate sequences.
    return re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9A-Fa-f]+;)", "&amp;", s)


def _parse_rss_items(source: str, text: str) -> list[dict[str, str]]:
    try:
        root = ElementTree.fromstring(_safe_xml(text))
    except ElementTree.ParseError:
        return []

    items: list[dict[str, str]] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or "").strip()
        posted = (
            item.findtext("pubDate")
            or item.findtext("published")
            or item.findtext("dc:date")
            or ""
        )

        # If description contains an embedded JobPosting JSON-LD, prefer that.
        if not title and "JobPosting" in desc:
            jobs = _extract_jsonld_jobs(desc)
            if jobs:
                items.extend(jobs)
                continue

        company = ""
        m = re.match(r"(.+)\s+at\s+(.+)", title)
        if m:
            title = m.group(1).strip()
            company = m.group(2).strip()

        company = company or ""
        items.append(
            {
                "id": link or title,
                "title": title,
                "company": company,
                "location": "",
                "salary": None,
                "url": link,
                "posted_at": _parse_pub_date(posted),
                "description": desc,
            }
        )

    return items


def _extract_jsonld_jobs(text: str) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    for match in re.finditer(r"<script[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
                             text,
                             flags=re.I | re.S):
        blob = html.unescape(match.group(1) or "").strip()
        if not blob:
            continue
        try:
            data = json.loads(blob)
        except Exception:
            continue

        payloads = data if isinstance(data, list) else [data]
        for item in payloads:
            if not isinstance(item, dict):
                continue
            if item.get("@type") == "JobPosting":
                company = item.get("hiringOrganization")
                if isinstance(company, dict):
                    company = company.get("name", "")
                location = item.get("jobLocation")
                if isinstance(location, dict):
                    addr = location.get("address", {})
                    if isinstance(addr, dict):
                        city = addr.get("addressLocality", "")
                        region = addr.get("addressRegion", "")
                        location = f"{city}, {region}".strip(", ")
                    else:
                        location = str(addr or "")

                jobs.append(
                    {
                        "id": item.get("url") or item.get("identifier") or item.get("title") or "",
                        "title": item.get("title", ""),
                        "company": company or "",
                        "location": location or "",
                        "salary": item.get("baseSalary") or item.get("salary") or None,
                        "url": item.get("url", "") or item.get("identifier", ""),
                        "posted_at": item.get("datePosted") or "",
                        "description": item.get("description") or "",
                    }
                )
    return jobs


def _extract_builtiinla_cards(text: str) -> list[dict[str, str]]:
    # Pattern observed in tests: <h2><a href="/job/..">Role</a></h2><div><span>Company</span></div>
    cards: list[dict[str, str]] = []
    pattern = re.compile(
        r'<h2>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>\s*</h2>\s*<div>\s*<span>([^<]+)</span>\s*</div>',
        flags=re.I | re.S,
    )
    seen = set()
    for link, title, company in pattern.findall(text):
        key = (title.strip().lower(), company.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        cards.append(
            {
                "id": link,
                "title": html.unescape(title).strip(),
                "company": html.unescape(company).strip(),
                "location": "",
                "salary": None,
                "url": link,
                "posted_at": "",
                "description": "",
            }
        )
    return cards


def load_json_source(path: str | Path) -> list[dict[str, str]]:
    data = _read_source_text(str(path))
    try:
        parsed = json.loads(data)
    except Exception as exc:
        raise ValueError(f"invalid JSON source: {path}") from exc

    if isinstance(parsed, list):
        jobs = parsed
    elif isinstance(parsed, dict):
        for key in ("jobs", "items", "results", "data", "leads"):
            if isinstance(parsed.get(key), list):
                jobs = parsed[key]
                break
        else:
            # Single record style
            jobs = [parsed]
    else:
        raise TypeError("JSON source must be list or mapping")

    out = []
    for item in jobs:
        if isinstance(item, dict):
            out.append(item)
    return out


def load_rss_source(source: str) -> list[dict[str, str]]:
    text = _read_source_text(source)

    items = _parse_rss_items(source, text)
    if items:
        return items

    # Some pages expose JobPosting JSON-LD only.
    jobs = _extract_jsonld_jobs(text)
    if jobs:
        return jobs

    # Some sources (e.g. BuiltIn LA) render card lists without RSS items.
    cards = _extract_builtiinla_cards(text)
    if cards:
        return cards

    # Treat bare HTML snippets with `JobPosting` script as valid fallback.
    if "application/ld+json" in text:
        return jobs

    return []
