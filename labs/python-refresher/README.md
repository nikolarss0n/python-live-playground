# Python refresher: local practice pack

Use this optional pack alongside Days 7–8 for real files, modules, and pytest, then return for the async examples on Days 10–11. It runs on Python 3.11+ and has no AWS, web service, model, or account dependency.

These are **visible worked examples**, not unseen interview solutions. Passing their supplied tests confirms the examples run on your machine; it does not establish that you can rebuild them independently. No mock-interview variants or solutions are included.

## Start a Python file

Open a terminal in this folder and run:

```sh
python3 hello.py
```

`hello.py` defines `greeting(name)` and calls it beneath `if __name__ == "__main__":`. Running the file prints a greeting. Importing it defines the function without running the demonstration. Predict that difference, then verify it:

```sh
python3 -c "import hello; print(hello.greeting('Ada'))"
```

An import executes a module's top-level statements. The `__main__` guard is what keeps a script-only action out of that import path. [Python modules](https://docs.python.org/3/tutorial/modules.html).

## Create a virtual environment and install the test tools

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
.venv/bin/python -m pytest
.venv/bin/python -m python_refresher
.venv/bin/ruff check src tests hello.py
```

`.venv` keeps this pack's packages separate from your other projects. `-e` installs the source package in editable mode, so edits in `src/python_refresher/` are used immediately. `.[test]` adds pytest and Ruff; the example application itself uses only the standard library. Package installation needs network access, but running the examples and tests does not.

On Windows, use `py -m venv .venv`, then `.venv\Scripts\python.exe` and `.venv\Scripts\ruff.exe` in place of the executable paths above. Run all commands from the extracted lab folder.

## Read actual JSON files

```sh
.venv/bin/python -m python_refresher --file sample-results.json
```

Follow the imports from `__main__.py` → `cli.py` → `models.py`. `load_tool_results(path)` uses `with open` and `json.load`, validates the decoded records, and constructs `ToolResult` dataclass instances. The file closes when its `with` block exits, including on a JSON parsing error. These files are on your computer; browser playground files live in the temporary Python worker instead.

Three failures have different meanings:

- Invalid JSON syntax, such as a missing bracket, raises `json.JSONDecodeError`.
- Valid JSON with incorrect fields or types raises `ValueError` from record validation.
- A missing path raises `FileNotFoundError`.

Each record must contain exactly `tool`, `duration_ms`, and `ok`. A tool name is nonblank text; duration is a nonnegative integer excluding `bool`; `ok` is a boolean. An annotation does not validate JSON by itself. `ToolResult` supplies a generated initializer; `ResultCounter` deliberately writes `__init__` and uses `self` so you can compare both forms. Each counter instance owns separate counts.

Make a copy of `sample-results.json`, change `true` to `"yes"`, and run the command against your copy. Then remove a closing bracket. Explain why those two failures should not be treated as the same bug.

## Learn real pytest

```sh
.venv/bin/python -m pytest tests/test_examples.py -v
.venv/bin/python -m pytest tests/test_models.py -v
.venv/bin/python -m pytest -k timeout -v
```

`@pytest.mark.parametrize` runs one test against several input/expected-output pairs. `pytest.raises` verifies a specific failure contract. `tmp_path` gives each test its own temporary directory, so tests never need to overwrite your sample or personal files. The CLI tests also execute a real `.py` file and `python -m python_refresher` in subprocesses. [Parametrization](https://docs.pytest.org/en/stable/how-to/parametrize.html), [assertions and expected exceptions](https://docs.pytest.org/en/stable/how-to/assert.html).

Try this cycle before adding a feature:

1. Predict a boundary result, then add a test expressing it.
2. Make a deliberately wrong change, such as sorting the IDs or selecting the last timestamp tie, and check that the appropriate test fails.
3. Restore the correct behavior and explain the failure in your mistake log.

## Rebuild the foundations independently

Close `examples.py`, create `src/python_refresher/learner.py`, and implement these from memory:

- `unique_ids(ids)`: accept hashable IDs, retain first-seen order, preserve falsey IDs such as `0` and `""`, and leave the input unchanged.
- `latest_by_id(records)`: skip invalid records, select the greatest numeric timestamp for each nonempty string ID, retain the first record on ties, and return outer copies preserving every field. Exclude boolean timestamps. The exercise inputs do not include NaN or infinity; the copy is shallow.

In a copy of `tests/test_examples.py`, change its import from `python_refresher.examples` to `python_refresher.learner`. Run your copy explicitly, add a case the supplied tests did not show, and explain the result without looking at the implementation. Keep the original examples intact for later comparison. The pack does not silently replace the browser's independent progress checks.

## Run async Python from the command line

```sh
.venv/bin/python -m python_refresher --async-demo
.venv/bin/python -m pytest tests/test_async_tools.py -v
```

The CLI calls `asyncio.run(demo())` once at the entry point. `run_limited` admits at most two operations, returns results in input order, captures ordinary per-call errors, and times out slow work. The timeout begins after a call receives a slot. Timeout and external cancellation both wait for cleanup; external cancellation remains `CancelledError` rather than being reported as success. The examples use local waits, not HTTP requests.

The browser already owns an event loop; its checks await your async functions. Do not paste the CLI's `asyncio.run` entry point into that running loop. Async code overlaps waiting work; it does not automatically make CPU-heavy Python run in parallel. Cooperative cancellation also cannot rescue a coroutine that blocks the event-loop thread or deliberately suppresses cancellation. [Coroutines, tasks, and cancellation](https://docs.python.org/3/library/asyncio-task.html).

Finish by explaining where the semaphore is acquired, why errors do not reorder results, and which `finally` block runs when the caller cancels. Keep learning claims separate: a passing example, an independently solved exercise, and experience operating production systems are different kinds of evidence.
