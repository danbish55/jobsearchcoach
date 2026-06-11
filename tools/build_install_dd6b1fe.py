#!/usr/bin/env python3
"""Build install zip from exact git commits (no dirty working tree).

JobSearchCoach: dd6b1fe
JobLeadsTool:    43cc5a1
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JL_ROOT = ROOT / "JobLeadsTool"
DIST = ROOT / "dist"
JSC_COMMIT = os.environ.get("JSC_COMMIT", "dd6b1fe")
JL_COMMIT = os.environ.get("JL_COMMIT", "43cc5a1")
FOLDER_NAME = os.environ.get("JSC_PACKAGE_NAME", "install-dd6b1fe")

JL_EXCLUDE_DIRS = {".git", ".venv", ".venv-google", "venv", "__pycache__", ".pytest_cache", "dist"}

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
for candidate in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [ -x "$candidate" ] && "$candidate" -c "$PYTHON_TEST" >/dev/null 2>&1; then PYTHON_EXE="$candidate"; break; fi
done
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
echo "JobSearchCoach Update (keeps OAuth and Job Leads data)"
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
echo "Done. Run Apply Update.command or Start JobSearchCoach.command"
read -n 1 -s -r -p "Press any key to close."
"""


def git_rev(repo: Path, ref: str) -> str:
    return subprocess.check_output(["git", "rev-parse", ref], cwd=repo, text=True).strip()


def git_archive_extract(repo: Path, commit: str, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        archive = Path(tmp.name)
    try:
        subprocess.check_call(
            ["git", "archive", "--format=zip", f"--output={archive}", commit],
            cwd=repo,
        )
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)
    finally:
        archive.unlink(missing_ok=True)


def zip_package(target: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for src in target.rglob("*"):
            if src.is_dir():
                continue
            rel = src.relative_to(target.parent)
            info = zipfile.ZipInfo(str(rel).replace("\\", "/"))
            mode = 0o755 if src.name.endswith(".command") else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            zf.writestr(info, src.read_bytes())


def write_launchers(target: Path) -> None:
    (target / "Start JobSearchCoach.command").write_text(MAC_START, encoding="utf-8", newline="\n")
    (target / "Start JobSearchCoach.command").chmod(0o755)
    (target / "Apply Update.command").write_text(APPLY_UPDATE_MAC, encoding="utf-8", newline="\n")
    (target / "Apply Update.command").chmod(0o755)
    (target / "First Time Setup.command").write_text(FIRST_TIME_MAC, encoding="utf-8", newline="\n")
    (target / "First Time Setup.command").chmod(0o755)
    shutil.copy2(Path(__file__).resolve().parent / "package_apply_update.py", target / "apply_update.py")
    (target / "README.txt").write_text(
        f"""JobSearchCoach install-dd6b1fe

JobSearchCoach git: {JSC_COMMIT}
JobLeadsTool git:   {JL_COMMIT}

Already installed on this Mac?
1. Unzip this zip to Desktop
2. Double-click Apply Update.command in folder {FOLDER_NAME}
3. Start the app from your EXISTING folder (the one Apply Update updated)

First install?
1. First Time Setup.command once
2. Start JobSearchCoach.command

See VERSION.txt and INSTALL.md.
""",
        encoding="utf-8",
    )


def write_config(target: Path) -> None:
    config = {
        "anthropic_api_key": "",
        "google_client_id": "",
        "google_client_secret": "",
        "profile_complete": False,
        "install_build_id": FOLDER_NAME,
        "jl_path": "JobLeadsTool",
    }
    (target / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    jsc_full = git_rev(ROOT, JSC_COMMIT)
    jl_full = git_rev(JL_ROOT, JL_COMMIT)
    DIST.mkdir(exist_ok=True)
    target = DIST / FOLDER_NAME
    zip_path = DIST / f"{FOLDER_NAME}.zip"
    stable_zip = DIST / "JobSearchCoach-Install.zip"

    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    print(f"Exporting JobSearchCoach {jsc_full} ...")
    git_archive_extract(ROOT, JSC_COMMIT, target)
    jl_dest = target / "JobLeadsTool"
    jl_dest.mkdir(parents=True, exist_ok=True)
    print(f"Exporting JobLeadsTool {jl_full} ...")
    git_archive_extract(JL_ROOT, JL_COMMIT, jl_dest)
    for sub in ("data", "outputs"):
        (jl_dest / sub).mkdir(parents=True, exist_ok=True)

    write_config(target)
    write_launchers(target)
    (target / "VERSION.txt").write_text(
        f"jobsearchcoach_commit={jsc_full}\njob_leads_tool_commit={jl_full}\n",
        encoding="utf-8",
    )

    if zip_path.exists():
        zip_path.unlink()
    zip_package(target, zip_path)
    if stable_zip.exists():
        stable_zip.unlink()
    shutil.copy2(zip_path, stable_zip)

    print(f"Built folder: {target}")
    print(f"Built zip:    {zip_path}")
    print(f"Also:         {stable_zip}")


if __name__ == "__main__":
    main()
