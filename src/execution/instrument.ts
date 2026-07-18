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
        "TimeoutError": "This code ran too long and was stopped to protect the browser.",
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
    return compile(tree, "<playground>", "exec")

def _plp_run(source: str):
    global _plp_events, _plp_print_line, _plp_pending_structure, _plp_deadline, _plp_ticks
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
    old_show = warnings.showwarning
    warnings.showwarning = _plp_showwarning
    try:
        code_obj = _plp_transform(source)
        globals_dict = {
            "__name__": "__main__",
            "__plp_show__": __plp_show__,
            "_plp_check_limit": _plp_check_limit,
            "print": _plp_print,
        }
        exec(code_obj, globals_dict)
        out.flush()
        return {"ok": True, "events": list(_plp_events)}
    except Exception as exc:
        out.flush()
        tb = traceback.format_exc()
        line = None
        if isinstance(exc, SyntaxError) and exc.lineno is not None:
            line = exc.lineno
        else:
            for frame in traceback.extract_tb(exc.__traceback__):
                if frame.filename == "<playground>":
                    line = frame.lineno
        events = list(_plp_events)
        events.append({
            "kind": "error",
            "message": f"{type(exc).__name__}: {exc}",
            "friendly": _plp_friendly(exc),
            "traceback": tb,
            "line": line,
        })
        return {"ok": False, "events": events}
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
