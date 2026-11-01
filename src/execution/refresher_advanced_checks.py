"""Behavior checks for refresher days 8–13; day 14 uses selected earlier checks."""

import asyncio
import builtins
from copy import deepcopy
from dataclasses import asdict, is_dataclass
import inspect
import json
from pathlib import Path
import tempfile


def _require(condition, message):
    if not condition:
        raise AssertionError(message)


def _function(namespace, name):
    function = namespace.get(name)
    _require(callable(function), "Define " + name + " with the stated signature.")
    return function


def _invalid(operation, message="Invalid input must raise ValueError."):
    try:
        operation()
    except ValueError:
        return
    raise AssertionError(message)


def _read_fixture(function, text):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "results.json"
        path.write_text(text, encoding="utf-8")
        result = function(str(path))
        _require(path.read_text(encoding="utf-8") == text, "Leave the supplied file unchanged.")
        return result


def _file_models(namespace, context):
    load = _function(namespace, "load_tool_results")
    for rows in ([], [{"tool": "search", "duration_ms": 12, "ok": True}, {"tool": " parse ", "duration_ms": 0, "ok": False}]):
        result = _read_fixture(load, json.dumps(rows))
        _require(isinstance(result, list) and len(result) == len(rows), "Return one result per JSON record, in a list.")
        _require(all(is_dataclass(item) and not isinstance(item, type) and type(item).__name__ == "ToolResult" for item in result), "Return ToolResult dataclass instances, not dictionaries.")
        _require([asdict(item) for item in result] == rows, "Preserve every valid field and the file order.")


def _json_boundaries(namespace, context):
    load = _function(namespace, "load_tool_results")
    try:
        _read_fixture(load, '[{"tool":')
    except json.JSONDecodeError:
        pass
    else:
        raise AssertionError("Keep JSONDecodeError for malformed JSON syntax.")
    good = {"tool": "search", "duration_ms": 1, "ok": True}
    bad_values = [None, {}, [None], [{"tool": "search"}], [{**good, "extra": 1}], [{**good, "tool": " "}], [{**good, "tool": 1}], [{**good, "duration_ms": -1}], [{**good, "duration_ms": True}], [{**good, "ok": 1}]]
    for value in bad_values:
        try:
            _read_fixture(load, json.dumps(value))
        except json.JSONDecodeError:
            raise AssertionError("Well-formed JSON with invalid records needs ValueError, not JSONDecodeError.")
        except ValueError:
            continue
        raise AssertionError("Reject well-formed but invalid record contents with ValueError.")


def _file_lifecycle(namespace, context):
    load = _function(namespace, "load_tool_results")
    handles = []
    sentinel = object()
    original = namespace.get("open", sentinel)

    def tracked_open(*args, **kwargs):
        handle = builtins.open(*args, **kwargs)
        handles.append(handle)
        return handle

    namespace["open"] = tracked_open
    try:
        _read_fixture(load, '[{"tool":"fresh","duration_ms":7,"ok":true}]')
        _require(handles and all(handle.closed for handle in handles), "Close the file after a successful read, using with open.")
        try:
            _read_fixture(load, '{broken')
        except json.JSONDecodeError:
            pass
        _require(all(handle.closed for handle in handles), "Close the file even when JSON parsing raises.")
        with tempfile.TemporaryDirectory() as directory:
            try:
                load(str(Path(directory) / "missing.json"))
            except FileNotFoundError:
                pass
            else:
                raise AssertionError("Preserve FileNotFoundError for a missing file.")
    finally:
        for handle in handles:
            handle.close()
        if original is sentinel:
            namespace.pop("open", None)
        else:
            namespace["open"] = original


def _retry_fixture(function, outcomes, attempts=3, key="test-key"):
    calls, delays = [], []

    def operation(operation_key):
        index = len(calls)
        calls.append(operation_key)
        _require(index < len(outcomes), "Do not exceed the specified attempt budget.")
        result = outcomes[index]
        if isinstance(result, Exception):
            raise result
        return deepcopy(result)

    result = function(operation, delays.append, max_attempts=attempts, idempotency_key=key)
    return result, calls, delays


