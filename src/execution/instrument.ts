/**
 * Pure helpers for Python source instrumentation and error messaging.
 * Shared by the worker (runtime) and unit tests (no Pyodide required).
 */

/** Python prelude installed once per worker lifetime. */
export const PYTHON_PRELUDE = `
import ast
import builtins
import sys
import traceback
import warnings

_plp_events = []
_plp_print_line = None
_plp_real_print = builtins.print

def __plp_show__(value, line):
    """Capture the value of a top-level expression statement."""
    if value is None:
        return value
    try:
        rep = repr(value)
    except Exception as exc:
        rep = f"<unprintable: {type(exc).__name__}>"
    _plp_events.append({"kind": "expr", "value": rep, "line": int(line)})
    return value

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
            _plp_events.append(event)
        return len(s)
    def flush(self):
        global _plp_print_line
        if self._buf:
            event = {"kind": "print", "text": self._buf}
            if _plp_print_line is not None:
                event["line"] = int(_plp_print_line)
            _plp_events.append(event)
            self._buf = ""
        _plp_print_line = None
    def isatty(self):
        return False

def _plp_print(*args, **kwargs):
    """Track the source line of print() so results can be linked back."""
    global _plp_print_line
    frame = sys._getframe(1)
    if frame.f_code.co_filename == "<playground>":
        _plp_print_line = frame.f_lineno
    else:
        _plp_print_line = None
    try:
        return _plp_real_print(*args, **kwargs)
    finally:
        # Clear once complete lines flushed; keep if end='' left a partial buffer.
        out = sys.stdout
        if not (isinstance(out, _PlpStdout) and out._buf):
            _plp_print_line = None

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
        "TimeoutError": "This code ran too long and was stopped.",
    }
    tip = tips.get(name, "Something went wrong while running this code.")
    return f"{name}: {msg}\\n\\n{tip}"

def _plp_transform(source: str) -> str:
    """Rewrite top-level expression statements so their values are captured."""
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
    ast.fix_missing_locations(tree)
    return compile(tree, "<playground>", "exec")

def _plp_run(source: str):
    global _plp_events, _plp_print_line
    _plp_events = []
    _plp_print_line = None
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
`

/** Map exception class names to beginner-friendly guidance (JS-side mirror). */
export function friendlyErrorMessage(name: string, message: string): string {
  const tips: Record<string, string> = {
    SyntaxError:
      'Python could not parse this code. Check brackets, colons, and indentation.',
    IndentationError:
      'Indentation must stay consistent. Use the same spaces for the same block.',
    NameError:
      'That name is not defined yet. Did you misspell it or forget to create it first?',
    TypeError: 'A value was used in a way that does not match its type.',
    ValueError: 'A value has the right type but is not acceptable here.',
    ZeroDivisionError: 'Division by zero is not allowed. Check the divisor.',
    IndexError: 'That index is outside the range of the sequence.',
    KeyError: 'That key was not found in the dictionary.',
    AttributeError: 'That attribute or method does not exist on this value.',
    ModuleNotFoundError:
      'That module is not available in this browser playground.',
    ImportError: 'That import could not be completed in this browser playground.',
    RecursionError:
      'The function called itself too many times. Check the base case.',
    TimeoutError: 'This code ran too long and was stopped.',
  }
  const tip =
    tips[name] ?? 'Something went wrong while running this code.'
  return `${name}: ${message || name}\n\n${tip}`
}

export function parseErrorName(message: string): string {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(message)
  return match?.[1] ?? 'Error'
}
