"""Finite behavior probes for browser-local provider and security exercises.

These checks teach contracts; they are neither a security sandbox nor proof of
production readiness. Every model, provider, identity and record is a fixture.
"""

from copy import deepcopy
import json


def _require(condition, message):
    if not condition:
        raise AssertionError(message)


def _function(namespace, name):
    function = namespace.get(name)
    _require(callable(function), "Define " + name + " before running the checks.")
    return function


def _value_error(operation, message):
    try:
        operation()
    except ValueError:
        return
    raise AssertionError(message)


class _ConverseFixture:
    def __init__(self, response):
        self.calls = []
        self.response = response

    def converse(self, **request):
        self.calls.append(deepcopy(request))
        return deepcopy(self.response)


def _answer_response(text="A local fixture answer"):
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
        "stopReason": "end_turn",
    }


def _converse_request(namespace):
    ask = _function(namespace, "ask_bedrock")
    client = _ConverseFixture(_answer_response())
    ask(client, "configured-model", "  Explain dictionaries\n")
    _require(len(client.calls) == 1, "Make exactly one call through the injected client.")
    request = client.calls[0]
    _require(set(request) == {"modelId", "messages", "system", "inferenceConfig"}, "Use modelId, messages, system and inferenceConfig in the Converse request.")
    _require(request["modelId"] == "configured-model", "Use the model_id argument instead of hardcoding a model.")
    _require(request["messages"] == [{"role": "user", "content": [{"text": "Explain dictionaries"}]}], "Put the trimmed question in a user text content block.")
    system = request["system"]
    _require(isinstance(system, list) and len(system) == 1 and isinstance(system[0], dict) and isinstance(system[0].get("text"), str) and bool(system[0]["text"].strip()), "Keep a nonempty system instruction in a separate system text block.")
    _require(request["inferenceConfig"] == {"maxTokens": 128, "temperature": 0}, "Set maxTokens to 128 and temperature to 0 for this fixture.")


def _converse_response(namespace):
    ask = _function(namespace, "ask_bedrock")
    for text in ("One answer", "Another independent answer"):
        _require(ask(_ConverseFixture(_answer_response(text)), "model", "question") == text, "Return text from the injected response, not a hardcoded answer.")
    response = _answer_response()
    response["output"]["message"]["content"] = [
        {"text": "First "}, {"reasoningContent": {"redactedContent": "fixture"}}, {"text": "second"},
    ]
    _require(ask(_ConverseFixture(response), "model", "question") == "First second", "Join text blocks while ignoring non-text content blocks.")


def _converse_boundaries(namespace):
    ask = _function(namespace, "ask_bedrock")
    for question in ("", " \t\n ", None, 42):
        client = _ConverseFixture(_answer_response())
        _value_error(lambda: ask(client, "model", question), "Reject empty or non-text questions with ValueError.")
        _require(not client.calls, "Reject invalid questions before calling the provider.")
    for model_id in ("", " ", None):
        client = _ConverseFixture(_answer_response())
        _value_error(lambda: ask(client, model_id, "question"), "Reject a missing configured model ID.")
        _require(not client.calls, "Do not call the provider without a model ID.")
    for response in (
        {**_answer_response(), "stopReason": "max_tokens"},
        {**_answer_response(), "stopReason": "tool_use"},
        _answer_response("  "), {"stopReason": "end_turn", "output": None},
        {"stopReason": "end_turn", "output": {"message": {"content": "not blocks"}}}, None,
    ):
        _value_error(lambda: ask(_ConverseFixture(response), "model", "question"), "Reject incomplete or malformed responses with ValueError.")


def _run_retry(function, statuses, max_attempts=3):
    calls, delays = [], []

    def operation():
        index = len(calls)
        calls.append(index)
        _require(index < len(statuses), "The retry loop exceeded the fixture's attempt budget.")
        return {"status": statuses[index], "body": {"attempt": index + 1}}

    result = function(operation, delays.append, max_attempts=max_attempts)
    return result, calls, delays


def _transient_retry(namespace):
    retry = _function(namespace, "call_with_retry")
    for status in (429, 500, 502, 503, 504):
        result, calls, delays = _run_retry(retry, [status, 200])
        _require(result == {"status": 200, "body": {"attempt": 2}} and len(calls) == 2, "Retry the listed transient response and return the recovered response.")
        _require(delays == [0.1], "Wait 0.1 seconds through injected sleep before the second attempt.")
    result, calls, delays = _run_retry(retry, [503, 429, 200])
    _require(result["status"] == 200 and len(calls) == 3 and delays == [0.1, 0.2], "Use exponential delays 0.1 then 0.2 between three attempts.")


