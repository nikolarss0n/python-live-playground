"""Behavior checks for refresher days 1–7; no source-text grading."""

import contextlib
import copy
import inspect
import io


def _require(condition, message):
    if not condition:
        raise AssertionError(message)


def _function(namespace, name):
    function = namespace.get(name)
    _require(callable(function), "Define " + name + " before checking this exercise.")
    return function


def _format_values(namespace):
    function = _function(namespace, "format_tool")
    for arguments in (("search", 0.25, True), ("lookup", 12.5, True), ("read", 1.236, False)):
        name, duration, success = arguments
        expected = f"{name}: {duration:.2f}s (success={success})"
        _require(function(*arguments) == expected, "Return the supplied values with duration formatted to two decimal places.")


def _format_false_zero(namespace):
    function = _function(namespace, "format_tool")
    _require(function("cached", 0, False) == "cached: 0.00s (success=False)", "Keep zero duration and False success in the formatted result.")
    _require(function("", 0.005, True) == f": {0.005:.2f}s (success=True)", "Format the provided name even when it is empty; do not substitute a different name.")


def _return_not_print(namespace):
    function = _function(namespace, "format_tool")
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        result = function("report", 2, True)
    _require(isinstance(result, str), "Use return to provide a string to the caller.")
    _require(output.getvalue() == "", "Keep print outside format_tool; the function should only return its text.")


def _count_statuses(namespace):
    function = _function(namespace, "count_runs")
    _require(function([True, False, True, False, True]) == {"success": 3, "failed": 2, "skipped": 0}, "Count each actual True and False exactly once.")
    _require(function([False, False]) == {"success": 0, "failed": 2, "skipped": 0}, "False belongs in failed, not skipped.")


def _count_empty(namespace):
    function = _function(namespace, "count_runs")
    _require(function([]) == {"success": 0, "failed": 0, "skipped": 0}, "Return all three zero counters for an empty input.")
    values = [False, None, True]
    before = list(values)
    function(values)
    _require(values == before, "Count without changing the input list.")


def _count_missing(namespace):
    function = _function(namespace, "count_runs")
    values = [None, 0, 1, "yes", "", True, False]
    _require(function(values) == {"success": 1, "failed": 1, "skipped": 5}, "Use actual boolean identity, not general truthiness or equality with 1 and 0.")


def _unique_order(namespace):
    function = _function(namespace, "unique_ids")
    _require(function(["b", "a", "b", "c", "a"]) == ["b", "a", "c"], "Preserve first-seen order instead of sorting the IDs.")
    _require(function([3, 1, 3, 2, 1]) == [3, 1, 2], "Deduplicate numeric IDs as well as text IDs.")


def _unique_empty_falsey(namespace):
    function = _function(namespace, "unique_ids")
    _require(function([]) == [], "An empty input needs an empty list result.")
    _require(function([0, "", "a", 0, "", "a"]) == [0, "", "a"], "Keep zero and empty-string IDs; they are valid hashable values.")


def _unique_no_mutation(namespace):
    function = _function(namespace, "unique_ids")
    values = ["z", "a", "z"]
    result = function(values)
    _require(values == ["z", "a", "z"], "Do not sort, pop from, or otherwise mutate ids.")
    _require(isinstance(result, list) and result is not values, "Return a new result list.")
    result.append("changed")
    _require(function(["fresh", "fresh"]) == ["fresh"], "Do not share result state between calls.")


def _latest_winners(namespace):
    function = _function(namespace, "latest_by_id")
    records = [
        {"id": "r1", "timestamp": 2, "value": "old"},
        {"id": "r2", "timestamp": -1, "value": "other"},
        {"id": "r1", "timestamp": 4.5, "value": "first tied winner"},
        {"id": "r1", "timestamp": 4.5, "value": "second tied winner"},
        {"id": "r1", "timestamp": 3, "value": "later but older"},
    ]
    _require(function(records) == {"r1": records[2], "r2": records[1]}, "Choose the largest timestamp and retain the first record on a tie.")


def _latest_missing(namespace):
    function = _function(namespace, "latest_by_id")
    _require(function([]) == {}, "Return an empty dictionary for empty records.")
    valid = {"id": "r1", "timestamp": 0}
    records = [None, {}, {"id": "x"}, {"timestamp": 5}, {"id": "", "timestamp": 1}, {"id": 7, "timestamp": 1}, {"id": "x", "timestamp": None}, {"id": "x", "timestamp": True}, {"id": "x", "timestamp": "2"}, valid]
    _require(function(records) == {"r1": valid}, "Skip missing or invalid fields; zero is still a valid timestamp.")