def _retry_recovery(namespace, context):
    retry = _function(namespace, "retry_request")
    outcomes = [{"status": 503, "body": "busy"}, {"status": 429}, {"status": 201, "body": {"id": "j1"}}]
    result, keys, delays = _retry_fixture(retry, outcomes)
    _require(result == {"attempts": 3, "response": outcomes[-1]}, "Return the successful third response and the total attempt count.")
    _require(keys == ["test-key"] * 3 and delays == [0.1, 0.2], "Reuse the key and back off for 0.1 then 0.2 seconds.")
    result, keys, delays = _retry_fixture(retry, [TimeoutError("fixture"), {"status": 200}])
    _require(result == {"attempts": 2, "response": {"status": 200}} and delays == [0.1], "A fixture timeout may recover within the same bounded policy.")


def _retry_stop(namespace, context):
    retry = _function(namespace, "retry_request")
    for status in (200, 400, 401, 403, 404, 422):
        result, calls, delays = _retry_fixture(retry, [{"status": status}, {"status": 200}])
        _require(result == {"attempts": 1, "response": {"status": status}} and len(calls) == 1 and not delays, "Return success and permanent failures immediately, without sleeping.")
    for limit in (1, 2, 5):
        result, calls, delays = _retry_fixture(retry, [{"status": 503}] * 6, limit)
        _require(result == {"attempts": limit, "response": {"status": 503}} and len(calls) == limit, "Exhaustion must return the last failure after exactly max_attempts calls.")
        _require(delays == [0.1 * 2 ** index for index in range(limit - 1)], "Never wait after the last attempt.")
    result, _, _ = _retry_fixture(retry, [TimeoutError("fixture")], 1)
    _require(result == {"attempts": 1, "response": {"status": 504, "body": {"error": "timeout"}}}, "Represent an exhausted TimeoutError as the stated 504 response.")


def _retry_contract(namespace, context):
    retry = _function(namespace, "retry_request")
    for limit, key in ((0, "key"), (6, "key"), (True, "key"), (1.5, "key"), (2, ""), (2, None)):
        calls = []
        _invalid(lambda: retry(lambda value: calls.append(value), calls.append, max_attempts=limit, idempotency_key=key))
        _require(not calls, "Validate the budget and key before calling the operation or sleep.")
    try:
        _retry_fixture(retry, [RuntimeError("unexpected")])
    except RuntimeError:
        pass
    else:
        raise AssertionError("Do not swallow unexpected operation exceptions.")
    result, keys, _ = _retry_fixture(retry, [{"status": 504}, {"status": 200}], key="another-key")
    _require(result["attempts"] == 2 and keys == ["another-key", "another-key"], "Use the caller's key, not a hardcoded or changing key.")


async def _async_sequential(namespace, context):
    run = _function(namespace, "run_sequential")
    events = []

    def make(index):
        async def call():
            events.append(("start", index))
            await asyncio.sleep(0)
            events.append(("end", index))
            return index * 10
        return call

    result = await run([make(index) for index in range(3)])
    _require(result == [0, 10, 20], "Return all three sequential values in input order.")
    _require(events == [(event, index) for index in range(3) for event in ("start", "end")], "Each sequential call must finish before the next one starts.")


async def _async_concurrent(namespace, context):
    run = _function(namespace, "run_concurrent")
    started, finished = [], []
    ready = asyncio.Event()

    def make(index):
        async def call():
            started.append(index)
            if len(started) == 3:
                ready.set()
            await ready.wait()
            await asyncio.sleep((2 - index) * 0.005)
            finished.append(index)
            return index * 10
        return call

    result = await asyncio.wait_for(run([make(index) for index in range(3)]), timeout=0.5)
    _require(sorted(started) == [0, 1, 2] and result == [0, 10, 20], "Start each of the three calls once and preserve input order in results.")
    _require(finished[0] == 2, "Independent waits must be able to overlap.")


