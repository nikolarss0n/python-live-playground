import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  friendlyErrorMessage,
  parseErrorName,
  PYTHON_PRELUDE,
} from './instrument'

describe('friendlyErrorMessage', () => {
  it('explains ZeroDivisionError for beginners', () => {
    const text = friendlyErrorMessage('ZeroDivisionError', 'division by zero')
    expect(text).toContain('ZeroDivisionError')
    expect(text.toLowerCase()).toContain('zero')
  })

  it('explains NameError', () => {
    const text = friendlyErrorMessage('NameError', "name 'x' is not defined")
    expect(text).toContain('not defined')
  })

  it('falls back for unknown errors', () => {
    const text = friendlyErrorMessage('WeirdError', 'something odd')
    expect(text).toContain('WeirdError')
    expect(text).toContain('Something went wrong')
  })
})

describe('parseErrorName', () => {
  it('extracts the exception class', () => {
    expect(parseErrorName('SyntaxError: invalid syntax')).toBe('SyntaxError')
  })
})

describe('PYTHON_PRELUDE', () => {
  it('defines the runner entrypoint used by the worker', () => {
    expect(PYTHON_PRELUDE).toContain('def _plp_run')
    expect(PYTHON_PRELUDE).toContain('def __plp_show__')
    expect(PYTHON_PRELUDE).toContain('_plp_transform')
    expect(PYTHON_PRELUDE).toContain('def _plp_print')
    expect(PYTHON_PRELUDE).toContain('def _plp_invoke')
    expect(PYTHON_PRELUDE).toContain('fastapi_sim')
    expect(PYTHON_PRELUDE).toContain('def _plp_structure')
    expect(PYTHON_PRELUDE).toContain('"structure"')
  })

  it('instruments loops with a soft time limit check', () => {
    expect(PYTHON_PRELUDE).toContain('def _plp_check_limit')
    expect(PYTHON_PRELUDE).toContain('_PlpLimitLoops')
    expect(PYTHON_PRELUDE).toContain('possible infinite loop')
    expect(PYTHON_PRELUDE).toContain('_PLP_SOFT_LIMIT_S')
  })
})

const hasPython = spawnSync('python3', ['--version']).status === 0

function lastEvent(source: string) {
  const driver = `${PYTHON_PRELUDE}\nimport json, sys\nprint(json.dumps(_plp_run(sys.argv[1])["events"][-1]))\n`
  const result = spawnSync('python3', ['-I', '-', source], { input: driver, encoding: 'utf8', timeout: 10000 })
  return JSON.parse(result.stdout.trim().split('\n').at(-1) ?? 'null')
}

describe.skipIf(!hasPython)('error events in real Python', () => {
  it('report the failing expression column and every playground frame', () => {
    const event = lastEvent('def f(x):\n    return x[5]\n\nf([1])\n')
    expect(event).toMatchObject({ kind: 'error', line: 2, column: 11, endColumn: 15 })
    expect(event.frames).toEqual([
      { line: 4, name: '<module>', column: 0, endColumn: 6 },
      { line: 2, name: 'f', column: 11, endColumn: 15 },
    ])
  })

  it('report the 0-based syntax error column without frames', () => {
    const event = lastEvent('a = 5\ndefz sumy(a, b):\n    pass\n')
    expect(event).toMatchObject({ line: 2, column: 5, endColumn: 9, frames: [] })
  })
})
