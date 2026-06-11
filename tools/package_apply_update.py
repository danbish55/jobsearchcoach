#!/usr/bin/env python3
"""Apply a JobSearchCoach update package onto an existing install folder.

Preserves OAuth keys, API keys, and local Job Leads data. Run from inside the
unzipped update folder (same folder as this script after packaging).
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Files never replaced from the update package.
KEEP_FILES = {
    "config.json",
}

# Directory names under the install root whose contents are never deleted or overwritten.
PRESERVE_DIR_NAMES = {
    "backups",
    "data",
    "outputs",
}

SKIP_DIR_NAMES = {
    ".git",
    ".cursor",
    ".vscode",
    "__pycache__",
    "dist",
    "backups",
}

SKIP_FILE_NAMES = {
    "apply_update.py",
    "Apply Update.bat",
    "Apply Update.command",
    "Start JobSearchCoach.bat",
    "Start JobSearchCoach.command",
    "First Time Setup.command",
}


def is_install_root(path: Path) -> bool:
    return (path / "server.py").is_file() and (path / "index.html").is_file()


def discover_install_roots() -> list[Path]:
    found: list[Path] = []
    seen: set[str] = set()
    package_dir = Path(__file__).resolve().parent

    search_roots = []
    home = Path.home()
    for candidate in (
        home / "Desktop",
        home / "Documents",
        home / "Downloads",
        package_dir.parent,
    ):
        if candidate.is_dir():
            search_roots.append(candidate)

    for root in search_roots:
        try:
            children = list(root.iterdir())
        except OSError:
            continue
        for child in children:
            if not child.is_dir():
                continue
            try:
                resolved = child.resolve()
            except OSError:
                continue
            key = str(resolved)
            if key in seen:
                continue
            if resolved == package_dir:
                continue
            if is_install_root(resolved):
                seen.add(key)
                found.append(resolved)

    found.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    return found


def choose_target(package_dir: Path) -> Path | None:
    matches = discover_install_roots()
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    print("Found more than one existing JobSearchCoach folder:")
    for index, path in enumerate(matches, start=1):
        print(f"  {index}. {path}")
    while True:
        choice = input("Enter the number to update (or press Enter to cancel): ").strip()
        if not choice:
            return None
        if choice.isdigit() and 1 <= int(choice) <= len(matches):
            return matches[int(choice) - 1]
        print("Please enter a valid number.")


def prompt_for_target() -> Path | None:
    raw = input("Paste the full path to your existing JobSearchCoach folder: ").strip().strip('"')
    if not raw:
        return None
    path = Path(raw).expanduser()
    if not is_install_root(path):
        print("That folder does not look like JobSearchCoach (missing server.py).")
        return None
    return path.resolve()


def preserve_relative(rel: Path) -> bool:
    if rel.parts and rel.parts[0] in PRESERVE_DIR_NAMES:
        return True
    if len(rel.parts) >= 2 and rel.parts[0] == "JobLeadsTool" and rel.parts[1] in PRESERVE_DIR_NAMES:
        return True
    return False


def should_skip_source(rel: Path) -> bool:
    if any(part in SKIP_DIR_NAMES for part in rel.parts):
        return True
    if rel.name in SKIP_FILE_NAMES:
        return True
    if rel.name in KEEP_FILES:
        return True
    if preserve_relative(rel):
        return True
    return False


def merge_config(existing: dict, template: dict) -> dict:
    merged = dict(template)
    for key in (
        "google_client_id",
        "google_client_secret",
        "anthropic_api_key",
        "claude_model",
        "profile_complete",
    ):
        value = existing.get(key)
        if value not in (None, ""):
            merged[key] = value
    merged["install_build_id"] = template.get("install_build_id") or existing.get("install_build_id")
    # JobLeadsTool ships inside the app folder now; a leftover jl_path from a
    # two-repo install would point the server at the stale external copy.
    merged.pop("jl_path", None)
    return merged


def next_backup_dir(target: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    root = target / "backups"
    root.mkdir(exist_ok=True)
    candidate = root / f"pre-update-{stamp}"
    suffix = 2
    while candidate.exists():
        candidate = root / f"pre-update-{stamp}-{suffix}"
        suffix += 1
    return candidate


def backup_target(target: Path, backup_dir: Path) -> None:
    print(f"Creating backup: {backup_dir}")
    for item in target.rglob("*"):
        rel = item.relative_to(target)
        if any(part in SKIP_DIR_NAMES for part in rel.parts):
            continue
        if item.is_dir():
            continue
        dest = backup_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, dest)


def migrate_legacy_jl_data(target: Path, existing_config: dict) -> None:
    """Copy data/outputs from an old separate JobLeadsTool folder into the
    bundled JobLeadsTool/ inside the install, without overwriting anything."""
    sources = []
    configured = str(existing_config.get("jl_path") or "").strip()
    if configured:
        sources.append(Path(configured).expanduser())
    sources.append(target.parent / "JobLeadsTool")

    legacy = None
    for source in sources:
        try:
            resolved = source.resolve()
        except OSError:
            continue
        if resolved == (target / "JobLeadsTool").resolve():
            continue
        if (resolved / "src" / "job_leads_tool" / "cli.py").is_file():
            legacy = resolved
            break
    if legacy is None:
        return

    copied = 0
    for sub in ("data", "outputs"):
        src_dir = legacy / sub
        if not src_dir.is_dir():
            continue
        for src in src_dir.rglob("*"):
            if src.is_dir():
                continue
            dest = target / "JobLeadsTool" / sub / src.relative_to(src_dir)
            if dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            copied += 1
    if copied:
        print(f"Copied {copied} Job Leads data file(s) from your old JobLeadsTool folder.")
        print(f"(The old folder at {legacy} was left untouched.)")


def apply_update(package_dir: Path, target: Path) -> None:
    if package_dir.resolve() == target.resolve():
        raise SystemExit("The update folder cannot be the same as the install folder.")

    template_config = {}
    template_path = package_dir / "config.json"
    if template_path.is_file():
        try:
            template_config = json.loads(template_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            template_config = {}

    existing_config = {}
    target_config_path = target / "config.json"
    if target_config_path.is_file():
        try:
            existing_config = json.loads(target_config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise SystemExit(
                f"The config.json in {target} is damaged and could not be read.\n"
                "Update cancelled so your settings are not lost. "
                "Ask Dan for help before running the update again."
            )

    backup_dir = next_backup_dir(target)
    backup_target(target, backup_dir)

    copied = 0
    for src in package_dir.rglob("*"):
        if src.is_dir():
            continue
        rel = src.relative_to(package_dir)
        if should_skip_source(rel):
            continue
        dest = target / rel
        if preserve_relative(rel) and dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied += 1

    migrate_legacy_jl_data(target, existing_config)

    merged = merge_config(existing_config, template_config)
    target_config_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")

    print()
    print(f"Update applied to: {target}")
    print(f"Files updated: {copied}")
    print(f"Backup saved to: {backup_dir}")
    print("Kept your config.json OAuth keys, API key, and JobLeadsTool data/outputs.")


def main() -> None:
    package_dir = Path(__file__).resolve().parent
    print("JobSearchCoach Update")
    print(f"Update package: {package_dir.name}")
    print()

    target = choose_target(package_dir)
    if target is None:
        print("No existing install was detected automatically.")
        target = prompt_for_target()
    if target is None:
        raise SystemExit("Update cancelled.")

    print(f"Updating: {target}")
    confirm = input("Continue? [Y/n]: ").strip().lower()
    if confirm not in ("", "y", "yes"):
        raise SystemExit("Update cancelled.")

    apply_update(package_dir, target)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