async def _async_boundaries(namespace, context):
    async def broken():
        raise LookupError("fixture error")

    for name in ("run_sequential", "run_concurrent"):
        run = _function(namespace, name)
        _require(await run([]) == [], "Empty call lists must return [].")
        try:
            await run([broken])
        except LookupError:
            continue
        raise AssertionError("Let the original task exception remain visible.")


async def _concurrent_boundaries(namespace, context):
    run = _function(namespace, "run_concurrent")
    _require(await run([]) == [], "An empty concurrent workload returns [].")
    calls = []

    async def single():
        calls.append("called")
        return 42

    _require(await run([single]) == [42] and calls == ["called"], "Run a single callable exactly once and return its value in a list.")


async def _concurrent_errors(namespace, context):
    run = _function(namespace, "run_concurrent")

    async def broken():
        raise LookupError("fixture failure")

    try:
        await run([broken])
    except LookupError:
        return
    raise AssertionError("Preserve the task's original exception; do not replace failure with a result.")


async def _limited_concurrency(namespace, context):
    run = _function(namespace, "run_limited")
    active, peak, calls = 0, 0, []
    two_started = asyncio.Event()

    def make(index):
        async def call():
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            calls.append(index)
            if active == 2:
                two_started.set()
            try:
                await two_started.wait()
                await asyncio.sleep(0.005)
                return index
            finally:
                active -= 1
        return call

    result = await asyncio.wait_for(run([make(index) for index in range(5)], timeout_s=0.2), timeout=0.6)
    _require(peak == 2 and active == 0 and sorted(calls) == list(range(5)), "Use both slots, never exceed two active operations, and finish every call.")
    _require(result == [{"ok": True, "value": index} for index in range(5)], "Preserve input order while queued work uses the two slots.")


async def _limited_results(namespace, context):
    run = _function(namespace, "run_limited")

    async def slow_success():
        await asyncio.sleep(0.01)
        return "first"

    async def failure():
        raise ValueError("private error detail")

    async def fast_success():
        return "third"

    result = await run([slow_success, failure, fast_success], timeout_s=0.2)
    _require(result == [{"ok": True, "value": "first"}, {"ok": False, "error": "ValueError"}, {"ok": True, "value": "third"}], "Keep one ordered result per call and expose only the exception class for ordinary failures.")
    _require(await run([]) == [], "An empty workload returns [].")
    for timeout in (0, -1, True, "0.1", float("inf"), float("nan")):
        calls = []

        async def tracked():
            calls.append("started")

        try:
            await run([tracked], timeout_s=timeout)
        except ValueError:
            _require(not calls, "Validate timeout_s before starting work.")
            continue
        raise AssertionError("Reject nonpositive, nonfinite and wrongly typed timeout values.")


async def _limited_cleanup(namespace, context):
    run = _function(namespace, "run_limited")
    events = []

    async def slow():
        events.append("started")
        try:
            await asyncio.Event().wait()
        finally:
            await asyncio.sleep(0)
            events.append("closed")

    result = await asyncio.wait_for(run([slow], timeout_s=0.005), timeout=0.5)
    _require(result == [{"ok": False, "error": "timeout"}] and events == ["started", "closed"], "A timeout must cancel the operation and await its finally cleanup before returning.")
    started = asyncio.Event()
    cleaned = []

    async def cancellable():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            await asyncio.sleep(0)
            cleaned.append(True)

    task = asyncio.create_task(run([cancellable], timeout_s=1))
    await asyncio.wait_for(started.wait(), timeout=0.25)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        _require(cleaned == [True], "External cancellation must also await the operation's cleanup.")
    else:
        raise AssertionError("Do not swallow external CancelledError as an ordinary result.")


