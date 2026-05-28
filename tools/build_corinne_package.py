#!/usr/bin/env python3
"""Build a clean Windows/Mac JobSearchCoach install package.

The generated package intentionally avoids native installers and unsigned
executables. It is a zip folder containing plain text launcher scripts.

Environment variables:
  JSC_GOOGLE_CLIENT_ID      Required for a production package.
  JSC_GOOGLE_CLIENT_SECRET  Required for a production package.
  JSC_PACKAGE_NAME          Optional, defaults to JobSearchCoach-Install.
  JSC_ALLOW_EMPTY_GOOGLE    Set to 1 only for local packaging tests.
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import time
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PACKAGE_NAME = os.environ.get("JSC_PACKAGE_NAME", "JobSearchCoach-Install").strip() or "JobSearchCoach-Install"

EXCLUDE_DIRS = {
    ".git",
    ".cursor",
    ".vscode",
    "backups",
    "dist",
    "tools",
    "__pycache__",
}
EXCLUDE_FILES = {
    ".DS_Store",
    ".gitignore",
    "Thumbs.db",
    "config.json",
    "launcher.bat",
    "README_DAN_PACKAGE.txt",
    "Update JobSearchCoach.command",
}

WINDOWS_LAUNCHER = """@echo off
setlocal EnableExtensions
title JobSearchCoach
cd /d "%~dp0"
cls
echo ==============================================
echo  JobSearchCoach
echo ==============================================
echo.
echo Starting your coaching app...
echo Your browser should open automatically.
echo.
echo To stop JobSearchCoach, close this window.
echo.

set "PYTHON_EXE="
set "PY_LAUNCHER_ARGS="
set "PYTHON_TEST=import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)"

where py >nul 2>&1
if %errorlevel%==0 (
    call :try_py_launcher -3.13
    if defined PY_LAUNCHER_ARGS goto run_with_py_launcher
    call :try_py_launcher -3.12
    if defined PY_LAUNCHER_ARGS goto run_with_py_launcher
    call :try_py_launcher -3
    if defined PY_LAUNCHER_ARGS goto run_with_py_launcher
)

for /f "delims=" %%P in ('where python 2^>nul') do (
    call :try_python_exe "%%P"
    if defined PYTHON_EXE goto run_with_python_exe
)

if defined PYTHON_EXE goto run_with_python_exe

for %%V in (313 312 311 310) do (
    if not defined PYTHON_EXE (
        if exist "%LocalAppData%\\Programs\\Python\\Python%%V\\python.exe" call :try_python_exe "%LocalAppData%\\Programs\\Python\\Python%%V\\python.exe"
    )
    if not defined PYTHON_EXE (
        if exist "%ProgramFiles%\\Python%%V\\python.exe" call :try_python_exe "%ProgramFiles%\\Python%%V\\python.exe"
    )
    if not defined PYTHON_EXE (
        if exist "%ProgramFiles(x86)%\\Python%%V\\python.exe" call :try_python_exe "%ProgramFiles(x86)%\\Python%%V\\python.exe"
    )
)

if defined PYTHON_EXE goto run_with_python_exe

for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$roots=@('HKCU:\\Software\\Python\\PythonCore','HKLM:\\Software\\Python\\PythonCore','HKLM:\\Software\\WOW6432Node\\Python\\PythonCore'); foreach($root in $roots){ if(Test-Path $root){ Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object { $ip=Join-Path $_.PSPath 'InstallPath'; if(Test-Path $ip){ $install=(Get-ItemProperty $ip -ErrorAction SilentlyContinue).'(default)'; if($install){ $exe=Join-Path $install 'python.exe'; if(Test-Path $exe){ Write-Output $exe } } } } } }"`) do (
    call :try_python_exe "%%P"
    if defined PYTHON_EXE goto run_with_python_exe
)

if defined PYTHON_EXE goto run_with_python_exe

echo Python 3 is required to run JobSearchCoach.
echo.
echo Please install Python from:
echo https://www.python.org/downloads/windows/
echo.
echo Important: during install, check "Add python.exe to PATH".
echo Then double-click this file again.
start "" "https://www.python.org/downloads/windows/"
goto done

:run_with_py_launcher
echo Found Python with launcher: py %PY_LAUNCHER_ARGS%
echo Opening JobSearchCoach in your browser...
start "" "http://localhost:8765"
echo.
py %PY_LAUNCHER_ARGS% -u server.py
goto done

:run_with_python_exe
echo Found Python: %PYTHON_EXE%
echo Opening JobSearchCoach in your browser...
start "" "http://localhost:8765"
echo.
"%PYTHON_EXE%" -u server.py
goto done