def _terminal_error(namespace):
    retry = _function(namespace, "call_with_retry")
    for status in (200, 400, 401, 403, 404, 422):
        result, calls, delays = _run_retry(retry, [status, 200])
        _require(result == {"status": status, "body": {"attempt": 1}}, "Return success and permanent errors unchanged.")
        _require(len(calls) == 1 and not delays, "Do not retry or sleep on success, authorization failures or invalid input.")


def _retry_budget(namespace):
    retry = _function(namespace, "call_with_retry")
    for limit in (1, 2, 3, 5):
        result, calls, delays = _run_retry(retry, [503] * 6, limit)
        _require(result["status"] == 503 and len(calls) == limit, "max_attempts includes the first call; return the last failure when exhausted.")
        _require(delays == [0.1 * 2 ** attempt for attempt in range(limit - 1)], "Never sleep after the final allowed attempt.")
    for limit in (0, -1, 6, True, 1.5):
        calls = []
        _value_error(lambda: retry(lambda: calls.append("called"), lambda delay: calls.append(delay), max_attempts=limit), "Reject budgets outside integer values 1 through 5.")
        _require(not calls, "Validate the budget before calling or sleeping.")


def _tool_observation(namespace):
    run = _function(namespace, "run_tools")
    for record_id, status in (("r1", "reviewed"), ("r2", "pending")):
        calls, turns = [], []

        def tool(**arguments):
            calls.append(arguments)
            return {"status": status}

        def model(observations):
            turns.append(deepcopy(observations))
            if not observations:
                return {"type": "tool", "name": "lookup_status", "arguments": {"record_id": record_id}}
            _require(observations == [{"tool": "lookup_status", "result": {"status": status}}], "Pass the tool result back as a structured observation.")
            return {"type": "final", "text": "Status: " + observations[0]["result"]["status"]}

        result = run(model, {"lookup_status": tool})
        _require(result == {"ok": True, "answer": "Status: " + status}, "Return the model's final answer after the read-only observation.")
        _require(calls == [{"record_id": record_id}] and len(turns) == 2, "Execute the requested read once, then let the model finish.")


def _tool_boundary(namespace):
    run = _function(namespace, "run_tools")
    base = {"type": "tool", "name": "lookup_status", "arguments": {"record_id": "r1"}}
    cases = [
        ({**base, "name": "delete_record"}, "tool_not_allowed"),
        ({**base, "arguments": {}}, "invalid_arguments"),
        ({**base, "arguments": {"record_id": "r1", "approved": True}}, "invalid_arguments"),
        ({**base, "arguments": {"record_id": "../private"}}, "invalid_arguments"),
        ({**base, "arguments": {"record_id": 42}}, "invalid_arguments"),
        ({**base, "arguments": {"record_id": ""}}, "invalid_arguments"),
        ({**base, "arguments": {"record_id": "r" * 41}}, "invalid_arguments"),
        ({**base, "arguments": []}, "invalid_arguments"),
        ({**base, "approval": True}, "invalid_proposal"),
        ({"type": "final", "text": ""}, "invalid_proposal"),
        ("lookup_status r1", "invalid_proposal"),
    ]
    for proposal, error in cases:
        calls = []
        tools = {"lookup_status": lambda **arguments: calls.append(arguments), "delete_record": lambda **arguments: calls.append(arguments)}
        result = run(lambda observations: deepcopy(proposal), tools)
        _require(result == {"ok": False, "error": error}, "Return " + error + " for a disallowed or malformed proposal.")
        _require(not calls, "Validate proposals before invoking any registry callable.")