def _data_function(namespace, variant):
    return _function(namespace, {"a": "summarize_slots", "b": "reconcile_stock", "c": "rank_readings"}[variant])


def _mock_valid(namespace, context):
    variant = context["variant"]
    function = _data_function(namespace, variant)
    if variant == "a":
        data = [{"room": "B", "start": 0, "end": 10}, {"room": "A", "start": 5, "end": 15}, {"room": "B", "start": 8, "end": 13}]
        expected = [{"room": "B", "minutes": 15, "bookings": 2}, {"room": "A", "minutes": 10, "bookings": 1}]
    elif variant == "b":
        data = [{"item": "pen", "delta": 4}, {"item": "book", "delta": -2}, {"item": "pen", "delta": -1}]
        expected = [{"item": "book", "balance": -2, "changes": 1}, {"item": "pen", "balance": 3, "changes": 2}]
    else:
        data = [{"sensor": "B", "value": 9}, {"sensor": "A", "value": 2}, {"sensor": "A", "value": 4}]
        expected = [{"sensor": "B", "mean": 9.0, "samples": 1}, {"sensor": "A", "mean": 3.0, "samples": 2}]
    original = deepcopy(data)
    _require(function(data) == expected, "The main transformation must match the specified output contract.")
    _require(data == original, "Do not mutate the input records.")


def _mock_boundaries(namespace, context):
    variant = context["variant"]
    function = _data_function(namespace, variant)
    _require(function([]) == [], "Empty input returns [].")
    if variant == "a":
        data = [{"room": "Z", "start": 0, "end": 2}, {"room": "A", "start": 8, "end": 10}]
        _require([row["room"] for row in function(data)] == ["A", "Z"], "Tied minute totals sort by room ascending.")
    elif variant == "b":
        _require(function([{"item": "zero", "delta": 3}, {"item": "zero", "delta": -3}]) == [{"item": "zero", "balance": 0, "changes": 2}], "Keep zero balances and count every adjustment.")
    else:
        data = [{"sensor": "Z", "value": 2.0}, {"sensor": "A", "value": 1}, {"sensor": "A", "value": 3}]
        _require(function(data, limit=1) == [{"sensor": "A", "mean": 2.0, "samples": 2}], "Tied means sort by sensor; apply the limit after grouping.")
        _require(function(data, limit=0) == [], "A valid zero limit returns [].")


def _mock_inputs(namespace, context):
    variant = context["variant"]
    function = _data_function(namespace, variant)
    bad = [None, {}, [None]]
    if variant == "a":
        good = {"room": "A", "start": 0, "end": 2}
        bad += [[{}], [{**good, "extra": 1}], [{**good, "room": " "}], [{**good, "start": True}], [{**good, "start": -1}], [{**good, "end": 0}]]
    elif variant == "b":
        good = {"item": "pen", "delta": 1}
        bad += [[{}], [{**good, "extra": 1}], [{**good, "item": " "}], [{**good, "delta": True}], [{**good, "delta": "1"}]]
    else:
        good = {"sensor": "A", "value": 2}
        bad += [[{}], [{**good, "extra": 1}], [{**good, "sensor": " "}], [{**good, "value": True}], [{**good, "value": float("inf")}], [{**good, "value": float("nan")}]]
        for limit in (-1, True, 1.5):
            _invalid(lambda: function([], limit=limit))
        _invalid(lambda: function([{}], limit=0), "Validate readings even with limit zero.")
    for value in bad:
        _invalid(lambda: function(value))


