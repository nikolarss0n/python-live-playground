import { describe, expect, it } from 'vitest'
import {
  cleanErrorDetail,
  enrichErrorEvent,
  explainError,
  friendlyErrorMessage,
  looksLikeCStyleFor,
  parseErrorName,
  suggestPythonForFromCStyle,
} from './errorExplain'

describe('explainError', () => {
  it('teaches ZeroDivisionError with a next step', () => {
    const e = explainError('ZeroDivisionError', 'division by zero')
    expect(e.title.toLowerCase()).toContain('zero')
    expect(e.summary.toLowerCase()).toContain('divide')
    expect(e.tip.length).toBeGreaterThan(10)
    expect(e.example).toBeTruthy()
  })

  it('names the missing identifier in NameError', () => {
    const e = explainError('NameError', "name 'score' is not defined")
    expect(e.title).toContain('score')
    expect(e.tip).toContain('score')
    expect(e.summary).toContain('score')
  })

  it('parses a full message string', () => {
    const e = explainError('TypeError: can only concatenate str (not "int") to str')
    expect(e.name).toBe('TypeError')
    expect(e.title.toLowerCase()).toMatch(/wrong|type|value/)
  })

  it('covers SyntaxError and IndentationError', () => {
    expect(explainError('SyntaxError', 'invalid syntax').tip).toMatch(/colon|quote|bracket/i)
    expect(explainError('IndentationError', 'unexpected indent').title).toMatch(
      /indent/i,
    )
  })
})

describe('friendlyErrorMessage', () => {
  it('includes summary and tip', () => {
    const text = friendlyErrorMessage('IndexError', 'list index out of range')
    expect(text).toContain('IndexError')
    expect(text.toLowerCase()).toContain('index')
  })
})

describe('cleanErrorDetail', () => {
  it('strips Pyodide file/line suffix from syntax messages', () => {
    expect(
      cleanErrorDetail("'(' was never closed (<unknown>, line 1)"),
    ).toBe("'(' was never closed")
    expect(cleanErrorDetail('invalid syntax (script.py, line 4)')).toBe(
      'invalid syntax',
    )
    expect(cleanErrorDetail('name not defined')).toBe('name not defined')
  })
})

describe('parseErrorName', () => {
  it('extracts the exception class', () => {
    expect(parseErrorName('SyntaxError: invalid syntax')).toBe('SyntaxError')
  })
})

describe('enrichErrorEvent', () => {
  it('attaches a structured explanation', () => {
    const enriched = enrichErrorEvent({
      kind: 'error',
      message: 'ZeroDivisionError: division by zero',
      friendly: 'old',
      traceback: 'Traceback…',
      line: 4,
    })
    expect(enriched.explanation.name).toBe('ZeroDivisionError')
    expect(enriched.explanation.title).toMatch(/zero/i)
    expect(enriched.line).toBe(4)
  })
})

describe('C-style for-loop coaching', () => {
  it('teaches unfinished starter blanks without suggesting unrelated punctuation changes', () => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, { sourceLine: '    return ???' })
    expect(explanation.title).toBe('Finish the starter blank')
    expect(explanation.tip).toContain('Replace ???')
    expect(explanation.tip).not.toContain('match every')
  })

  it('does not confuse question marks in a string or comment with a starter blank', () => {
    for (const sourceLine of ['print("???") +', 'value = ) # ???', 'f"literal ??? {name"', 'f"{{???}}" +', 'f"{\'???\'}" +']) {
      expect(explainError('SyntaxError: invalid syntax', undefined, { sourceLine }).title)
        .not.toBe('Finish the starter blank')
    }
  })

  it('recognizes an unfinished expression inside an f-string', () => {
    const explanation = explainError('SyntaxError: f-string: invalid syntax', undefined, {
      sourceLine: 'message = f"{name}: {duration:.2f}s (success={???})"',
    })
    expect(explanation.title).toBe('Finish the starter blank')
    expect(explanation.tip).toContain('Replace ???')
  })
  it('detects classic three-part for headers', () => {
    expect(looksLikeCStyleFor('for(i = 0; i < 10; i++):')).toBe(true)
    expect(looksLikeCStyleFor('for (i=0; i<10; i++)')).toBe(true)
    expect(looksLikeCStyleFor('for i in range(10):')).toBe(false)
  })

  it('suggests a range-based rewrite', () => {
    const fixed = suggestPythonForFromCStyle('for(i = 0; i < 10; i++):')
    expect(fixed).toContain('for i in range(10):')
    expect(fixed).toContain('print(i)')
  })

  it('explains SyntaxError with C-style for source line', () => {
    const e = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine: 'for(i = 0; i < 10; i++):',
    })
    expect(e.title.toLowerCase()).toMatch(/for|python/)
    expect(e.summary.toLowerCase()).toMatch(/range|javascript|c/)
    expect(e.example).toMatch(/range\(10\)/)
    expect(e.tip.toLowerCase()).toMatch(/range/)
  })

  it('marks TimeoutError as a possible infinite loop when message says so', () => {
    const e = explainError(
      'TimeoutError: possible infinite loop — stopped to protect the browser',
    )
    expect(e.title.toLowerCase()).toMatch(/infinite loop/)
    expect(e.summary.toLowerCase()).toMatch(/browser|stuck|loop/)
    expect(e.example).toMatch(/while n < 3/)
  })
})

