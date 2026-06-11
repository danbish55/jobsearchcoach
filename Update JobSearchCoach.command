#!/bin/bash
cd "$(dirname "$0")"
clear
echo "=============================================="
echo " JobSearchCoach Updater"
echo "=============================================="
echo
echo "This will update the app files from GitHub."
echo "A fresh backup will be made first."
echo "Your saved access key and Google Drive connection will be kept."
echo

python_cmd=""
if command -v python3 >/dev/null 2>&1; then
  python_cmd="python3"
elif command -v python >/dev/null 2>&1; then
  python_cmd="python"
else
  echo "Python 3 is required to update JobSearchCoach."
  open "https://www.python.org/downloads/macos/"
  read -n 1 -s -r -p "Press any key to close this window."
  exit 1
fi

"$python_cmd" - <<'PY'
from pathlib import Path
import shutil
import tempfile
import urllib.request
import zipfile
from datetime import datetime

APP_DIR = Path.cwd()
URL = "https://github.com/danbish55/jobsearchcoach/archive/refs/heads/main.zip"
KEEP = {"config.json"}
SKIP_DIRS = {".git", "dist", "backups", "__pycache__"}

def next_backup_dir():
    stamp = datetime.now().strftime("%Y%m%d")
    root = APP_DIR / "backups"
    root.mkdir(exist_ok=True)
    version = 1
    while True:
        candidate = root / f"{stamp} v{version} db JobSearchCoach"
        if not candidate.exists():
            return candidate
        version += 1

def make_backup():
    backup_dir = next_backup_dir()
    print(f"Creating backup: {backup_dir.name}")
    for item in APP_DIR.rglob("*"):
        rel = item.relative_to(APP_DIR)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if item.is_dir():
            continue
        dest = backup_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, dest)
    return backup_dir

with tempfile.TemporaryDirectory() as td:
    make_backup()
    tmp = Path(td)
    zip_path = tmp / "jobsearchcoach.zip"
    print("Downloading latest update...")
    urllib.request.urlretrieve(URL, zip_path)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(tmp)
    src_root = next(p for p in tmp.iterdir() if p.is_dir())

    print("Installing update...")
    for item in src_root.rglob("*"):
        rel = item.relative_to(src_root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if item.is_dir():
            continue
        if rel.name in KEEP:
            continue
        dest = APP_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, dest)

print("Update complete.")
PY

echo
echo "Done. You can start JobSearchCoach again."
read -n 1 -s -r -p "Press any key to close this window."