def _dispatch_cases(namespace, follow_up, part):
    dispatch = _function(namespace, "dispatch_jobs")
    calls = []

    def execute(payload):
        calls.append(deepcopy(payload))
        if payload.get("fail"):
            raise LookupError("private detail")
        return payload["n"] * 2

    if part == 0:
        jobs = [{"job_id": "x", "payload": {"n": 2}}, {"job_id": "y", "payload": {"n": 3}}]
        original = deepcopy(jobs)
        _require(dispatch(jobs, execute) == [{"job_id": "x", "ok": True, "value": 4}, {"job_id": "y", "ok": True, "value": 6}], "Return one ordered result for every executed job.")
        _require(jobs == original and len(calls) == 2, "Execute each ordinary job once without changing input.")
    elif part == 1:
        result = dispatch([{"job_id": "x", "payload": {"fail": True}}, {"job_id": "y", "payload": {"n": 2}}], execute)
        _require(result == [{"job_id": "x", "ok": False, "error": "LookupError"}, {"job_id": "y", "ok": True, "value": 4}], "Contain each ordinary failure and continue later jobs without exposing exception messages.")
        for bad in (None, [None], [{"job_id": "", "payload": {}}], [{"job_id": "x", "payload": []}]):
            calls.clear()
            _invalid(lambda: dispatch(bad, execute))
            _require(not calls, "Validate before executing any job.")
        calls.clear()
        _invalid(lambda: dispatch([{"job_id": "x", "payload": {"n": 1}}, {"job_id": "y"}], execute))
        _require(not calls, "Validate the entire batch before its first execution, including after the follow-up change.")
    elif follow_up:
        jobs = [{"job_id": "x", "payload": {"n": 2}}, {"job_id": "x", "payload": {"n": 2}}, {"job_id": "x", "payload": {"n": 3}}, {"job_id": "z", "payload": {"fail": True}}, {"job_id": "z", "payload": {"fail": True}}]
        result = dispatch(jobs, execute)
        _require(result == [{"job_id": "x", "ok": True, "value": 4}, {"job_id": "x", "ok": True, "value": 4}, {"job_id": "x", "ok": False, "error": "conflict"}, {"job_id": "z", "ok": False, "error": "LookupError"}, {"job_id": "z", "ok": False, "error": "LookupError"}], "Replay identical IDs and payloads, including failures; reject conflicting payloads.")
        _require(calls == [{"n": 2}, {"fail": True}], "Replays and conflicts must not execute again.")
    else:
        _require(dispatch([], execute) == [], "An empty batch returns [].")
        _invalid(lambda: dispatch([{"job_id": "x", "payload": {"n": 1}}, {"job_id": "y"}], execute))
        _require(not calls, "Validate the entire batch before any execution.")