def _tool_budget(namespace):
    run = _function(namespace, "run_tools")
    for budget in (1, 2, 5):
        turns, calls = [], []

        def model(observations):
            turns.append(observations)
            return {"type": "tool", "name": "lookup_status", "arguments": {"record_id": "r1"}}

        result = run(model, {"lookup_status": lambda **arguments: calls.append(arguments)}, max_steps=budget)
        _require(result == {"ok": False, "error": "step_limit"} and len(turns) == budget and len(calls) == budget, "Stop after exactly max_steps model turns with a step_limit error.")
    for budget in (0, -1, 6, True):
        _require(run(lambda observations: {"type": "final", "text": "ignored"}, {}, max_steps=budget) == {"ok": False, "error": "invalid_budget"}, "Reject invalid turn budgets.")

    def broken(*args, **kwargs):
        raise RuntimeError("secret fixture exception detail")

    proposal = {"type": "tool", "name": "lookup_status", "arguments": {"record_id": "r1"}}
    _require(run(broken, {}) == {"ok": False, "error": "model_failed"}, "Return a safe model_failed error, without exception details.")
    _require(run(lambda observations: proposal, {"lookup_status": broken}) == {"ok": False, "error": "tool_failed"}, "Return a safe tool_failed error, without exception details.")
    _require(run(lambda observations: proposal, {}) == {"ok": False, "error": "tool_unavailable"}, "A missing registered tool must return tool_unavailable.")


_RECORDS = {
    "r1": {"tenant": "blue", "summary": "Blue record reviewed"},
    "r2": {"tenant": "red", "summary": "Red record reviewed"},
}


def _principal(tenant="blue"):
    return {"authenticated": True, "subject": "user-17", "tenant": tenant, "scopes": ["records:read"]}


def _allowed_record(namespace):
    read = _function(namespace, "read_record")
    for tenant, record_id in (("blue", "r1"), ("red", "r2")):
        principal, records = _principal(tenant), deepcopy(_RECORDS)
        result = read(principal, {"record_id": record_id}, records)
        _require(result == {"status": 200, "body": {"record_id": record_id, "summary": records[record_id]["summary"]}}, "Allow a correctly scoped read in each tenant and return the requested record.")
        _require(principal == _principal(tenant) and records == _RECORDS, "Authorization must not mutate the trusted identity or records.")
    _require(read(_principal(), {"record_id": "missing"}, deepcopy(_RECORDS)) == {"status": 404, "body": {"error": "not_found"}}, "Return not_found for an unknown record.")


def _deny_default(namespace):
    read = _function(namespace, "read_record")
    for principal in (None, {}, {**_principal(), "authenticated": False}, {**_principal(), "subject": ""}):
        _require(read(principal, {"record_id": "r1"}, deepcopy(_RECORDS)) == {"status": 401, "body": {"error": "unauthenticated"}}, "Missing or unauthenticated principals must receive 401.")
    for principal in ({**_principal(), "scopes": []}, {**_principal(), "scopes": ["records:write"]}, {**_principal(), "scopes": "records:read"}, {**_principal(), "tenant": ""}):
        _require(read(principal, {"record_id": "r1"}, deepcopy(_RECORDS)) == {"status": 403, "body": {"error": "forbidden"}}, "Require a valid tenant and an explicit records:read scope collection.")


def _tenant_boundary(namespace):
    read = _function(namespace, "read_record")
    for principal, proposal in (
        (_principal("blue"), {"record_id": "r2"}),
        (_principal("red"), {"record_id": "r1"}),
        (_principal(), {"record_id": "r2", "approved": True}),
        (_principal(), {"record_id": "r2", "tenant": "red"}),
        (_principal(), {"record_id": "r1", "scopes": ["records:read"]}),
        (_principal(), {}), (_principal(), None),
    ):
        _require(read(principal, proposal, deepcopy(_RECORDS)) == {"status": 403, "body": {"error": "forbidden"}}, "Deny cross-tenant access and extra model-supplied authority fields.")
    for record_id in (None, [], ""):
        _require(read(_principal(), {"record_id": record_id}, deepcopy(_RECORDS)) == {"status": 400, "body": {"error": "invalid_record_id"}}, "Reject non-text or empty record IDs before looking them up.")


_AUDIT_FIELDS = {"request_id", "kind", "outcome", "latency_ms", "input_tokens", "output_tokens", "redacted"}


def _audit_metadata(namespace):
    audit = _function(namespace, "audit_event")
    for index, kind in enumerate(("model_call", "tool_call", "request")):
        event = {"kind": kind, "outcome": "success", "latency_ms": 42 + index, "input_tokens": 20, "output_tokens": 8}
        result = audit("req-1234abcd", deepcopy(event))
        _require(result == {"request_id": "req-1234abcd", **event, "redacted": False}, "Preserve the validated metadata and opaque request ID exactly.")


