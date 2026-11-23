"""Check the simulated FastAPI against the real one.

Every route's prepared request is sent to both, then again with one thing wrong at a time: a query value,
header or body field missing or of the wrong type, a bad path part. The status must match, and so must the
fields a 422 names and the body of a successful answer.

Run: npm run verify:fastapi-parity   (needs uv; it fetches FastAPI into a throwaway environment)
"""
import contextlib
import copy
import io
import json
import pathlib
import re
import subprocess
import sys
import types

from fastapi.testclient import TestClient

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIM = ROOT / "src" / "execution" / "fastapi_sim.py"
BAD_QUERY = ("abc", "-5", "999999", "")
BAD_BODY = (None, "abc", -1, 0, 1e9, 2.5, [], {}, True, "2026-13-45")
BAD_PATH = ("abc", "0", "-1", "2.5")
# Differences that are meant: (route, case) -> why.
KNOWN = {
    ("GET /whoami", "as prepared"): "the real TestClient sends its own User-Agent header",
}


def simulated(source: str, request: dict) -> dict:
    done = subprocess.run([sys.executable, str(SIM)], input=json.dumps({"source": source, **request}), capture_output=True, text=True, timeout=60)
    if done.returncode:
        return {"status": "simulator crashed", "body": done.stderr.strip().splitlines()[-1]}
    # A handler may print; the answer is the last line.
    return json.loads(done.stdout.split("\n")[-1])


def real(source: str, method: str, case: dict) -> tuple[int, object]:
    module = types.ModuleType("sample")
    sys.modules["sample"] = module
    exec(compile(source, "<playground>", "exec"), module.__dict__)
    client = TestClient(module.app, raise_server_exceptions=False)
    sent = {"params": case["query"] or None, "headers": case["headers"] or None}
    if case["body"] is not ...:
        sent["json"] = case["body"]
    with contextlib.redirect_stdout(io.StringIO()):  # a handler may print
        response = client.request(method, case["path"], **sent)
    try:
        return response.status_code, response.json()
    except ValueError:
        return response.status_code, response.text


def refused(body: object) -> list[str] | None:
    detail = body.get("detail") if isinstance(body, dict) else None
    if not isinstance(detail, list):
        return None
    return sorted({".".join(str(part) for part in each.get("loc", [])) for each in detail if isinstance(each, dict)})


def same_fields(got: list[str] | None, want: list[str] | None) -> bool:
    if got is None or want is None:
        return got == want
    # The real one names each member of a union (size.int, size.str); the simulator names the field once.
    return sorted({next((loc for loc in got if each.startswith(loc + ".")), each) for each in want}) == got


def cases_for(route: dict) -> list[tuple[str, dict]]:
    filled = lambda fields: {field["name"]: field["value"] for field in fields or [] if field["value"] != ""}
    base = {
        "path": route["callPath"], "query": filled(route.get("query")), "headers": filled(route.get("headers")),
        "body": json.loads(route["body"]) if route.get("body") else ...,
    }
    cases = [("as prepared", base)]
    vary = lambda label, **change: cases.append((label, {**copy.deepcopy(base), **change}))
    without = lambda values, name: {key: value for key, value in values.items() if key != name}

    for name in base["query"]:
        vary(f"query {name} missing", query=without(base["query"], name))
        for bad in BAD_QUERY:
            vary(f"query {name}={bad!r}", query={**base["query"], name: bad})
    for name in base["headers"]:
        vary(f"header {name} missing", headers=without(base["headers"], name))
        vary(f"header {name}='wrong'", headers={**base["headers"], name: "wrong"})
    if isinstance(base["body"], dict) and base["body"]:
        for name in base["body"]:
            vary(f"body {name} missing", body=without(base["body"], name))
            for bad in BAD_BODY:
                vary(f"body {name}={bad!r}", body={**base["body"], name: bad})
        vary("body with an unknown key", body={**base["body"], "surprise": 1})
        vary("body is a list", body=[])
        vary("body is text", body="text")
        vary("body missing", body=...)
    parts = re.split(r"(\{[^}]+\})", route["path"])
    found = re.match("^" + "".join("(.+)" if part.startswith("{") else re.escape(part) for part in parts) + "$", route["callPath"])
    for index in range(1, ((found.lastindex or 0) if found else 0) + 1):
        for bad in BAD_PATH:
            vary(f"path part {index}={bad!r}", path=route["callPath"][: found.start(index)] + bad + route["callPath"][found.end(index):])
    return cases


def compare(path: pathlib.Path) -> int:
    source = path.read_text()
    routes = simulated(source, {"op": "register"})["routes"]
    total, different = 0, []
    for route in routes:
        name = f"{route['method']} {route['path']}"
        for label, case in cases_for(route):
            total += 1
            request = {"method": route["method"], "path": case["path"], "query": case["query"], "headers": case["headers"]}
            if case["body"] is not ...:
                request["body"] = case["body"]
            got = simulated(source, request)
            want_status, want_body = real(source, route["method"], case)
            if (name, label) in KNOWN:
                continue
            if got.get("status") != want_status:
                different.append((name, label, "status", got.get("status"), want_status))
            elif want_status == 422 and not same_fields(refused(got.get("body")), refused(want_body)):
                different.append((name, label, "refused fields", refused(got.get("body")), refused(want_body)))
            # A crash is reported with its reason by the simulator and as plain text by the real one.
            elif want_status not in (204, 422, 500) and got.get("body") != want_body:
                different.append((name, label, "body", got.get("body"), want_body))
    print(f"{path.name}: {len(routes)} routes, {total - len(different)}/{total} requests answered the same")
    for name, label, what, got, want in different:
        print(f"  {name} — {label}: {what}\n    simulated {json.dumps(got)[:200]}\n    real      {json.dumps(want)[:200]}")
    return len(different)


if __name__ == "__main__":
    files = [pathlib.Path(arg) for arg in sys.argv[1:]] or [ROOT / "samples" / "bookshop_api.py"]
    sys.exit(1 if sum(compare(path) for path in files) else 0)