def _plan_cases(namespace, follow_up, part):
    run = _function(namespace, "run_plan")
    calls = []

    def double(payload):
        calls.append(deepcopy(payload))
        return payload["n"] * 2

    def broken(payload):
        calls.append("failure")
        raise ValueError("private detail")

    handlers = {"double": double, "broken": broken}
    if part == 0:
        steps = [{"name": "double", "input": {"n": 2}}, {"name": "double", "input": {"n": 3}}]
        original = deepcopy(steps)
        _require(run(steps, handlers) == [{"name": "double", "ok": True, "value": 4}, {"name": "double", "ok": True, "value": 6}], "Return ordered results from the matching named handlers.")
        _require(steps == original and len(calls) == 2, "Do not change input or execute an ordinary step twice.")
    elif part == 1:
        result = run([{"name": "unknown", "input": {}}, {"name": "broken", "input": {}}, {"name": "double", "input": {"n": 3}}], handlers)
        _require(result == [{"name": "unknown", "ok": False, "error": "unknown_handler"}, {"name": "broken", "ok": False, "error": "ValueError"}, {"name": "double", "ok": True, "value": 6}], "Keep unknown handlers and exceptions as safe per-step failures while other steps continue.")
        for bad in (None, [None], [{"name": "", "input": {}}], [{"name": "double", "input": []}]):
            calls.clear()
            _invalid(lambda: run(bad, handlers))
            _require(not calls, "Validate before executing any handler.")
        calls.clear()
        _invalid(lambda: run([{"name": "double", "input": {"n": 1}}, {"name": "double"}], handlers))
        _require(not calls, "Validate the entire plan before execution, including after dependencies are added.")
    elif follow_up:
        steps = [{"name": "broken", "input": {}}, {"name": "double", "input": {"n": 2}, "depends_on": [0]}, {"name": "double", "input": {"n": 3}}, {"name": "double", "input": {"n": 4}, "depends_on": [1]}, {"name": "double", "input": {"n": 5}, "depends_on": [2]}]
        result = run(steps, handlers)
        _require([row.get("error") for row in result] == ["ValueError", "dependency_failed", None, "dependency_failed", None], "Skip failed dependency chains but allow independent and successful-dependent steps.")
        _require(calls == ["failure", {"n": 3}, {"n": 5}], "Never execute a skipped step.")
        for dependency in ([0], [-1], [True], "0"):
            calls.clear()
            _invalid(lambda: run([{"name": "double", "input": {"n": 1}, "depends_on": dependency}], handlers))
            _require(not calls, "Reject malformed or non-earlier dependencies before execution.")
        for dependency in ([99], [False], [-1]):
            calls.clear()
            steps = [{"name": "double", "input": {"n": 1}}, {"name": "double", "input": {"n": 2}, "depends_on": dependency}]
            _invalid(lambda: run(steps, handlers))
            _require(not calls, "Validate later dependencies before any handler runs; bool is not an allowed prior index.")
    else:
        _require(run([], handlers) == [], "An empty plan returns [].")
        _invalid(lambda: run([{"name": "double", "input": {"n": 1}}, {"name": "double"}], handlers))
        _require(not calls, "Validate the entire plan before running its first step.")


def _batch_cases(namespace, follow_up, part):
    run = _function(namespace, "execute_batch")
    calls = []

    def sender(statuses):
        position = 0

        def send(item):
            nonlocal position
            calls.append(deepcopy(item))
            _require(position < len(statuses), "Do not exceed the allowed send count.")
            status = statuses[position]
            position += 1
            return status
        return send

    items = [{"id": "a", "body": "one"}, {"id": "b", "body": "two"}]
    if part == 0:
        original = deepcopy(items)
        result = run(items, sender([503, 200, 201]))
        _require(result == [{"id": "a", "status": 200, "attempts": 2}, {"id": "b", "status": 201, "attempts": 1}], "Retry a 503 within the item budget and preserve batch order.")
        _require(items == original and [item["id"] for item in calls] == ["a", "a", "b"], "Do not mutate items or retry the wrong item.")
    elif part == 1:
        result = run(items, sender([403, 503, 503]))
        _require(result == [{"id": "a", "status": 403, "attempts": 1}, {"id": "b", "status": 503, "attempts": 2}], "Permanent statuses stop immediately; exhausted retries retain the last status.")
        for bad in (None, [None], [{"id": "", "body": "x"}], [{"id": "x", "body": None}]):
            calls.clear()
            _invalid(lambda: run(bad, sender([200])))
            _require(not calls, "Validate items before sending.")
        calls.clear()
        for limit in (0, 4, True, 1.5):
            _invalid(lambda: run(items, sender([200]), max_attempts=limit))
        _invalid(lambda: run([items[0], {"id": "broken"}], sender([200])))
        _require(not calls, "Keep whole-batch and attempt-budget validation after the requirement change.")
    elif follow_up:
        items.append({"id": "c", "body": "three"})
        result = run(items, sender([200, 429]))
        _require(result == [{"id": "a", "status": 200, "attempts": 1}, {"id": "b", "status": 429, "attempts": 1}, {"id": "c", "status": None, "attempts": 0, "error": "paused"}], "After a 429, retain existing results and mark every unsent item paused.")
        _require([item["id"] for item in calls] == ["a", "b"], "Never retry 429 or send items after the batch pauses.")
    else:
        _require(run([], sender([])) == [], "An empty batch returns [].")
        for limit in (0, 4, True, 1.5):
            _invalid(lambda: run(items, sender([200]), max_attempts=limit))
        _invalid(lambda: run([items[0], {"id": "broken"}], sender([200])))
        _require(not calls, "Validate the full batch and attempt budget before sends.")