def _latest_copies(namespace):
    function = _function(namespace, "latest_by_id")
    records = [{"id": "r1", "timestamp": 2, "name": "keep", "tags": ["new"]}]
    before = copy.deepcopy(records)
    result = function(records)
    _require(result == {"r1": before[0]}, "Keep every field of a selected record.")
    _require(result["r1"] is not records[0], "Return an outer copy of each winning record.")
    result["r1"]["name"] = "changed"
    _require(records == before, "Changing a direct result field must not mutate the input record.")


def _function_normalize(namespace):
    function = _function(namespace, "normalize_record")
    record = {"id": " r1 ", "name": " Search ", "duration": 2}
    before = record.copy()
    _require(function(record) == {"id": "tool-r1", "name": "search", "duration": 2}, "Normalize id/name in a copied record and retain extra fields.")
    expected = {"id": "job-r1", "name": "search", "duration": 2}
    _require(function(record, "job-") == expected and function(record, prefix="job-") == expected, "Support both positional and keyword prefix arguments.")
    _require(record == before, "Do not update the caller's record during normalization.")


def _function_tags(namespace):
    function = _function(namespace, "add_tag")
    first = function({"id": "a"}, "first")
    second = function({"id": "b"}, "second")
    _require(first == {"id": "a", "tags": ["first"]} and second == {"id": "b", "tags": ["second"]}, "Create an independent tag list for each default call.")
    record = {"id": "r1", "tags": ["existing"]}
    supplied = ["override"]
    result = function(record, "new", tags=supplied)
    _require(result == {"id": "r1", "tags": ["override", "new"]}, "Use a copy of supplied tags when that argument is present.")
    _require(supplied == ["override"] and record == {"id": "r1", "tags": ["existing"]}, "Do not append into the caller's supplied or nested tag list.")
    _require(function(record, "new")["tags"] == ["existing", "new"], "When tags is omitted, copy the record's existing tags.")
    _require(record["tags"] == ["existing"], "Copy nested tags before appending.")


def _function_compose(namespace):
    prepare = _function(namespace, "prepare_records")
    normalize = _function(namespace, "normalize_record")
    add_tag = _function(namespace, "add_tag")
    calls = []

    def tracked_normalize(*args, **kwargs):
        calls.append("normalize")
        return normalize(*args, **kwargs)

    def tracked_tag(*args, **kwargs):
        calls.append("tag")
        return add_tag(*args, **kwargs)

    namespace["normalize_record"], namespace["add_tag"] = tracked_normalize, tracked_tag
    records = [{"id": " a ", "name": " Search ", "tags": ["new"]}, {"id": "b", "name": "LOOKUP"}]
    before = copy.deepcopy(records)
    try:
        result = prepare(records, prefix="job-")
        _require(prepare([]) == [], "Empty input should produce an empty prepared list.")
    finally:
        namespace["normalize_record"], namespace["add_tag"] = normalize, add_tag
    _require(result == [{"id": "job-a", "name": "search", "tags": ["new", "reviewed"]}, {"id": "job-b", "name": "lookup", "tags": ["reviewed"]}], "Prepare normalized records with a reviewed tag in original order.")
    _require(calls.count("normalize") == 2 and calls.count("tag") == 2, "Use both small helper functions for each record.")
    _require(records == before, "Composition must leave all original records and tag lists unchanged.")


def _tools_count(namespace):
    function = _function(namespace, "top_tools")
    log = [" Search ", "SEARCH", "lookup", " Web   Search ", "web search", "lookup", "lookup"]
    _require(function(log) == [("lookup", 3), ("search", 2), ("web search", 2)], "Normalize case and whitespace before counting; return (name, count) tuples.")


def _tools_order(namespace):
    function = _function(namespace, "top_tools")
    log = ["z", "b", "a", "c", "z", "b", "a", "c"]
    _require(function(log) == [("a", 2), ("b", 2), ("c", 2)], "Use three by default and alphabetically order equal counts.")
    _require(function(log, 1) == [("a", 2)] and function(log, k=8) == [("a", 2), ("b", 2), ("c", 2), ("z", 2)], "Honor a custom top-k limit even when it exceeds the number of tools.")


