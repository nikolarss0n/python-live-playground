import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/python-errors.json'
import { diagnose, diagnoseTimeout, markReported, otherSuspects, type DiagnoseInput } from './diagnose'

/**
 * Every fixture is a real Python error (regenerate with scripts/generate-error-fixtures.py).
 * Row: [fixture, marked line, exact marked text, corrected line?, line the fix replaces?]
 */
const EXPECTED: [string, number, string, string?, number?][] = [
    ["defz", 4, "defz", "def sumy(a, b):"],
    ["function_keyword", 1, "function", "def sumy(a, b):"],
    ["retrun", 2, "retrun", "    return x * 2"],
    ["whlie", 2, "whlie", "while n < 3:"],
    ["missing_colon_for", 2, "", "for i in range(3):"],
    ["missing_colon_def", 1, "", "def greet(name):"],
    ["missing_colon_if", 2, "", "if x > 2:"],
    ["brace_block", 2, "{", "if x > 2:"],
    ["unclosed_paren", 2, "", "print(len(items))"],
    ["unclosed_list", 1, "", "nums = [1, 2, 3]"],
    ["unclosed_string", 1, "", "name = \"Ada\""],
    ["unmatched_paren", 1, ")", "print(\"hi\")"],
    ["mismatched_bracket", 1, ")", "nums = [1, 2, 3]"],
    ["missing_comma", 1, "3", "nums = [1, 2, 3]"],
    ["eq_in_if", 2, "=", "if x == 3:"],
    ["and_and", 3, "&&", "if a > 0 and b > 0:"],
    ["or_or", 2, "||", "if a < 0 or a > 5:"],
    ["triple_equals", 2, "===", "if a == 1:"],
    ["plus_plus", 2, "++", "i += 1"],
    ["elseif", 4, "else if", "elif x > 1:"],
    ["print_statement", 2, "print", "print(name)"],
    ["smart_quotes", 1, "“", "print(\"hello\")"],
    ["digit_name", 1, "2nd", "second = 5"],
    ["assign_to_call", 3, "f()", "f_result = f()"],
    ["return_outside", 2, "return", "print(x)"],
    ["break_outside", 2, "break", "pass"],
    ["let_keyword", 1, "let", "total = 5"],
    ["semicolon_brace", 4, "}", ""],
    ["default_param_order", 1, "def f(a=1, b):", "def f(b, a=1):"],
    ["try_without_except", 1, "try", "except Exception as error:\n    print(error)\nprint(x)", 3],
    ["indent_missing", 2, "", "    return 1"],
    ["indent_unexpected", 2, "    ", "y = 2"],
    ["indent_unindent", 4, "      ", "    return x"],
    ["indent_for_body", 2, "", "    print(i)"],
    ["tab_error", 3, "\t", "    return x"],
    ["print_caps", 2, "Print", "print(count)"],
    ["misspelled_var", 2, "itms", "print(len(items))"],
    ["true_lower", 1, "true", "done = True"],
    ["null_value", 1, "null", "value = None"],
    ["used_before_defined", 1, "total", "total = 5\nprint(total)"],
    ["undefined", 1, "total", "print(\"total\")"],
    ["missing_import", 1, "math", "import math\nprint(math.sqrt(16))"],
    ["string_without_quotes", 1, "hello", "print(\"hello\")"],
    ["unbound_local", 3, "count", "def add():\n    global count", 2],
    ["list_push", 2, "push", "items.append(4)"],
    ["str_upper_js", 2, "toUpperCase", "print(name.upper())"],
    ["list_length", 2, "items.length", "print(len(items))"],
    ["sort_returns_none", 2, "items", "items.sort()"],
    ["append_returns_none", 2, "items", "items.append(1)"],
    ["print_not_return", 2, "print", "    return x * 2"],
    ["none_subscript", 2, "print", "    return items[0]"],
    ["dict_attr_typo", 2, "itmes", "print(d.items())"],
    ["str_plus_int", 2, "count", "print(\"Total: \" + str(count))"],
    ["int_plus_str_input", 2, "age", "print(int(age) + 1)"],
    ["missing_argument", 4, "add", "print(add(1, 0))"],
    ["too_many_arguments", 4, "add", "print(add(1, 2))"],
    ["missing_self", 2, "", "    def bark(self):"],
    ["unexpected_keyword", 4, "nmae", "greet(name=\"Ada\")"],
    ["shadowed_builtin", 2, "sum", "sum_value = 0", 1],
    ["int_not_subscriptable", 2, "n", "print(str(n)[0])"],
    ["str_item_assignment", 2, "word", "word = \"b\" + word[1:]"],
    ["len_of_int", 2, "len", "print(len(str(n)))"],
    ["loop_over_int", 2, "n", "for i in range(n):"],
    ["unhashable", 1, "[1, 2]", "d = {(1, 2): \"x\"}"],
    ["index_len", 2, "len(items)", "print(items[len(items) - 1])"],
    ["index_range_plus_one", 2, "range(len(items) + 1)", "for i in range(len(items)):"],
    ["index_empty", 2, "0", "if items:\n    print(items[0])"],
    ["index_past_end", 2, "5", "if len(items) > 5:\n    print(items[5])"],
    ["key_typo", 2, "\"nmae\"", "print(person[\"name\"])"],
    ["key_missing", 2, "\"age\"", "age = person.get(\"age\")"],
    ["zero_division", 3, "b", "if b != 0:\n    print(a / b)"],
    ["zero_division_len", 2, "len(items)", "average = sum(items) / len(items) if items else 0"],
    ["int_of_text", 1, "\"abc\"", "value = (int(\"abc\") if \"abc\".strip().lstrip(\"-\").isdigit() else 0)"],
    ["int_of_decimal", 1, "int", "value = float(\"3.5\")"],
    ["float_of_text", 1, "\"abc\"", "value = (float(\"abc\") if \"abc\".strip().lstrip(\"-\").replace(\".\", \"\", 1).isdigit() else 0.0)"],
    ["unpack_too_few", 1, "a, b, c", "a, b = [1, 2]"],
    ["unpack_too_many", 1, "a, b", "a, b, *rest = [1, 2, 3]"],
    ["math_domain", 2, "sqrt", "print(math.sqrt(abs(-1)))"],
    ["remove_missing", 2, "remove", "if 5 in items:\n    items.remove(5)"],
    ["module_typo", 1, "maths", "import math"],
    ["module_missing", 1, "flask"],
    ["import_name_typo", 1, "sqrtt", "from math import sqrt"],
    ["assert_false", 2, "assert total == 4"],
    ["recursion_same_arg", 4, "count(n)", "    return 1 + count(n - 1)"],
    ["recursion_no_base", 2, "down(n - 1)", "def down(n):\n    if n <= 0:\n        return n", 1],
    ["loop_no_increment", 2, "i", "    print(i)\n    i += 1", 3],
    ["loop_wrong_direction", 3, "i -= 1", "    i += 1"],
    ["loop_wrong_direction_down", 3, "i += 1", "    i -= 1"],
    ["loop_while_true", 1, "while True:", "    print(\"x\")\n    break", 2],
    ["loop_grows_list", 2, "items", "for x in items[:]:"],
    ["loop_condition_unchanged", 2, "items", "    print(items[0])\n    items.pop(0)", 3],
]

