"""Regenerate src/jev/__fixtures__/python-errors.json from real Python errors.

Mirrors the worker's error capture (message, line, 0-based columns, editor frames) so diagnosis
tests run against what Python actually reports. Run: python3 -I scripts/generate-error-fixtures.py
"""
import json
import pathlib
import traceback

CASES = {
    # Syntax
    "defz": 'a = 5\nb = 7\n\ndefz sumy(a, b):\n  print("test" + "be")\n\nsumy(a, b)\n',
    "function_keyword": 'function sumy(a, b):\n    return a + b\nprint(sumy(1, 2))\n',
    "retrun": 'def f(x):\n    retrun x * 2\nprint(f(2))\n',
    "whlie": 'n = 0\nwhlie n < 3:\n    n += 1\n',
    "missing_colon_for": 'total = 0\nfor i in range(3)\n    total += i\nprint(total)\n',
    "missing_colon_def": 'def greet(name)\n    return "hi " + name\n',
    "missing_colon_if": 'x = 3\nif x > 2\n    print(x)\n',
    "brace_block": 'x = 3\nif x > 2 {\n    print(x)\n',
    "unclosed_paren": 'items = [1, 2, 3]\nprint(len(items)\nprint("done")\n',
    "unclosed_list": 'nums = [1, 2, 3\nprint(nums)\n',
    "unclosed_string": 'name = "Ada\nprint(name)\n',
    "unmatched_paren": 'print("hi"))\n',
    "mismatched_bracket": 'nums = [1, 2, 3)\n',
    "missing_comma": 'nums = [1, 2 3]\nprint(nums)\n',
    "eq_in_if": 'x = 3\nif x = 3:\n    print("three")\n',
    "and_and": 'a = 1\nb = 2\nif a > 0 && b > 0:\n    print("both")\n',
    "or_or": 'a = 1\nif a < 0 || a > 5:\n    print("out")\n',
    "triple_equals": 'a = 1\nif a === 1:\n    print("one")\n',
    "plus_plus": 'i = 0\ni++\nprint(i)\n',
    "elseif": 'x = 2\nif x > 3:\n    print("big")\nelse if x > 1:\n    print("mid")\n',
    "print_statement": 'name = "Ada"\nprint name\n',
    "smart_quotes": 'print(\u201chello\u201d)\n',
    "digit_name": '2nd = 5\n',
    "assign_to_call": 'def f():\n    return 1\nf() = 3\n',
    "return_outside": 'x = 1\nreturn x\n',
    "break_outside": 'x = 1\nbreak\n',
    "let_keyword": 'let total = 5\nprint(total)\n',
    "semicolon_brace": 'x = 1\nif x == 1:\n    print(x)\n}\n',
    "default_param_order": 'def f(a=1, b):\n    return a + b\n',
    "try_without_except": 'try:\n    x = 1\nprint(x)\n',
    # Indentation
    "indent_missing": 'def f():\nreturn 1\nprint(f())\n',
    "indent_unexpected": 'x = 1\n    y = 2\nprint(x + y)\n',
    "indent_unindent": 'def f():\n    if True:\n        x = 1\n      return x\n',
    "indent_for_body": 'for i in range(3):\nprint(i)\n',
    "tab_error": 'def f():\n    x = 1\n\treturn x\n',
    # Names
    "print_caps": 'count = 2\nPrint(count)\n',
    "misspelled_var": 'items = [1, 2]\nprint(len(itms))\n',
    "true_lower": 'done = true\nprint(done)\n',
    "null_value": 'value = null\n',
    "used_before_defined": 'print(total)\ntotal = 5\n',
    "undefined": 'print(total)\n',
    "missing_import": 'print(math.sqrt(16))\n',
    "string_without_quotes": 'print(hello)\n',
    "unbound_local": 'count = 0\ndef add():\n    count += 1\nadd()\n',
    # Attributes / None
    "list_push": 'items = []\nitems.push(4)\nprint(items)\n',
    "str_upper_js": 'name = "ada"\nprint(name.toUpperCase())\n',
    "list_length": 'items = [1, 2]\nprint(items.length)\n',
    "sort_returns_none": 'items = [3, 1]\nitems = items.sort()\nprint(items[0])\n',
    "append_returns_none": 'items = []\nitems = items.append(1)\nitems.append(2)\n',
    "print_not_return": 'def double(x):\n    print(x * 2)\n\nresult = double(4)\nprint(result + 1)\n',
    "none_subscript": 'def first(items):\n    print(items[0])\n\nvalue = first([1, 2])\nprint(value[0])\n',
    "dict_attr_typo": 'd = {"a": 1}\nprint(d.itmes())\n',
    # Types
    "str_plus_int": 'count = 3\nprint("Total: " + count)\n',
    "int_plus_str_input": 'age = "30"\nprint(age + 1)\n',
    "missing_argument": 'def add(a, b):\n    return a + b\n\nprint(add(1))\n',
    "too_many_arguments": 'def add(a, b):\n    return a + b\n\nprint(add(1, 2, 3))\n',
    "missing_self": 'class Dog:\n    def bark():\n        return "woof"\n\nprint(Dog().bark())\n',
    "unexpected_keyword": 'def greet(name):\n    return name\n\ngreet(nmae="Ada")\n',
    "shadowed_builtin": 'sum = 0\nprint(sum([1, 2]))\n',
    "int_not_subscriptable": 'n = 5\nprint(n[0])\n',
    "str_item_assignment": 'word = "cat"\nword[0] = "b"\n',
    "len_of_int": 'n = 5\nprint(len(n))\n',
    "loop_over_int": 'n = 3\nfor i in n:\n    print(i)\n',
    "unhashable": 'd = {[1, 2]: "x"}\n',
    # Lookups / values
    "index_len": 'items = [1, 2, 3]\nprint(items[len(items)])\n',
    "index_range_plus_one": 'items = [1, 2, 3]\nfor i in range(len(items) + 1):\n    print(items[i])\n',
    "index_empty": 'items = []\nprint(items[0])\n',
    "index_past_end": 'items = [1, 2, 3]\nprint(items[5])\n',
    "key_typo": 'person = {"name": "Ada", "age": 36}\nprint(person["nmae"])\n',
    "key_missing": 'person = {"name": "Ada"}\nage = person["age"]\nprint(age)\n',
    "zero_division": 'a = 10\nb = 0\nprint(a / b)\n',
    "zero_division_len": 'items = []\naverage = sum(items) / len(items)\n',
    "int_of_text": 'value = int("abc")\nprint(value)\n',
    "int_of_decimal": 'value = int("3.5")\n',
    "float_of_text": 'value = float("abc")\n',
    "unpack_too_few": 'a, b, c = [1, 2]\n',
    "unpack_too_many": 'a, b = [1, 2, 3]\n',
    "math_domain": 'import math\nprint(math.sqrt(-1))\n',
    "remove_missing": 'items = [1, 2]\nitems.remove(5)\n',
    "module_typo": 'import maths\n',
    "module_missing": 'import flask\n',
    "import_name_typo": 'from math import sqrtt\n',
    "assert_false": 'total = 3\nassert total == 4\n',
    # Recursion
    "recursion_same_arg": 'def count(n):\n    if n == 0:\n        return 0\n    return 1 + count(n)\n\nprint(count(3))\n',
    "recursion_no_base": 'def down(n):\n    return down(n - 1)\n\ndown(3)\n',
}

