import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ToolResult:
    tool: str
    duration_ms: int
    ok: bool


class ResultCounter:
    """Contrast an explicit __init__ with the generated dataclass initializer."""

    def __init__(self) -> None:
        self.successes = 0
        self.failures = 0

    def record(self, result: ToolResult) -> None:
        if result.ok:
            self.successes += 1
        else:
            self.failures += 1


def load_tool_results(path: str | Path) -> list[ToolResult]:
    with open(path, encoding="utf-8") as file:
        rows = json.load(file)
    if not isinstance(rows, list):
        raise ValueError("Expected a JSON array")

    results = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"tool", "duration_ms", "ok"}:
            raise ValueError("Each record needs exactly tool, duration_ms and ok")
        if not isinstance(row["tool"], str) or not row["tool"].strip():
            raise ValueError("tool must be nonblank text")
        if type(row["duration_ms"]) is not int or row["duration_ms"] < 0:
            raise ValueError("duration_ms must be a nonnegative integer")
        if type(row["ok"]) is not bool:
            raise ValueError("ok must be a boolean")
        results.append(ToolResult(**row))
    return results