const cases = fixtures as Record<string, DiagnoseInput>

describe('local diagnosis of real Python errors', () => {
  it('has an expectation for every fixture', () => {
    expect(EXPECTED.map(([name]) => name).sort()).toEqual(Object.keys(cases).sort())
  })

  it.each(EXPECTED)('%s', (name, line, marked, fixedLine, fixLine) => {
    const input = cases[name]
    const result = diagnose(input)
    expect(result, input.message).not.toBeNull()
    const text = input.code.split('\n')[result!.line - 1]
    expect(result!.line).toBe(line)
    expect(text.slice(result!.from, result!.to)).toBe(marked)
    expect(result!.fixedLine).toBe(fixedLine)
    expect(result!.fixLine).toBe(fixLine)
    expect(result!.message.length).toBeGreaterThan(20)
  })

  it('marks any other exception at the reported expression as a last resort', () => {
    const code = 'name = "data.csv"\nwith open(name) as handle:\n    print(handle.read())'
    expect(diagnose({ code, message: "FileNotFoundError: [Errno 44] No such file or directory: 'data.csv'", line: 2, column: 5, endColumn: 15 })).toBeNull()
    expect(markReported({ code, message: "FileNotFoundError: [Errno 44] No such file or directory: 'data.csv'", line: 2, column: 5, endColumn: 15 }))
      .toMatchObject({ line: 2, from: 5, to: 15, message: expect.stringContaining('does not exist') })
    expect(markReported({ code: 'raise CustomError("x")', message: 'CustomError: x', line: 1 })).toMatchObject({ from: 0, to: 22, message: 'Python stopped here with `CustomError`: x.' })
    expect(markReported({ code: 'import sys\nsys.exit(3)', message: 'SystemExit: 3', line: 2 })).toBeNull()
  })

  it('returns null when the message gives nothing to locate', () => {
    expect(diagnose({ code: 'x = 1', message: 'SystemExit: 3', line: 1 })).toBeNull()
    expect(diagnose({ code: 'x = 1', message: 'SyntaxError: invalid syntax', line: 1 })).toBeNull()
    expect(diagnose({ code: 'x = 1', message: 'NameError: name \'y\' is not defined' })).toBeNull()
  })
})

describe('timeouts without a line', () => {
  it('finds the loop whose condition never changes and adds the step at the end of the body', () => {
    expect(diagnoseTimeout('i = 0\nwhile i < 10:\n    print(i)\n')).toMatchObject({ line: 2, fixLine: 3, fixedLine: '    print(i)\n    i += 1' })
    expect(diagnoseTimeout('print(1)')).toBeNull()
  })
})

describe('other suspicious lines', () => {
  it('lists further lines with the same easy mistakes, since Python stops at the first', () => {
    const code = 'if x > 1\n    pass\nwhlie y < 2:\n    pass\nok = a && b\nprint("&& in text")\nfor i in range(\n    3):\n    pass'
    expect(otherSuspects(code, 1)).toEqual([3, 5])
  })
})
