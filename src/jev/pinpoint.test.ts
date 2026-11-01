import { describe, expect, it, vi } from 'vitest'
import { askJevPinpoint, buildPinpointRequest, candidatesFor, tracedLines, explainPinpoint, MISTAKES, parsePinpointAnswer, tokenizeLine, type Candidate, type Mistake } from './pinpoint'
import { JEV_ROUTE } from './forward'

function pick(code: string, line: number, text: string, kind: Candidate['kind'] = 'token'): Candidate {
  const found = candidatesFor(code, line).find((entry) => entry.line === line && entry.kind === kind && (kind !== 'token' || entry.text === text))
  if (!found) throw new Error(`No candidate ${text} on line ${line}`)
  return found
}
const fix = (code: string, line: number, text: string, mistake: Mistake, kind: Candidate['kind'] = 'token') =>
  explainPinpoint(code, pick(code, line, text, kind), mistake, 0.9, line)

describe('Jev pinpoint fixes', () => {
  it.each([
    ['a = 5\ndefz sumy(a, b):\n    print(a)', 2, 'defz', 'misspelled_keyword', 'def sumy(a, b):'],
    ['def f(x):\n    retrun x', 2, 'retrun', 'extra_token', '    return x'],
    ['function add(a, b):\n    return a + b', 1, 'function', 'foreign_syntax', 'def add(a, b):'],
    ['count = 2\nPrint(count)', 2, 'Print', 'misspelled_name', 'print(count)'],
    ['items = [1]\nprint(len(itms))', 2, 'itms', 'undefined_name', 'print(len(items))'],
    ['x = 3\nif x = 3:\n    pass', 2, '=', 'wrong_operator', 'if x == 3:'],
    ['a = 1\nif a > 0 && a < 2:\n    pass', 2, '&&', 'foreign_syntax', 'if a > 0 and a < 2:'],
    ['items = []\nitems.push(4)', 2, 'push', 'wrong_method', 'items.append(4)'],
    ['count = 3\nprint("Total: " + count)', 2, 'count', 'wrong_type', 'print("Total: " + str(count))'],
    ['done = true', 1, 'true', 'foreign_syntax', 'done = True'],
    ['nums = [1, 2 3]', 1, ',', 'missing_separator', 'nums = [1, 2, 3]'],
    ['x = 2\nif x > 3:\n    pass\nelse if x > 1:\n    pass', 4, 'if', 'extra_token', 'elif x > 1:'],
  ] as const)('%#: %s', (code, line, token, mistake, expected) => {
    const result = fix(code, line, token, mistake)
    expect(result.fixedLine).toBe(expected)
    expect(result.message).toMatch(/`/)
  })

  it('handles missing line ends and indentation positions', () => {
    expect(fix('for i in range(3)\n    pass', 1, '', 'missing_colon', 'eol').fixedLine).toBe('for i in range(3):')
    expect(fix('print(len(items)\nx = 1', 1, '', 'missing_closing', 'eol').fixedLine).toBe('print(len(items))')
    expect(fix('name = "Ada\nprint(name)', 1, '', 'missing_closing', 'eol').fixedLine).toBe('name = "Ada"')
    expect(fix('def f():\nreturn 1', 2, '', 'wrong_indentation', 'indent').fixedLine).toBe('    return 1')
    expect(fix('x = 1\n    y = 2', 2, '', 'wrong_indentation', 'indent')).toMatchObject({ fixedLine: 'y = 2', from: 0, to: 4 })
  })

  it('falls back to the reported line when the chosen indentation is already right', () => {
    const code = 'x = 1\n    y = 2'
    const result = explainPinpoint(code, pick(code, 1, '', 'indent'), 'wrong_indentation', 0.6, 2)
    expect(result).toMatchObject({ line: 2, fixedLine: 'y = 2' })
  })

  it('searches every traceback line, not only the lines around the error', () => {
    const code = 'def average(values):\n    return sum(values) / len(values)\n\n\n\n\n\nscores = []\nprint(average(scores))'
    const near = new Set(candidatesFor(code, 2).map((entry) => entry.line))
    const traced = new Set(candidatesFor(code, 2, new Set(), [9]).map((entry) => entry.line))
    expect(near.has(9)).toBe(false)
    expect(traced.has(9)).toBe(true)
    expect(traced.has(8)).toBe(true)
  })

  it('adds the lines that assign names used on traceback lines', () => {
    const code = 'width = "10"\n\n\n\n\n\ndef half(value):\n    return value / 2\nprint(half(width))'
    expect(tracedLines(code, { line: 8, frames: [{ line: 9, name: '<module>' }, { line: 8, name: 'half' }] }).sort()).toEqual([1, 8, 9])
  })

  it('searches the whole program for a failing check', () => {
    const code = Array.from({ length: 12 }, (_, index) => `x${index} = ${index}`).join('\n')
    expect(new Set(candidatesFor(code, undefined, new Set(), [], true).map((entry) => entry.line)).size).toBe(12)
  })

  it('moves a line out of the loop when code runs but a check fails', () => {
    const code = 'def count(items):\n    n = 0\n    for x in items:\n        n += 1\n        return n'
    const candidate = { ...pick(code, 4, 'n'), line: 5, from: 0, to: 8, text: '        ', kind: 'indent' as const }
    expect(explainPinpoint(code, candidate, 'wrong_indentation', 0.8, undefined, true)).toMatchObject({ line: 5, fixedLine: '    return n' })
    expect(explainPinpoint(code, candidate, 'wrong_indentation', 0.8, undefined, false).fixedLine).toBeUndefined()
  })

  it('never treats Object.prototype names as known fixes', () => {
    expect(fix('items = []\nitems.constructor(1)', 2, 'constructor', 'wrong_method').fixedLine).toBeUndefined()
    expect(fix('toString = 1\nx = toString', 2, 'toString', 'wrong_operator').fixedLine).toBeUndefined()
  })

  it('explains without inventing a fix when none is known', () => {
    const result = fix('value = int("abc")', 1, '"abc"', 'wrong_type')
    expect(result.fixedLine).toBeUndefined()
    expect(result.message).toContain('not a number')
  })
})

describe('Jev pinpoint request', () => {
  it('tokenizes strings, comments and multi-character operators', () => {
    expect(tokenizeLine('if a === "x # y" && b: # note').map((token) => token.text)).toEqual(['if', 'a', '===', '"x # y"', '&&', 'b', ':'])
    expect(tokenizeLine('name = "Ada').at(-1)).toMatchObject({ text: '"Ada', to: 11 })
  })

  it('offers tokens, indentation and line ends near the error, and every mistake kind', () => {
    const code = '# comment\na = 1\n\ndefz f():\n    pass\nprint(a)\nprint(b)'
    const candidates = candidatesFor(code, 4)
    expect(new Set(candidates.map((entry) => entry.line))).toEqual(new Set([2, 4, 5]))
    const request = buildPinpointRequest(code, { message: 'SyntaxError: invalid syntax', line: 4 }, candidates)
    expect(Object.keys(request.questions.location.criteria)).toEqual(candidates.map((entry) => entry.id))
    expect(request.questions.mistake.criteria).toBe(MISTAKES)
    expect(request.state.code).not.toContain('comment')
  })

  it('rejects answers that name unknown candidates or mistakes', () => {
    const code = 'defz f():\n    pass'
    const candidates = candidatesFor(code, 1)
    const answer = (location: string, mistake: string) => ({ answers: {
      location: { type: 'choice', choice: location, confidence: 0.9 }, mistake: { type: 'choice', choice: mistake, confidence: 0.8 } } })
    expect(parsePinpointAnswer(answer('t1', 'misspelled_keyword'), code, candidates)).toMatchObject({ line: 1, fixedLine: 'def f():', confidence: 0.8 })
    expect(parsePinpointAnswer(answer('t999', 'misspelled_keyword'), code, candidates)).toBeNull()
    expect(parsePinpointAnswer(answer('t1', 'toString'), code, candidates)).toBeNull()
    expect(parsePinpointAnswer(null, code, candidates)).toBeNull()
  })

  it('never sends masked secret lines and posts to the same-origin route', async () => {
    const code = 'token = "sk-live-abcdefghijklmnopqrstuvwx"\ndefz f():\n    pass'
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ answers: {
      location: { type: 'choice', choice: 't1', confidence: 0.9 }, mistake: { type: 'choice', choice: 'misspelled_keyword', confidence: 0.9 } } })))
    const result = await askJevPinpoint(code, { message: 'SyntaxError: invalid syntax', line: 2 }, { fetchImpl })
    expect(fetchImpl.mock.calls[0][0]).toBe(JEV_ROUTE)
    expect(String(fetchImpl.mock.calls[0][1]?.body)).not.toContain('sk-live')
    expect(result).toMatchObject({ ok: true, pinpoint: { line: 2, fixedLine: 'def f():' } })
  })

  it('reports server failures without throwing', async () => {
    const failed = await askJevPinpoint('defz f():', { message: 'SyntaxError', line: 1 }, {
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'Jev is not configured.' }), { status: 503 })),
    })
    expect(failed).toMatchObject({ ok: false, error: 'Jev is not configured.' })
  })
})