def _audit_redaction(namespace):
    audit = _function(namespace, "audit_event")
    redact = _function(namespace, "redact_text")
    text = "Contact person+qa@example.test; Bearer fixture.secret-1; token=fixture-secret-2"
    _require(redact(text) == "Contact [EMAIL]; Bearer [TOKEN]; token=[TOKEN]", "Replace the demonstration email and token patterns without deleting surrounding text.")
    _require(redact("No personal details here") == "No personal details here", "Preserve ordinary text without matching sensitive patterns.")
    _value_error(lambda: redact(None), "Reject non-text input to the redaction helper.")
    event = {"kind": "model_call", "outcome": "denied", "latency_ms": 4, "input_tokens": 2, "output_tokens": 0,
             "prompt": "person@example.test", "response": {"answer": "private answer"},
             "token": "fixture-secret", "headers": {"Authorization": "Bearer fixture-token"},
             "metadata": {"person": {"name": "Private Person"}}, "email": "other@example.test"}
    original = deepcopy(event)
    result = audit("req-abcd1234", event)
    _require(set(result) == _AUDIT_FIELDS and result.get("redacted") is True, "Build an allowlisted output with a redaction flag; never copy arbitrary fields.")
    serialized = json.dumps(result)
    _require(all(secret not in serialized for secret in ("person@", "private answer", "fixture-secret", "fixture-token", "Private Person", "other@")), "Exclude nested and top-level prompt, response, credential and personal data.")
    _require(event == original, "Return a separate audit event without mutating the original request fixture.")


def _audit_values(namespace):
    audit = _function(namespace, "audit_event")
    event = {"kind": "person@example.test", "outcome": {"token": "secret"}, "latency_ms": "Bearer secret", "input_tokens": True, "output_tokens": -1}
    result = audit("req-0000abcd", event)
    _require(result == {"request_id": "req-0000abcd", "kind": "unknown", "outcome": "unknown", "latency_ms": 0, "input_tokens": 0, "output_tokens": 0, "redacted": False}, "Allowed keys still need enum and integer validation; never carry arbitrary values into logs.")
    for key in ("latency_ms", "input_tokens", "output_tokens"):
        result = audit("req-0000abcd", {key: 10_000_001})
        _require(result[key] == 0, "Clamp out-of-contract metadata to the safe fallback zero.")
    for request_id in ("person@example.test", "Bearer fixture-token", "req-1234abcd\n", None):
        _value_error(lambda: audit(request_id, {}), "Reject anything except the server's opaque req- plus eight-hex-digit identifier format.")
    _value_error(lambda: audit("req-1234abcd", []), "Reject a non-object event.")


_CHECKS = {
    "genai-bedrock": [
        ("converse-request", "Build a Converse request with a bounded response", _converse_request),
        ("converse-response", "Read text blocks from the model response", _converse_response),
        ("converse-boundaries", "Reject empty questions and incomplete responses", _converse_boundaries),
    ],
    "genai-retries": [
        ("transient-retry", "Recover from a transient provider failure", _transient_retry),
        ("terminal-error", "Never retry authorization or validation errors", _terminal_error),
        ("retry-budget", "Stop at the attempt limit without an extra wait", _retry_budget),
    ],
    "genai-tools": [
        ("tool-observation", "Return a read-only tool result to the model", _tool_observation),
        ("tool-boundary", "Reject unknown tools and malformed arguments", _tool_boundary),
        ("tool-budget", "Bound model turns and report failures safely", _tool_budget),
    ],
    "genai-authorization": [
        ("allowed-record", "Allow a scoped read inside the trusted tenant", _allowed_record),
        ("deny-default", "Deny missing identity and missing permissions", _deny_default),
        ("tenant-boundary", "Reject cross-tenant reads and model-made approvals", _tenant_boundary),
    ],
    "genai-audit": [
        ("audit-metadata", "Keep useful request and performance metadata", _audit_metadata),
        ("audit-redaction", "Exclude prompts, responses, secrets and personal data", _audit_redaction),
        ("audit-values", "Validate values even under allowed field names", _audit_values),
    ],
}


def check_genai_security(namespace, exercise_id):
    results = []
    for check_id, label, probe in _CHECKS.get(exercise_id, []):
        try:
            probe(namespace)
            results.append({"id": check_id, "label": label, "passed": True, "detail": "Passed"})
        except Exception as error:
            results.append({"id": check_id, "label": label, "passed": False, "detail": str(error)[:300] or type(error).__name__})
    return results
