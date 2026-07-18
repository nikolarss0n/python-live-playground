import { describe, expect, it } from 'vitest'
import {
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