describe('precise Python syntax guidance', () => {
  it.each([
    ['function sumy(a,b):', 'function sumy(a,b):\n    print(a+b)'],
    ['    function sumy(a,b):', '    function sumy(a,b):\n        print(a+b)'],
    ['function sumy(a,b):print(a+b)', 'function sumy(a,b):print(a+b)'],
  ])('explains the screenshot function header %s without inventing a body', (sourceLine, sourceSnippet) => {
    const explanation = explainError('SyntaxError', 'invalid syntax (<unknown>, line 1)', { sourceLine, sourceSnippet })
    expect(explanation.title).toBe('Use def to define a Python function')
    expect(explanation.tip).toContain('Replace `function` with `def`')
    expect(explanation.example).toBe('def sumy(a,b):\n    print(a+b)')
    expect(explanation.name).toBe('SyntaxError')
    expect(explanation.detail).toBe('invalid syntax (<unknown>, line 1)')
  })

  it('preserves the actual function arguments and uses an explicit placeholder when its body is unknown', () => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine: 'function greet(name="Ada", suffix=")"):',
    })
    expect(explanation.example).toBe('def greet(name="Ada", suffix=")"):\n    pass  # Add your function or block body here.')
    expect(explanation.example).not.toContain('print(')
    expect(explanation.example).not.toContain('return ')
  })

  it('uses only the failing line for classification, not an unrelated later blank', () => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine: 'function bad():',
      sourceSnippet: 'function bad():\n    return ???',
    })
    expect(explanation.title).toBe('Use def to define a Python function')
    expect(explanation.example).not.toContain('???')
    const otherLine = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine: 'value = )', sourceSnippet: 'value = )\nfunction unrelated(a):\n    return ???',
    })
    expect(otherLine.title).toBe('Code could not be read')
  })

  it.each(['let', 'const', 'var'])('explains a JavaScript %s declaration and preserves its value', (keyword) => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine: `${keyword} name = "Ada === learner" # keep the text`,
    })
    expect(explanation.title).toBe('Assign the variable without a declaration keyword')
    expect(explanation.tip).toContain(`Remove \`${keyword}\``)
    expect(explanation.example).toBe('name = "Ada === learner" # keep the text')
  })

  it.each([
    ['value===expected', 'value==expected', '`===` → `==`'],
    ['value!==expected', 'value!=expected', '`!==` → `!=`'],
    ['ready&&enabled', 'ready and enabled', '`&&` → `and`'],
    ['ready||enabled', 'ready or enabled', '`||` → `or`'],
  ])('explains the actual operator in %s', (sourceLine, example, tip) => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, { sourceLine })
    expect(explanation.title).toBe('Use Python comparison and logical operators')
    expect(explanation.tip).toContain(tip)
    expect(explanation.example).toBe(example)
  })

  it('changes only code operators while preserving quoted tokens, comments, and Unicode offsets', () => {
    const sourceLine = 'if ready&&name==="Ada || learner": # !== stays in the comment'
    const explanation = explainError('SyntaxError: invalid syntax', undefined, {
      sourceLine, sourceSnippet: `${sourceLine}\n    print(name)`,
    })
    expect(explanation.example).toBe('if ready and name=="Ada || learner": # !== stays in the comment\n    print(name)')
    expect(explanation.tip).not.toContain('`||` →')
    expect(explanation.tip).not.toContain('`!==` →')
    const unicode = explainError('SyntaxError: invalid syntax', undefined, { sourceLine: 'label = "😀 ==="; ready&&enabled' })
    expect(unicode.example).toBe('label = "😀 ==="; ready and enabled')
  })

  it.each([
    'text = "function sumy(a,b):" +',
    'text = "let value = 3" +',
    'text = "value === other && ready || nope" +',
    'text = "escaped \\" +',
    'text = "escaped \\"quote === here" +',
    'text = """function f(): && || !==""" +',
    'text = f"literal && {value} ===" +',
    'text = f"{record["==="]} && literal" +',
    "text = f'{record['!==']} || literal' +",
    'value = ) # function sumy(a,b): const x = 3 && true',
    'function = )',
    'const = )',
    'let: int = )',
    'def sumy(a,b):',
    'if value == expected:',
  ])('does not classify literal, commented, or valid Python tokens in %s', (sourceLine) => {
    expect(explainError('SyntaxError: invalid syntax', undefined, { sourceLine }).title).toBe('Code could not be read')
  })

  it('does not offer JavaScript fixes for runtime errors or tokens mentioned only in a message', () => {
    expect(explainError('NameError', "name 'function' is not defined", { sourceLine: 'function(sumy)' }).title).toBe('Unknown name: function')
    expect(explainError('TypeError', 'bad types', { sourceLine: 'a===b' }).title).toBe('Wrong kind of value')
    expect(explainError('SyntaxError', "invalid syntax near '==='", { sourceLine: 'value = )' }).title).toBe('Code could not be read')
  })

  it.each([
    'if ready', 'elif ready', 'else', 'for item in items', 'while ready',
    'def total(a: int, b: int)', 'class Result', 'try', 'except ValueError',
    'finally', 'with open(path) as handle', 'match value', 'case 1',
  ])('adds a colon only when Python reports it missing from %s', (sourceLine) => {
    const explanation = explainError('SyntaxError', "expected ':'", { sourceLine })
    expect(explanation.title).toBe('Add a colon after the block header')
    expect(explanation.example).toBe(`${sourceLine}:\n    pass  # Add your function or block body here.`)
    expect(explainError('SyntaxError', 'invalid syntax', { sourceLine }).title).toBe('Code could not be read')
  })

  it('puts the missing colon after string expressions and before comments', () => {
    const sourceLine = 'if "ready" # literal condition'
    const explanation = explainError('SyntaxError', "expected ':'", {
      sourceLine, sourceSnippet: `${sourceLine}\n    print("ready")`,
    })
    expect(explanation.example).toBe('if "ready": # literal condition\n    print("ready")')
  })

  it.each(['value = 1', 'if ready:', 'if ready: print(ready)', 'def good(): return 1'])('does not add a colon to unrelated or already complete code: %s', (sourceLine) => {
    expect(explainError('SyntaxError', "expected ':'", { sourceLine }).title).toBe('Code could not be read')
  })

  it('uses the actual indentation error rather than guessing a missing colon', () => {
    const missingBody = explainError('IndentationError', 'expected an indented block after function definition on line 1', { sourceLine: 'print(a+b)' })
    expect(missingBody.title).toBe('Indent the body after the header')
    expect(missingBody.example).toBe('    print(a+b)')
    const unexpected = explainError('IndentationError', 'unexpected indent', { sourceLine: '        value = 1' })
    expect(unexpected.title).toBe('This line is indented too far')
    expect(unexpected.example).toBeUndefined()
    expect(explainError('TabError', 'inconsistent use of tabs and spaces in indentation').tip).toContain('indentation tabs with spaces')
  })

  it('keeps raw error fields intact when enriching the screenshot case', () => {
    const raw = { kind: 'error' as const, message: 'SyntaxError: invalid syntax', friendly: 'old', traceback: 'Traceback\n  function sumy(a,b):\n  ^^^^^^^^\nSyntaxError: invalid syntax', line: 3 }
    const enriched = enrichErrorEvent(raw, { sourceLine: 'function sumy(a,b):', sourceSnippet: 'function sumy(a,b):\n    print(a+b)' })
    expect(enriched.message).toBe(raw.message)
    expect(enriched.traceback).toBe(raw.traceback)
    expect(enriched.line).toBe(raw.line)
    expect(enriched.explanation.name).toBe('SyntaxError')
    expect(enriched.explanation.detail).toBe('invalid syntax')
    expect(enriched.explanation.example).toBe('def sumy(a,b):\n    print(a+b)')
  })

  it('does not find C-style loops inside text, comments, or a Python loop body', () => {
    for (const source of ['print("for(i=0; i<10; i++)") +', '# for(i=0; i<10; i++)', 'for (left, right) in pairs:\n    value = --number']) {
      expect(looksLikeCStyleFor(source)).toBe(false)
    }
  })

  it('keeps the existing C-style loop diagnosis ahead of an operator inside that loop', () => {
    const explanation = explainError('SyntaxError: invalid syntax', undefined, { sourceLine: 'for(i=0; i!==10; i++):' })
    expect(explanation.title).toBe('That for-loop is not Python')
  })
})
