from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass
class SourceDefinition:
    source_id: str
    label: str
    source: str
    source_type: str
    enabled: bool = True
    source_name: str | None = None

    @property
    def id(self) -> str:
        return self.source_id

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


DEFAULT_SOURCES: list[SourceDefinition] = [
    SourceDefinition(
        source_id="sample-json",
        label="Sample JSON",
        source="data/sample.json",
        source_type="json",
        enabled=False,
        source_name="sample",
    ),
]


def export_sources_markdown(path: Path) -> Path:
    lines = ["# Sources", "", "| id | label | source | type | enabled |", "| --- | --- | --- | --- | --- |"]
    for item in DEFAULT_SOURCES:
        lines.append(f"| {item.id} | {item.label} | {item.source} | {item.source_type} | {item.enabled} |")

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    output = Path(path)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output