def _tools_boundaries(namespace):
    function = _function(namespace, "top_tools")
    _require(function([]) == [] and function(["a"], 0) == [] and function(["a"], -1) == [], "Empty input and nonpositive k return an empty list.")
    values = [None, 42, "", "  ", " Search "]
    before = list(values)
    _require(function(values) == [("search", 1)], "Ignore nonstring and empty normalized rows.")
    _require(values == before, "Count without changing the log list.")


def _raises_value_error(function, record):
    try:
        function(record)
    except ValueError:
        return
    raise AssertionError("Raise ValueError for malformed input: " + repr(record))


def _validate_values(namespace):
    function = _function(namespace, "validate_record")
    for record, expected in [
        ({"id": " r1 ", "duration": 0.5, "success": True, "extra": "ignore"}, {"id": "r1", "duration": 0.5, "success": True}),
        ({"id": "r2", "duration": 0, "success": False}, {"id": "r2", "duration": 0.0, "success": False}),
    ]:
        before = record.copy()
        result = function(record)
        _require(result == expected and type(result["duration"]) is float, "Return only a trimmed id, float duration, and actual boolean success.")
        _require(result is not record and record == before, "Validate into a new dictionary without changing the input.")


def _validate_errors(namespace):
    function = _function(namespace, "validate_record")
    for record in (None, [], {}, {"id": "r1"}, {"id": " ", "duration": 1, "success": True}, {"id": 1, "duration": 1, "success": True}, {"id": "r1", "duration": -1, "success": True}, {"id": "r1", "duration": "1", "success": True}, {"id": "r1", "duration": True, "success": True}, {"id": "r1", "duration": 1, "success": 1}):
        _raises_value_error(function, record)


def _validate_copy(namespace):
    function = _function(namespace, "validate_record")
    record = {"id": " r3 ", "duration": 2, "success": False, "extra": "retain only on input"}
    before = record.copy()
    result = function(record)
    _require(set(result) == {"id", "duration", "success"} and result is not record, "Return only the contract fields in a fresh dictionary.")
    result["id"] = "changed result"
    _require(record == before, "Changing the returned dictionary must not change the input.")


def _record_contract(namespace):
    _validate_values(namespace)
    _validate_errors(namespace)
    _validate_copy(namespace)


def _normalize_fields(namespace):
    function = _function(namespace, "normalize_record")
    for record, expected in (({"id": " r1 ", "name": " Search ", "duration": 2}, {"id": "tool-r1", "name": "search", "duration": 2}), ({"id": "r2", "name": "LOOKUP"}, {"id": "tool-r2", "name": "lookup"})):
        _require(function(record) == expected, "Normalize id and name and retain extra fields.")


def _normalize_prefix(namespace):
    function = _function(namespace, "normalize_record")
    record = {"id": " r1 ", "name": " Search "}
    for prefix in ("job-", ""):
        expected = {"id": prefix + "r1", "name": "search"}
        _require(function(record, prefix) == expected and function(record, prefix=prefix) == expected, "Support custom positional and keyword prefixes, including an empty prefix.")


def _normalize_copy(namespace):
    function = _function(namespace, "normalize_record")
    record = {"id": " r1 ", "name": " Search ", "tags": ["new"]}
    before = copy.deepcopy(record)
    result = function(record)
    _require(result is not record and record == before, "Return a new outer dictionary without modifying input.")
    result["name"] = "changed"
    _require(record == before, "Changing an output field must not mutate the original record.")


def _run_record_test(namespace, name, replacement=None):
    test = _function(namespace, name)
    original = _function(namespace, "validate_record")
    calls = []

    def validator(record):
        calls.append(copy.deepcopy(record))
        return replacement(record) if replacement else original(record)

    namespace["validate_record"] = validator
    rejected = False
    try:
        test()
    except AssertionError:
        if replacement is None:
            raise AssertionError(name + " must pass for the correct validator.")
        rejected = True
    finally:
        namespace["validate_record"] = original
    return calls, rejected


def _record_valid_tests(namespace):
    calls, _ = _run_record_test(namespace, "test_valid_records")
    _require(len(calls) >= 2, "Test at least an ordinary record and a boundary-valid record.")
    _require(any(isinstance(record, dict) and record.get("duration") == 0 and record.get("success") is False for record in calls), "Include zero duration with False success in your valid tests.")
    original = _function(namespace, "validate_record")
    for field in ("id", "duration", "success"):
        def wrong_value(record):
            result = dict(original(record))
            result[field] = {"id": "wrong-id", "duration": -1.0, "success": "wrong-type"}[field]
            return result
        _, rejected = _run_record_test(namespace, "test_valid_records", wrong_value)
        _require(rejected, "Compare the exact result so a wrong " + field + " makes your valid test fail.")


