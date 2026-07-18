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
