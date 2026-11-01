import json
import subprocess
import sys
from pathlib import Path

import pytest

from python_refresher.cli import main

LAB_ROOT = Path(__file__).resolve().parents[1]


def test_python_file_runs_only_under_main_guard(tmp_path):
    hello = LAB_ROOT / "hello.py"
    direct = subprocess.run(
        [sys.executable, str(hello)],
        capture_output=True,
        text=True,
        cwd=tmp_path,
        timeout=5,
        check=True,
    )
    assert direct.stdout.strip() == "Hello, Python learner!"
    imported = subprocess.run(
        [sys.executable, "-c", f"import runpy; runpy.run_path({str(hello)!r})"],
        capture_output=True,
        text=True,
        cwd=tmp_path,
        timeout=5,
        check=True,
    )
    assert imported.stdout == ""


def test_package_module_runs_from_outside_project_directory(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "python_refresher"],
        capture_output=True,
        text=True,
        cwd=tmp_path,
        timeout=5,
        check=True,
    )
    assert json.loads(result.stdout)["unique_ids"] == ["b", "a", "c"]


def test_cli_reads_real_json_file(tmp_path, capsys):
    path = tmp_path / "results.json"
    path.write_text('[{"tool":"search","duration_ms":4,"ok":true}]', encoding="utf-8")
    assert main(["--file", str(path)]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["successes"] == 1
    assert output["records"][0]["tool"] == "search"


@pytest.mark.parametrize(
    "contents,message",
    [
        ("{broken", "Malformed JSON syntax."),
        ('[{"ok": true}]', "Valid JSON, but invalid record contents."),
    ],
)
def test_cli_reports_syntax_and_record_failures_distinctly(tmp_path, capsys, contents, message):
    path = tmp_path / "bad.json"
    path.write_text(contents, encoding="utf-8")
    assert main(["--file", str(path)]) == 2
    assert capsys.readouterr().err.strip() == message


def test_cli_missing_file(tmp_path, capsys):
    assert main(["--file", str(tmp_path / "missing.json")]) == 2
    assert capsys.readouterr().err.strip() == "File not found."


def test_cli_asyncio_run_entry(capsys):
    assert main(["--async-demo"]) == 0
    assert json.loads(capsys.readouterr().out)[-1] == {"ok": False, "error": "timeout"}


def test_argparse_rejects_unknown_options():
    with pytest.raises(SystemExit) as error:
        main(["--unknown"])
    assert error.value.code == 2
