from __future__ import annotations

from pathlib import Path


def export_file_to_drive(file: Path, name: str = "") -> dict[str, str]:
    file = Path(file)
    if not file.exists():
        return {
            "status": "error",
            "reason": f"missing file: {file}",
        }

    # Placeholder deterministic payload for environments without Drive integration.
    return {
        "status": "skipped",
        "reason": "drive export disabled in this environment",
        "file": str(file),
        "name": name or file.name,
    }