def _record_invalid_tests(namespace):
    calls, _ = _run_record_test(namespace, "test_invalid_records")
    _require(any(record is None or record == {} for record in calls), "Test empty input, such as {} or None.")
    _require(any(isinstance(record, dict) and bool(record) for record in calls), "Also test a malformed nonempty record.")
    _, rejected = _run_record_test(namespace, "test_invalid_records", lambda record: {"id": "accepted", "duration": 0.0, "success": True})
    _require(rejected, "Your negative test must raise AssertionError if malformed input is accepted.")


_CHECKS = {
    "refresher-01": [("format-values", "Format changing names and durations", _format_values), ("format-false-zero", "Preserve False and zero duration", _format_false_zero), ("return-not-print", "Return a reusable string without printing", _return_not_print)],
    "refresher-02": [("count-statuses", "Count successes and failures exactly", _count_statuses), ("count-empty", "Handle empty input without changing records", _count_empty), ("count-missing", "Distinguish False from missing or nonboolean status", _count_missing)],
    "refresher-03": [("unique-order", "Remove duplicates while preserving first-seen order", _unique_order), ("unique-empty-falsey", "Handle empty input and falsey IDs", _unique_empty_falsey), ("unique-no-mutation", "Preserve the input and isolate each result", _unique_no_mutation)],
    "refresher-04": [("latest-winners", "Select latest timestamps with first-wins ties", _latest_winners), ("latest-missing", "Skip incomplete records and handle empty input", _latest_missing), ("latest-copies", "Preserve fields without mutating input records", _latest_copies)],
    "refresher-05": [("function-normalize", "Normalize copied records with explicit defaults", _function_normalize), ("function-tags", "Keep tag lists independent across calls", _function_tags), ("function-compose", "Compose both helpers without changing the input", _function_compose)],
    "refresher-06": [("tools-count", "Normalize and count tool names", _tools_count), ("tools-order", "Apply top-k limits and alphabetical tie ordering", _tools_order), ("tools-boundaries", "Handle empty or ignored input without mutation", _tools_boundaries)],
    "refresher-07": [("record-contract", "Validate normal, empty, and malformed records", _record_contract), ("record-valid-tests", "Write valid-case tests that catch wrong returned values", _record_valid_tests), ("record-invalid-tests", "Write negative tests that reject permissive validation", _record_invalid_tests)],
}


_CONSOLIDATION_NAMES = {
    "refresher-01": "format_tool", "refresher-02": "count_runs", "refresher-03": "unique_ids",
    "refresher-04": "latest_by_id", "refresher-05": "normalize_record", "refresher-06": "top_tools",
    "refresher-07": "validate_record",
}
_CONSOLIDATION_CHECKS = {
    "refresher-05": [("normalize-fields", "Normalize id and name while retaining extra fields", _normalize_fields), ("normalize-prefix", "Honor default, positional and keyword prefixes", _normalize_prefix), ("normalize-copy", "Return a fresh outer copy without changing input", _normalize_copy)],
    "refresher-07": [("validate-values", "Normalize ordinary and boundary-valid records", _validate_values), ("validate-errors", "Reject empty, missing and wrongly typed fields", _validate_errors), ("validate-copy", "Return only contract fields in a fresh dictionary", _validate_copy)],
}


async def check_refresher_foundations(namespace, exercise_id, context=None):
    results = []
    consolidation = isinstance(context, dict) and context.get("consolidation") is True
    checks = _CONSOLIDATION_CHECKS.get(exercise_id, _CHECKS.get(exercise_id, [])) if consolidation else _CHECKS.get(exercise_id, [])
    for check_id, label, probe in checks:
        if consolidation:
            label = _CONSOLIDATION_NAMES[exercise_id] + ": " + label
        try:
            outcome = probe(namespace)
            if inspect.isawaitable(outcome):
                await outcome
            results.append({"id": check_id, "label": label, "passed": True, "detail": "Passed"})
        except Exception as error:
            results.append({"id": check_id, "label": label, "passed": False, "detail": str(error)[:300] or type(error).__name__})
    return results
