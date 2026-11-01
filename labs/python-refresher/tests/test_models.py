import builtins
import json

import pytest

from python_refresher import models
from python_refresher.models import ResultCounter, ToolResult, load_tool_results


def test_real_file_loads_dataclasses_without_rewriting_or_caching(tmp_path):
    path = tmp_path / "results.json"
    original = '[{"tool": " search ", "duration_ms": 0, "ok": true}]'
    path.write_text(original, encoding="utf-8")
    assert load_tool_results(path) == [ToolResult(" search ", 0, True)]
    assert path.read_text(encoding="utf-8") == original
    path.write_text("[]", encoding="utf-8")
    assert load_tool_results(path) == []


@pytest.mark.parametrize(
    "records",
    [
        {},
        [None],
        [{"tool": "search", "duration_ms": 2}],
        [{"tool": "search", "duration_ms": 2, "ok": True, "extra": 1}],
        [{"tool": "   ", "duration_ms": 2, "ok": True}],
        [{"tool": "search", "duration_ms": True, "ok": True}],
        [{"tool": "search", "duration_ms": -1, "ok": True}],
        [{"tool": "search", "duration_ms": 2, "ok": "yes"}],
    ],
)
def test_valid_json_with_invalid_records_raises_value_error(tmp_path, records):
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(records), encoding="utf-8")
    with pytest.raises(ValueError) as error:
        load_tool_results(path)
    assert not isinstance(error.value, json.JSONDecodeError)


def test_syntax_errors_and_missing_files_keep_distinct_exceptions(tmp_path):
    path = tmp_path / "broken.json"
    path.write_text('[{"ok":', encoding="utf-8")
    with pytest.raises(json.JSONDecodeError):
        load_tool_results(path)
    with pytest.raises(FileNotFoundError):
        load_tool_results(tmp_path / "missing.json")


@pytest.mark.parametrize("contents", ["[]", "{broken"])
def test_with_open_closes_real_file_after_success_or_parse_error(tmp_path, monkeypatch, contents):
    path = tmp_path / "results.json"
    path.write_text(contents, encoding="utf-8")
    opened = []

    def tracked_open(*args, **kwargs):
        file = builtins.open(*args, **kwargs)
        opened.append(file)
        return file

    monkeypatch.setattr(models, "open", tracked_open, raising=False)
    if contents == "[]":
        assert load_tool_results(path) == []
    else:
        with pytest.raises(json.JSONDecodeError):
            load_tool_results(path)
    assert len(opened) == 1
    assert opened[0].closed


def test_class_instances_have_separate_self_state():
    first = ResultCounter()
    second = ResultCounter()
    first.record(ToolResult("search", 1, True))
    first.record(ToolResult("summarize", 2, False))
    assert (first.successes, first.failures) == (1, 1)
    assert (second.successes, second.failures) == (0, 0)