def _reliability_part(namespace, context, part):
    function = {"a": _dispatch_cases, "b": _plan_cases, "c": _batch_cases}[context["variant"]]
    function(namespace, context.get("followUp") is True, part)


_CHECKS = {
    "refresher-08": [("file-models", "Load real JSON files into dataclasses", _file_models), ("json-boundaries", "Distinguish syntax errors from invalid records", _json_boundaries), ("file-lifecycle", "Close the supplied file without changing it", _file_lifecycle)],
    "refresher-09": [("retry-recovery", "Recover after two failures with measured backoff", _retry_recovery), ("retry-stop", "Stop on exhaustion and permanent failures", _retry_stop), ("retry-contract", "Preserve the key and validate the retry boundary", _retry_contract)],
    "refresher-10": [("async-sequential", "Run three calls in sequence", _async_sequential), ("async-concurrent", "Overlap three calls while preserving result order", _async_concurrent), ("async-boundaries", "Handle empty work and expose task failures", _async_boundaries)],
    "refresher-11": [("limited-concurrency", "Use at most two active calls", _limited_concurrency), ("limited-results", "Preserve ordered success and failure results", _limited_results), ("limited-cleanup", "Await timeout cleanup and preserve cancellation", _limited_cleanup)],
    "refresher-12": [("mock-valid", "Meet the main transformation contract", _mock_valid), ("mock-boundaries", "Handle empty inputs, ties and boundaries", _mock_boundaries), ("mock-inputs", "Validate inputs without mutating them", _mock_inputs)],
    "refresher-13": [("mock-execution", "Execute valid work and preserve result order", lambda ns, context: _reliability_part(ns, context, 0)), ("mock-failures", "Contain failures and validate before execution", lambda ns, context: _reliability_part(ns, context, 1)), ("mock-follow-up", "Meet the active reliability requirements", lambda ns, context: _reliability_part(ns, context, 2))],
}


_CONSOLIDATION_NAMES = {"refresher-08": "load_tool_results", "refresher-09": "retry_request", "refresher-10": "run_concurrent", "refresher-11": "run_limited"}
_CONSOLIDATION_CHECKS = {
    "refresher-10": [("async-concurrent", "Overlap three calls while preserving result order", _async_concurrent), ("concurrent-boundaries", "Handle empty and single-call workloads", _concurrent_boundaries), ("concurrent-errors", "Expose the original task failure", _concurrent_errors)],
}


async def check_refresher_advanced(namespace, exercise_id, context=None):
    context = context if isinstance(context, dict) else {}
    if exercise_id in ("refresher-12", "refresher-13") and context.get("variant") not in ("a", "b", "c"):
        return []
    results = []
    consolidation = context.get("consolidation") is True and exercise_id in _CONSOLIDATION_NAMES
    checks = _CONSOLIDATION_CHECKS.get(exercise_id, _CHECKS.get(exercise_id, [])) if consolidation else _CHECKS.get(exercise_id, [])
    for check_id, label, probe in checks:
        if consolidation:
            label = _CONSOLIDATION_NAMES[exercise_id] + ": " + label
        prior_tasks = asyncio.all_tasks()
        try:
            outcome = probe(namespace, context)
            if inspect.isawaitable(outcome):
                await outcome
            results.append({"id": check_id, "label": label, "passed": True, "detail": "Passed"})
        except Exception as error:
            results.append({"id": check_id, "label": label, "passed": False, "detail": str(error)[:300] or type(error).__name__})
        finally:
            pending = [task for task in asyncio.all_tasks() - prior_tasks if not task.done()]
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
    return results