# Loops that never finish: the worker raises TimeoutError at the loop header.
LOOPS = {
    "loop_no_increment": ('i = 0\nwhile i < 10:\n    print(i)\n', 2),
    "loop_wrong_direction": ('i = 0\nwhile i < 10:\n    i -= 1\n', 2),
    "loop_wrong_direction_down": ('i = 10\nwhile i > 0:\n    i += 1\n', 2),
    "loop_while_true": ('while True:\n    print("x")\n', 1),
    "loop_grows_list": ('items = [1]\nfor x in items:\n    items.append(x)\n', 2),
    "loop_condition_unchanged": ('items = [1, 2]\nwhile items:\n    print(items[0])\n', 2),
}


def capture(source):
    try:
        exec(compile(source, "<playground>", "exec"), {"__name__": "__main__"})
    except BaseException as exc:  # noqa: BLE001 - fixtures record every error type
        event = {"message": f"{type(exc).__name__}: {exc}", "line": None, "frames": []}
        if isinstance(exc, SyntaxError) and exc.lineno is not None:
            event["line"] = exc.lineno
            if exc.offset:
                event["column"] = exc.offset - 1
                if exc.end_offset and exc.end_lineno in (None, exc.lineno) and exc.end_offset > exc.offset:
                    event["endColumn"] = exc.end_offset - 1
        else:
            for frame in traceback.extract_tb(exc.__traceback__):
                if frame.filename == "<playground>":
                    end = frame.end_colno if frame.end_lineno == frame.lineno else None
                    event["line"] = frame.lineno
                    event["column"], event["endColumn"] = frame.colno, end
                    event["frames"].append({"line": frame.lineno, "name": frame.name, "column": frame.colno, "endColumn": end})
            event["frames"] = event["frames"][-12:]
        return event
    raise SystemExit(f"Fixture did not fail: {source!r}")


fixtures = {name: {"code": source, **capture(source)} for name, source in CASES.items()}
for name, (source, line) in LOOPS.items():
    fixtures[name] = {"code": source, "message": "TimeoutError: possible infinite loop — stopped to protect the browser", "line": line, "frames": []}
target = pathlib.Path(__file__).resolve().parent.parent / "src/jev/__fixtures__/python-errors.json"
target.write_text(json.dumps(fixtures, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {len(fixtures)} fixtures to {target}")