:try_py_launcher
py %~1 -c "%PYTHON_TEST%" >nul 2>&1
if %errorlevel%==0 set "PY_LAUNCHER_ARGS=%~1"
exit /b

:try_python_exe
if defined PYTHON_EXE exit /b
"%~1" -c "%PYTHON_TEST%" >nul 2>&1
if %errorlevel%==0 set "PYTHON_EXE=%~1"
exit /b

:done
echo.
pause
"""

MAC_LAUNCHER = """#!/bin/bash
cd "$(dirname "$0")"
clear
echo "=============================================="
echo " JobSearchCoach"
echo "=============================================="
echo
echo "Starting your coaching app..."
echo "Your browser should open automatically."
echo
echo "To stop JobSearchCoach, close this window."
echo

if command -v python3 >/dev/null 2>&1; then
  python3 server.py
elif command -v python >/dev/null 2>&1; then
  python server.py
else
  echo "Python 3 is required to run JobSearchCoach."
  echo
  echo "Opening the Python download page..."
  open "https://www.python.org/downloads/macos/"
  echo
  echo "After installing Python, double-click this file again."
  read -n 1 -s -r -p "Press any key to close this window."
fi
"""

README = """JobSearchCoach

Start here:

1. Open INSTALL.md and follow the steps for your computer.
2. Windows users double-click: Start JobSearchCoach.bat
3. Mac users double-click: Start JobSearchCoach.command

Your setup is private to this computer and your Google account:

- Your Claude/coach access key is stored only in config.json on this computer.
- Your job search data is stored in this browser and, after you connect Google Drive, in your own Google Drive app data.
- The app only asks Google Drive for permission to store files that belong to JobSearchCoach.

If something goes wrong, see the Troubleshooting section in INSTALL.md.
"""


def optional_env(name: str) -> str:
    return os.environ.get(name, "").strip()


def should_copy(path: Path) -> bool:
    rel_parts = set(path.relative_to(ROOT).parts)
    if rel_parts & EXCLUDE_DIRS:
        return False
    if path.name in EXCLUDE_FILES:
        return False
    if path.suffix == ".pyc":
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


def require_google_credentials() -> tuple[str, str]:
    client_id = optional_env("JSC_GOOGLE_CLIENT_ID")
    client_secret = optional_env("JSC_GOOGLE_CLIENT_SECRET")
    allow_empty = optional_env("JSC_ALLOW_EMPTY_GOOGLE") == "1"
    if allow_empty:
        return client_id, client_secret
    missing = []
    if not client_id:
        missing.append("JSC_GOOGLE_CLIENT_ID")
    if not client_secret:
        missing.append("JSC_GOOGLE_CLIENT_SECRET")
    if missing:
        names = ", ".join(missing)
        raise SystemExit(
            f"Missing {names}. Create a Google OAuth Desktop client, then set these "
            "environment variables before building the install package."
        )
    return client_id, client_secret


def write_config(target: Path, client_id: str, client_secret: str) -> None:
    config = {
        "anthropic_api_key": "",
        "google_client_id": client_id,
        "google_client_secret": client_secret,
        "profile_complete": False,
    }
    (target / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def write_launchers(target: Path) -> None:
    (target / "Start JobSearchCoach.bat").write_text(WINDOWS_LAUNCHER, encoding="utf-8", newline="\r\n")
    mac_path = target / "Start JobSearchCoach.command"
    mac_path.write_text(MAC_LAUNCHER, encoding="utf-8", newline="\n")
    mac_path.chmod(0o755)
    (target / "README.txt").write_text(README, encoding="utf-8", newline="\n")


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


def remove_tree(path: Path) -> None:
    def on_error(func, item, _exc_info):
        try:
            os.chmod(item, stat.S_IWRITE)
            func(item)
        except PermissionError:
            time.sleep(0.2)
            os.chmod(item, stat.S_IWRITE)
            func(item)

    shutil.rmtree(path, onerror=on_error)


def main() -> None:
    client_id, client_secret = require_google_credentials()
    DIST.mkdir(exist_ok=True)
    target = DIST / PACKAGE_NAME
    zip_path = DIST / f"{PACKAGE_NAME}.zip"

    if target.exists():
        remove_tree(target)
    if zip_path.exists():
        zip_path.unlink()

    target.mkdir(parents=True)
    copy_tree(target)
    write_config(target, client_id, client_secret)
    write_launchers(target)
    zip_package(target, zip_path)

    print(f"Built package folder: {target}")
    print(f"Built zip package:    {zip_path}")
    if not client_id or not client_secret:
        print("Warning: Google OAuth values are blank. This package is only suitable for local testing.")


if __name__ == "__main__":
    main()
