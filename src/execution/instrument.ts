/**
 * Pure helpers for Python source instrumentation and error messaging.
 * Shared by the worker (runtime) and unit tests (no Pyodide required).
 */

/** Python prelude installed once per worker lifetime. */
export const PYTHON_PRELUDE = `
import ast
import builtins
import sys
import time
import traceback
import warnings

_plp_events = []
_plp_print_line = None
_plp_pending_structure = None
_plp_real_print = builtins.print

# Soft wall-clock limit inside Python so tight loops stop without burning the CPU
# until the main-thread hard kill. Keep slightly under the UI hard timeout.
_PLP_SOFT_LIMIT_S = 2.0
_PLP_TICK_EVERY = 4000
_plp_deadline = 0.0
_plp_ticks = 0

# Limits keep large structures quiet and JSON-safe for the UI tree.
_PLP_STRUCT_MAX_DEPTH = 4
_PLP_STRUCT_MAX_ITEMS = 40
_PLP_STRUCT_PREVIEW = 200

def _plp_is_collection(value):
    return isinstance(value, (list, tuple, dict, set, frozenset))

def _plp_atom(value):
    try:
        preview = repr(value)
    except Exception as exc:
        preview = f"<unprintable: {type(exc).__name__}>"
    if len(preview) > _PLP_STRUCT_PREVIEW:
        preview = preview[: _PLP_STRUCT_PREVIEW - 1] + "…"
    return {
        "kind": "atom",
        "type": type(value).__name__,
        "preview": preview,
    }

def _plp_structure(value, depth=0):
    """JSON-serializable tree for list/dict/set/tuple (for expandable results)."""
    if not _plp_is_collection(value):
        return _plp_atom(value)

    if isinstance(value, dict):
        kind = "dict"
        length = len(value)
        if depth >= _PLP_STRUCT_MAX_DEPTH:
            return {
                "kind": kind,
                "length": length,
                "entries": [],
                "truncated": length > 0,
            }
        entries = []
        truncated = False
        for i, (k, v) in enumerate(value.items()):
            if i >= _PLP_STRUCT_MAX_ITEMS:
                truncated = True
                break
            entries.append({
                "key": _plp_structure(k, depth + 1),
                "value": _plp_structure(v, depth + 1),
            })
        if length > len(entries):
            truncated = True
        node = {"kind": kind, "length": length, "entries": entries}
        if truncated:
            node["truncated"] = True
        return node

    if isinstance(value, (set, frozenset)):
        kind = "set"
        items_src = list(value)
    elif isinstance(value, tuple):
        kind = "tuple"
        items_src = value
    else:
        kind = "list"
        items_src = value

    length = len(items_src)
    if depth >= _PLP_STRUCT_MAX_DEPTH:
        return {
            "kind": kind,
            "length": length,
            "items": [],
            "truncated": length > 0,
        }
    items = []
    truncated = False
    for i, item in enumerate(items_src):
        if i >= _PLP_STRUCT_MAX_ITEMS:
            truncated = True
            break
        items.append(_plp_structure(item, depth + 1))
    if length > len(items):
        truncated = True
    node = {"kind": kind, "length": length, "items": items}
    if truncated:
        node["truncated"] = True
    return node

def __plp_show__(value, line):
    """Capture the value of a top-level expression statement."""
    if value is None:
        return value
    try:
        rep = repr(value)
    except Exception as exc:
        rep = f"<unprintable: {type(exc).__name__}>"
    event = {"kind": "expr", "value": rep, "line": int(line)}
    if _plp_is_collection(value):
        try:
            event["structure"] = _plp_structure(value)
        except Exception:
            pass
    _plp_events.append(event)
    return value

def _plp_check_limit():
    """Raise TimeoutError if a loop has run past the soft deadline."""
    global _plp_ticks
    _plp_ticks += 1
    if _plp_ticks % _PLP_TICK_EVERY != 0:
        return
    if time.time() >= _plp_deadline:
        raise TimeoutError(
            "possible infinite loop — stopped to protect the browser"
        )

class _PlpLimitLoops(ast.NodeTransformer):
    """Insert _plp_check_limit() at the start of every for/while body."""
    def _with_check(self, body):
        check = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_plp_check_limit", ctx=ast.Load()),
                args=[],
                keywords=[],
            )
        )
        return [check, *body]

    def visit_For(self, node):
        self.generic_visit(node)
        node.body = self._with_check(node.body)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        node.body = self._with_check(node.body)
        return node

    def visit_AsyncFor(self, node):
        self.generic_visit(node)
        node.body = self._with_check(node.body)
        return node

def _plp_attach_structure(event):
    """Attach pending collection structure to the first print line of a call."""
    global _plp_pending_structure
    if _plp_pending_structure is not None:
        event["structure"] = _plp_pending_structure
        _plp_pending_structure = None
    return event

class _PlpStdout:
    def __init__(self):
        self._buf = ""
    def write(self, s):
        if not s:
            return 0
        self._buf += s
        while "\\n" in self._buf:
            text, self._buf = self._buf.split("\\n", 1)
            event = {"kind": "print", "text": text}
            if _plp_print_line is not None:
                event["line"] = int(_plp_print_line)
            _plp_attach_structure(event)
            _plp_events.append(event)
        return len(s)
    def flush(self):
        global _plp_print_line
        if self._buf:
            event = {"kind": "print", "text": self._buf}
            if _plp_print_line is not None:
                event["line"] = int(_plp_print_line)
            _plp_attach_structure(event)
            _plp_events.append(event)
            self._buf = ""
        _plp_print_line = None
    def isatty(self):
        return False

def _plp_print(*args, **kwargs):
    """Track the source line of print() so results can be linked back."""
    global _plp_print_line, _plp_pending_structure
    frame = sys._getframe(1)
    if frame.f_code.co_filename == "<playground>":
        _plp_print_line = frame.f_lineno
    else:
        _plp_print_line = None
    # Single collection arg → expandable tree beside the printed repr.
    file = kwargs.get("file", sys.stdout)
    if (
        len(args) == 1
        and file is sys.stdout
        and _plp_is_collection(args[0])
    ):
        try:
            _plp_pending_structure = _plp_structure(args[0])
        except Exception:
            _plp_pending_structure = None
    else:
        _plp_pending_structure = None
    try:
        return _plp_real_print(*args, **kwargs)
    finally:
        out = sys.stdout
        if not (isinstance(out, _PlpStdout) and out._buf):
            _plp_print_line = None
            _plp_pending_structure = None

class _PlpStdin:
    """Lines from the Inputs box; input() and sys.stdin read them in order."""
    def __init__(self, text):
        lines = (text or "").split("\\n")
        if lines and lines[-1] == "":
            lines.pop()
        self._lines = lines
        self.used = 0
    def remaining(self):
        return len(self._lines) - self.used
    def readline(self, size=-1):
        if self.used >= len(self._lines):
            return ""
        line = self._lines[self.used]
        self.used += 1
        return line + "\\n"
    def read(self, size=-1):
        rest = self._lines[self.used:]
        self.used = len(self._lines)
        return "".join(line + "\\n" for line in rest)
    def readlines(self):
        rest = self._lines[self.used:]
        self.used = len(self._lines)
        return [line + "\\n" for line in rest]
    def __iter__(self):
        while self.remaining() > 0:
            yield self.readline()
    def isatty(self):
        return False

_plp_stdin = _PlpStdin("")

def _plp_input(prompt=""):
    """input() reads the next line of the Inputs box and echoes it like a terminal."""
    global _plp_print_line
    if _plp_stdin.remaining() <= 0:
        have = len(_plp_stdin._lines)
        if have == 0:
            raise EOFError("input() needs a value, but the Inputs box is empty")
        raise EOFError(f"input() asked for value {have + 1}, but the Inputs box has only {have} line{'' if have == 1 else 's'}")
    value = _plp_stdin.readline()[:-1]
    frame = sys._getframe(1)
    line = frame.f_lineno if frame.f_code.co_filename == "<playground>" else None
    _plp_print_line = line
    sys.stdout.write(f"{prompt}{value}\\n")
    _plp_print_line = None
    return value

def _plp_showwarning(message, category, filename, lineno, file=None, line=None):
    text = warnings.formatwarning(message, category, filename, lineno, line)
    _plp_events.append({"kind": "warning", "text": text.rstrip(), "line": lineno})

def _plp_friendly(exc):
    name = type(exc).__name__
    msg = str(exc) or name
    tips = {
        "SyntaxError": "Python could not parse this code. Check brackets, colons, and indentation.",
        "IndentationError": "Indentation must stay consistent. Use the same spaces for the same block.",
        "NameError": "That name is not defined yet. Did you misspell it or forget to create it first?",
        "TypeError": "A value was used in a way that does not match its type.",
        "ValueError": "A value has the right type but is not acceptable here.",
        "ZeroDivisionError": "Division by zero is not allowed. Check the divisor.",
        "IndexError": "That index is outside the range of the sequence.",
        "KeyError": "That key was not found in the dictionary.",
        "AttributeError": "That attribute or method does not exist on this value.",
        "ModuleNotFoundError": "That module is not available in this browser playground.",
        "ImportError": "That import could not be completed in this browser playground.",
        "RecursionError": "The function called itself too many times. Check the base case.",
        "EOFError": "input() reads from the Inputs box under the editor. Type one value per line there.",
        "TimeoutError": "This code ran too long and was stopped to protect the browser.",
        "SimFastAPIError": "This playground simulates FastAPI in the browser. Use TestClient or Call on a registered route instead of uvicorn, Depends, or /docs.",
    }
    tip = tips.get(name, "Something went wrong while running this code.")
    return f"{name}: {msg}\\n\\n{tip}"

def _plp_transform(source: str) -> str:
    """Capture top-level expression values and insert loop time checks."""
    tree = ast.parse(source)
    new_body = []
    for stmt in tree.body:
        if isinstance(stmt, ast.Expr):
            call = ast.Expr(
                value=ast.Call(
                    func=ast.Name(id="__plp_show__", ctx=ast.Load()),
                    args=[stmt.value, ast.Constant(value=stmt.lineno)],
                    keywords=[],
                )
            )
            new_body.append(ast.copy_location(call, stmt))
        else:
            new_body.append(stmt)
    tree.body = new_body
    tree = _PlpLimitLoops().visit(tree)
    ast.fix_missing_locations(tree)
    # Top-level await works like a notebook: the async runner awaits the module's coroutine.
    return compile(tree, "<playground>", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)

def _plp_sim_routes():
    try:
        import fastapi_sim
        return fastapi_sim.list_routes()
    except Exception:
        return []

def _plp_sim_install():
    try:
        import fastapi_sim
        fastapi_sim.install()
        fastapi_sim.reset()
    except Exception:
        pass

def _plp_run(source: str, exercise_id=None, include_namespace=False):
    """Run without an event loop. Source with a top-level await needs _plp_run_async."""
    coro = _plp_run_core(source, exercise_id, include_namespace)
    try:
        coro.send(None)
    except StopIteration as done:
        return done.value
    coro.close()
    raise RuntimeError("top-level await needs the async runner")

async def _plp_run_core(source: str, exercise_id=None, include_namespace=False, stdin=None):
    global _plp_stdin, _plp_events, _plp_print_line, _plp_pending_structure, _plp_deadline, _plp_ticks
    _plp_events = []
    _plp_print_line = None
    _plp_pending_structure = None
    _plp_ticks = 0
    _plp_deadline = time.time() + _PLP_SOFT_LIMIT_S
    old_out, old_err = sys.stdout, sys.stderr
    old_print = builtins.print
    out = _PlpStdout()
    sys.stdout = out
    sys.stderr = out
    builtins.print = _plp_print
    old_stdin, old_input = sys.stdin, builtins.input
    _plp_stdin = _PlpStdin(stdin)
    sys.stdin = _plp_stdin
    builtins.input = _plp_input
    old_show = warnings.showwarning
    warnings.showwarning = _plp_showwarning
    _plp_sim_install()
    try:
        code_obj = _plp_transform(source)
        globals_dict = {
            "__name__": "__main__",
            "__plp_show__": __plp_show__,
            "_plp_check_limit": _plp_check_limit,
            "print": _plp_print,
            "input": _plp_input,
        }
        pending = eval(code_obj, globals_dict)
        if pending is not None:
            await pending
        out.flush()
        events = list(_plp_events)
        checks = []
        if exercise_id:
            from service_checks import check_service
            checks = check_service(globals_dict, exercise_id)
        result = {"ok": True, "events": events, "routes": _plp_sim_routes(), "checks": checks}
        if include_namespace:
            result["namespace"] = globals_dict
        return result
    except Exception as exc:
        out.flush()
        tb = traceback.format_exc()
        line = None
        column = None
        end_column = None
        frames = []
        if isinstance(exc, SyntaxError) and exc.lineno is not None:
            line = exc.lineno
            if exc.offset:
                column = exc.offset - 1
                if exc.end_offset and (exc.end_lineno in (None, exc.lineno)) and exc.end_offset > exc.offset:
                    end_column = exc.end_offset - 1
        else:
            for frame in traceback.extract_tb(exc.__traceback__):
                if frame.filename == "<playground>":
                    line = frame.lineno
                    column = getattr(frame, "colno", None)
                    end_column = getattr(frame, "end_colno", None)
                    if getattr(frame, "end_lineno", frame.lineno) != frame.lineno:
                        end_column = None
                    frames.append({"line": frame.lineno, "name": frame.name,
                                   "column": column, "endColumn": end_column})
        events = list(_plp_events)
        error_event = {
            "kind": "error",
            "message": f"{type(exc).__name__}: {exc}",
            "friendly": _plp_friendly(exc),
            "traceback": tb,
            "line": line,
            "frames": frames[-12:],
        }
        if column is not None:
            error_event["column"] = column
        if end_column is not None:
            error_event["endColumn"] = end_column
        events.append(error_event)
        return {"ok": False, "events": events, "routes": _plp_sim_routes()}
    finally:
        sys.stdout = old_out
        sys.stderr = old_err
        builtins.print = old_print
        sys.stdin, builtins.input = old_stdin, old_input
        warnings.showwarning = old_show
        _plp_print_line = None
        _plp_pending_structure = None

def _plp_fullstack_after(request):
    """Data and API tabs: each requested route called on the last app, then the shared database's tables."""
    import json as _json
    import playdb
    calls = []
    for spec in (request.get("calls") or [])[:8]:
        spec = spec.strip()
        method, rest = spec.split(" ", 1) if spec[:1] != "/" and " " in spec else ("GET", spec)
        path, _, raw = rest.strip().partition(" ")
        try:
            import fastapi_sim
            body = _json.loads(raw) if raw.strip() else None
            response = fastapi_sim.dispatch_last(method.upper(), path, body=body)
            calls.append({"method": response["method"], "path": path, "status": response["status"], "body": response["body"]})
        except Exception as exc:
            calls.append({"method": method.upper(), "path": path, "status": 500, "body": {"detail": f"{type(exc).__name__}: {exc}"}})
    return {"tables": playdb.snapshot(), "calls": calls}

async def _plp_run_async(source, exercise_id=None, context=None, fullstack=None, stdin=None):
    import asyncio
    prior_tasks = asyncio.all_tasks()
    old_out, old_err, old_print = sys.stdout, sys.stderr, builtins.print
    if fullstack is not None:
        import playdb
        playdb.configure(fullstack.get("seed", 1))
        for name in fullstack.get("datasets") or []:
            if name in playdb.COLUMNS:
                playdb.load(playdb.connect(), name)
    try:
        genai = isinstance(exercise_id, str) and exercise_id.startswith("genai-")
        refresher = isinstance(exercise_id, str) and exercise_id.startswith("refresher-")
        checked = genai or refresher
        result = await _plp_run_core(source, None if checked else exercise_id, include_namespace=checked, stdin=stdin)
        if fullstack is not None:
            result["fullstack"] = _plp_fullstack_after(fullstack)
        namespace = result.pop("namespace", None)
        if not checked or not result["ok"] or namespace is None:
            return result
        sys.stdout = sys.stderr = _PlpStdout()
        builtins.print = _plp_print
        if refresher:
            from refresher_checks import check_refresher
            checks = await check_refresher(namespace, exercise_id, context)
        else:
            from genai_python_checks import check_genai_python
            from genai_security_checks import check_genai_security
            checks = await check_genai_python(namespace, exercise_id)
            if not checks:
                checks = check_genai_security(namespace, exercise_id)
        result["checks"] = checks
        return result
    finally:
        # Include tasks created by the learner source, not only tasks created by probes.
        sys.stdout = sys.stderr = _PlpStdout()
        builtins.print = _plp_print
        try:
            while True:
                pending = [task for task in asyncio.all_tasks() - prior_tasks if not task.done()]
                if not pending:
                    break
                for task in pending:
                    task.cancel()
                # A task that refuses cancellation is contained by the worker's hard timeout.
                await asyncio.gather(*pending, return_exceptions=True)
        finally:
            sys.stdout, sys.stderr, builtins.print = old_out, old_err, old_print

def _plp_invoke(req):
    """Call one registered simulated-FastAPI route without re-running the editor."""
    import json as _json
    global _plp_events, _plp_print_line, _plp_pending_structure, _plp_deadline, _plp_ticks
    _plp_events = []
    _plp_print_line = None
    _plp_pending_structure = None
    _plp_ticks = 0
    _plp_deadline = time.time() + _PLP_SOFT_LIMIT_S
    if isinstance(req, str):
        req = _json.loads(req)
    method = req.get("method") or "GET"
    path = req.get("path") or "/"
    old_out, old_err = sys.stdout, sys.stderr
    old_print = builtins.print
    out = _PlpStdout()
    sys.stdout = out
    sys.stderr = out
    builtins.print = _plp_print
    old_show = warnings.showwarning
    warnings.showwarning = _plp_showwarning
    try:
        import fastapi_sim
        result = fastapi_sim.dispatch_last(
            method,
            path,
            query=req.get("query"),
            body=req.get("body"),
            headers=req.get("headers"),
        )
        out.flush()
        events = list(_plp_events)
        events.append({
            "kind": "http",
            "method": result.get("method") or method,
            "path": result.get("path") or path,
            "status": int(result.get("status") or 500),
            "body": _json.dumps(result.get("body"), default=str),
            "simulated": True,
        })
        return {"ok": True, "events": events, "routes": fastapi_sim.list_routes()}
    except Exception as exc:
        out.flush()
        tb = traceback.format_exc()
        events = list(_plp_events)
        events.append({
            "kind": "error",
            "message": f"{type(exc).__name__}: {exc}",
            "friendly": _plp_friendly(exc),
            "traceback": tb,
        })
        return {"ok": False, "events": events, "routes": _plp_sim_routes()}
    finally:
        sys.stdout = old_out
        sys.stderr = old_err
        builtins.print = old_print
        warnings.showwarning = old_show
        _plp_print_line = None
        _plp_pending_structure = None
`

export {
  explainError,
  friendlyErrorMessage,
  parseErrorName,
  enrichErrorEvent,
} from './errorExplain'
