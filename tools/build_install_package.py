#!/usr/bin/env python3
"""Build a JobSearchCoach install/update zip from a clean git commit.

JobSearchCoach and JobLeadsTool live in one repo now, so a single
`git archive` of HEAD (or a chosen commit) captures the whole program.

Usage:
    python tools/build_install_package.py [--commit REF] [--include-google-creds]

The output zip works for both first installs and updates:
  - First install: unzip, run "First Time Setup.command", then
    "Start JobSearchCoach.command".
  - Update: unzip next to the existing install and run
    "Apply Update.command" (backs up first, preserves data/outputs).
"""

from __future__ import annotations

import argparse
import json
import shutil
import stat
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

MAC_START = """#!/bin/bash
cd "$(dirname "$0")" || exit 1
INSTALL_ROOT="$(pwd)"
clear
echo "=============================================="
echo " JobSearchCoach"
echo "=============================================="
echo
if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$INSTALL_ROOT" 2>/dev/null || true
fi
PYTHON_EXE=""
PYTHON_TEST='import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)'
for cmd in python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    candidate="$(command -v "$cmd")"
    if "$candidate" -c "$PYTHON_TEST" >/dev/null 2>&1; then PYTHON_EXE="$candidate"; break; fi
  fi
done
if [ -z "$PYTHON_EXE" ]; then
  for candidate in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
    if [ -x "$candidate" ] && "$candidate" -c "$PYTHON_TEST" >/dev/null 2>&1; then PYTHON_EXE="$candidate"; break; fi
  done
fi
if [ -n "$PYTHON_EXE" ]; then
  echo "Found Python: $PYTHON_EXE"
  [ -f JobLeadsTool/requirements.txt ] && "$PYTHON_EXE" -m pip install -q -r JobLeadsTool/requirements.txt
  [ -f requirements.txt ] && "$PYTHON_EXE" -m pip install -q -r requirements.txt
  open "http://localhost:8765" >/dev/null 2>&1 &
  "$PYTHON_EXE" -u server.py
else
  echo "Python 3 is required."
  open "https://www.python.org/downloads/macos/"
  read -n 1 -s -r -p "Press any key to close."
fi
"""

APPLY_UPDATE_MAC = """#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
echo "JobSearchCoach Update (keeps your settings and Job Leads data)"
if command -v xattr >/dev/null 2>&1; then xattr -dr com.apple.quarantine . 2>/dev/null || true; fi
PY=python3
command -v python3 >/dev/null 2>&1 || PY=python
"$PY" apply_update.py
read -n 1 -s -r -p "Press any key to close."
"""

FIRST_TIME_MAC = """#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
echo "First Time Mac Setup"
if command -v xattr >/dev/null 2>&1; then xattr -dr com.apple.quarantine . 2>/dev/null || true; fi
chmod +x *.command 2>/dev/null || true
echo "Done. Run Start JobSearchCoach.command (or Apply Update.command to update an existing install)."
read -n 1 -s -r -p "Press any key to close."
"""

WIN_START = """@echo off
cd /d "%~dp0"
title JobSearchCoach
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 is required. Opening download page...
  start https://www.python.org/downloads/windows/
  pause
  exit /b 1
)
if exist JobLeadsTool\\requirements.txt python -m pip install -q -r JobLeadsTool\\requirements.txt
if exist requirements.txt python -m pip install -q -r requirements.txt
start http://localhost:8765
python -u server.py
pause
"""


def git_rev(ref: str) -> str:
    return subprocess.check_output(["git", "rev-parse", ref], cwd=ROOT, text=True).strip()


def git_archive_extract(commit: str, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    archive = DIST / "_export.zip"
    try:
        subprocess.check_call(
            ["git", "archive", "--format=zip", f"--output={archive}", commit],
            cwd=ROOT,
        )
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)
    finally:
        archive.unlink(missing_ok=True)


def zip_package(target: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for src in sorted(target.rglob("*")):
            if src.is_dir():
                continue
            rel = src.relative_to(target.parent)
            info = zipfile.ZipInfo(str(rel).replace("\\", "/"))
            mode = 0o755 if src.suffix == ".command" else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            zf.writestr(info, src.read_bytes())


def write_launchers(target: Path, build_id: str, commit: str) -> None:
    for name, body in (
        ("Start JobSearchCoach.command", MAC_START),
        ("Apply Update.command", APPLY_UPDATE_MAC),
        ("First Time Setup.command", FIRST_TIME_MAC),
    ):
        path = target / name
        path.write_text(body, encoding="utf-8", newline="\n")
        path.chmod(0o755)
    (target / "Start JobSearchCoach.bat").write_text(WIN_START, encoding="utf-8")
    shutil.copy2(ROOT / "tools" / "package_apply_update.py", target / "apply_update.py")
    (target / "README.txt").write_text(
        f"""JobSearchCoach {build_id}
(includes JobLeadsTool — one program, one folder)

git commit: {commit}

FIRST INSTALL (Mac)
1. Unzip this zip to your Desktop
2. Double-click "First Time Setup.command" (run once)
3. Double-click "Start JobSearchCoach.command"
4. Your browser opens; follow the setup steps in the app

UPDATING AN EXISTING INSTALL (Mac)
1. Unzip this zip to your Desktop (keep your old folder where it is)
2. In the NEW folder, double-click "Apply Update.command"
3. It finds your existing folder, backs it up, and updates it
4. Start the app from your EXISTING folder as usual

Your settings, API key, and Google connection are stored outside the
app folder (in Library/Application Support/JobSearchCoach) and are
never touched by updates. Your Job Leads data is preserved too.
""",
        encoding="utf-8",
    )


def write_config(target: Path, build_id: str, include_google_creds: bool) -> None:
    config = {
        "anthropic_api_key": "",
        "google_client_id": "",
        "google_client_secret": "",
        "profile_complete": False,
        "install_build_id": build_id,
    }
    if include_google_creds:
        local = ROOT / "config.json"
        if local.is_file():
            try:
                existing = json.loads(local.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                existing = {}
            for key in ("google_client_id", "google_client_secret"):
                if existing.get(key):
                    config[key] = existing[key]
    (target / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", default="HEAD", help="git ref to package (default: HEAD)")
    parser.add_argument(
        "--include-google-creds",
        action="store_true",
        help="copy google_client_id/secret from the local bundled config.json into the package",
    )
    args = parser.parse_args()

    commit = git_rev(args.commit)
    build_id = f"install-{commit[:7]}"
    DIST.mkdir(exist_ok=True)
    target = DIST / build_id
    zip_path = DIST / f"JobSearchCoach-{commit[:7]}.zip"
    stable_zip = DIST / "JobSearchCoach-Install.zip"

    if target.exists():
        shutil.rmtree(target)

    print(f"Exporting JobSearchCoach {commit} ...")
    git_archive_extract(commit, target)
    for sub in ("JobLeadsTool/data", "JobLeadsTool/outputs"):
        (target / sub).mkdir(parents=True, exist_ok=True)

    write_config(target, build_id, args.include_google_creds)
    write_launchers(target, build_id, commit)
    (target / "VERSION.txt").write_text(f"jobsearchcoach_commit={commit}\n", encoding="utf-8")

    zip_path.unlink(missing_ok=True)
    zip_package(target, zip_path)
    stable_zip.unlink(missing_ok=True)
    shutil.copy2(zip_path, stable_zip)

    print(f"Built folder: {target}")
    print(f"Built zip:    {zip_path}")
    print(f"Also:         {stable_zip}")


if __name__ == "__main__":
    main()
