"""Small behavior probes for the three browser-local service exercises."""

from fastapi_sim import TestClient, Response


def _require(condition, message):
    if not condition:
        raise AssertionError(message)


def _validator(namespace):
    function = namespace.get("validate_question")
    _require(callable(function), "Define validate_question(payload) before running the checks.")
    return function


def _valid_question(namespace):
    function = _validator(namespace)
    for text in (" What is Python? ", "\tExplain functions\n", "Another question"):
        _require(function({"question": text}) == text.strip(), "Return the question text with surrounding whitespace removed.")


def _rejects(namespace, payloads):
    function = _validator(namespace)
    for payload in payloads:
        try:
            function(payload)
        except ValueError:
            continue
        raise AssertionError("Raise ValueError for invalid input: " + repr(payload))


def _empty_question(namespace):
    _rejects(namespace, [{"question": ""}, {"question": " \n\t "}, {}])


def _question_types(namespace):
    _rejects(namespace, [{"question": 42}, {"question": None}, {"question": []}, [], None, "question"])


def _client(namespace):
    app = namespace.get("app")
    _require(app is not None and hasattr(app, "routes"), "Create app = FastAPI() and register POST /ask.")
    return TestClient(app)


def _post_question(namespace):
    client = _client(namespace)
    for question in (" What is Python? ", "\tExplain functions\n"):
        response = client.post("/ask", json={"question": question})
        _require(response.status_code == 200, "A valid POST /ask must return status 200.")
        _require(response.json() == {"question": question.strip()}, "Return {\"question\": trimmed_text} for a valid request.")


def _invalid_request(namespace):
    client = _client(namespace)
    for payload in ({"question": ""}, {"question": "   "}, {}, {"question": 42}, {"question": None}, []):
        response = client.post("/ask", json=payload)
        _require(response.status_code == 422, "Invalid POST /ask input must return 422: " + repr(payload))
        body = response.json()
        _require(isinstance(body, dict) and bool(body.get("detail")), "Include a nonempty detail in the error response.")


def _reuse_validator(namespace):
    original = _validator(namespace)
    calls = []

    def tracked(payload):
        calls.append(payload)
        return original(payload)

    namespace["validate_question"] = tracked
    try:
        _client(namespace).post("/ask", json={"question": " Reuse this function "})
    finally:
        namespace["validate_question"] = original
    _require(bool(calls), "Call validate_question(payload) inside your endpoint.")


def _service_contract(namespace):
    _valid_question(namespace)
    _empty_question(namespace)
    _question_types(namespace)
    _post_question(namespace)
    _invalid_request(namespace)
    _reuse_validator(namespace)


def _is_valid_payload(payload):
    return isinstance(payload, dict) and isinstance(payload.get("question"), str) and bool(payload["question"].strip())


def _run_request_test(namespace, name, valid, mutation=None):
    test = namespace.get(name)
    _require(callable(test), "Define " + name + "() with request assertions.")
    original = TestClient.request
    calls = []

    def request(client, method, url, **kwargs):
        response = original(client, method, url, **kwargs)
        relevant = method.upper() == "POST" and url == "/ask" and _is_valid_payload(kwargs.get("json")) == valid
        if relevant:
            calls.append(kwargs.get("json"))
            if mutation == "status":
                response = Response({"method": "POST", "path": "/ask", "status": 500 if valid else 200, "body": response.json()})
            elif mutation == "body":
                response = Response({"method": "POST", "path": "/ask", "status": response.status_code, "body": {"question": "wrong answer"} if valid else {"detail": ""}})
        return response

    TestClient.request = request
    rejected = False
    try:
        test()
    except AssertionError:
        if mutation is None:
            raise AssertionError(name + " must pass against your working service.")
        rejected = True
    finally:
        TestClient.request = original
    _require(bool(calls), name + " must POST a " + ("valid" if valid else "missing, empty, or non-text") + " question to /ask.")
    if mutation:
        _require(rejected, "Add an assertion to " + name + " that catches a wrong response " + mutation + ".")


def _valid_test(namespace):
    for mutation in (None, "status", "body"):
        _run_request_test(namespace, "test_valid_request", True, mutation)


def _invalid_test(namespace):
    for mutation in (None, "status", "body"):
        _run_request_test(namespace, "test_invalid_request", False, mutation)


_CHECKS = {
    "service-validation": [
        ("valid-question", "Return a trimmed question", _valid_question),
        ("empty-question", "Reject empty or missing questions", _empty_question),
        ("question-types", "Reject non-text questions and non-object input", _question_types),
    ],
    "service-endpoint": [
        ("post-question", "POST /ask returns the trimmed question", _post_question),
        ("invalid-request", "Invalid requests return 422 with a detail", _invalid_request),
        ("reuse-validator", "The endpoint calls your validation function", _reuse_validator),
    ],
    "service-tests": [
        ("service-contract", "The service still handles valid and invalid input", _service_contract),
        ("valid-test", "Your valid-request test catches wrong status and body", _valid_test),
        ("invalid-test", "Your invalid-request test catches an accepted bad request", _invalid_test),
    ],
}


def check_service(namespace, exercise_id):
    results = []
    for check_id, label, probe in _CHECKS.get(exercise_id, []):
        try:
            probe(namespace)
            results.append({"id": check_id, "label": label, "passed": True, "detail": "Passed"})
        except Exception as error:
            results.append({"id": check_id, "label": label, "passed": False, "detail": str(error)[:300] or type(error).__name__})
    return results
