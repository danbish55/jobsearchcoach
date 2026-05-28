#!/usr/bin/env python3
"""Build a Mac-friendly JobSearchCoach package for Corinne.

Optional environment variables:
  JSC_GOOGLE_CLIENT_ID
  JSC_GOOGLE_CLIENT_SECRET
  JSC_PACKAGE_NAME
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PACKAGE_NAME = os.environ.get("JSC_PACKAGE_NAME", "JobSearchCoach-Corinne")

EXCLUDE_DIRS = {".git", "dist", "tools", "__pycache__"}
EXCLUDE_FILES = {"config.json", "launcher.bat"}


def optional_env(name: str) -> str:
    return os.environ.get(name, "").strip()


def should_copy(path: Path) -> bool:
    rel_parts = set(path.relative_to(ROOT).parts)
    if rel_parts & EXCLUDE_DIRS:
        return False
    if path.name in EXCLUDE_FILES:
        return False
    return True


def copy_tree(target: Path) -> None:
    for src in ROOT.rglob("*"):
        if src.is_dir() or not should_copy(src):
            continue
        rel = src.relative_to(ROOT)
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def write_config(target: Path) -> None:
    config = {
        "anthropic_api_key": "",
        "google_client_id": optional_env("JSC_GOOGLE_CLIENT_ID"),
        "google_client_secret": optional_env("JSC_GOOGLE_CLIENT_SECRET"),
        "profile_complete": False,
    }
    (target / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def zip_package(target: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for src in target.rglob("*"):
            if src.is_dir():
                continue
            rel = src.relative_to(target.parent)
            info = zipfile.ZipInfo(str(rel).replace("\\", "/"))
            mode = 0o755 if src.name.endswith(".command") else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, src.read_bytes())


def main() -> None:
    DIST.mkdir(exist_ok=True)
    target = DIST / PACKAGE_NAME
    zip_path = DIST / f"{PACKAGE_NAME}.zip"

    if target.exists():
        shutil.rmtree(target)
    if zip_path.exists():
        zip_path.unlink()

    target.mkdir(parents=True)
    copy_tree(target)
    write_config(target)
    zip_package(target, zip_path)

    print(f"Built: {zip_path}")


if __name__ == "__main__":
    main()
