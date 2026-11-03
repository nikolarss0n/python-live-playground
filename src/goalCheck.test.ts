import { describe, expect, it } from 'vitest'
import { codeContains, evaluateGoal, normalizeCode } from './goalCheck'

describe('codeContains', () => {
  it.each([
    ['hours = minutes//60', 'minutes // 60'],
    ['points+=5', 'points += 5'],
    ['if len(stack)==0:', 'len(stack) == 0'],
    ['print( "Hi" )', 'print("Hi")'],
    ['x = a  and  b', ' and '],
    ['assert x > 0', 'assert '],
    ['if hot:\n    print("Hot day: drink water")', '    print("Hot day: drink water")'],
    ['rows = db.execute("SELECT COUNT(*) FROM products")', 'COUNT(*) FROM products'],
  ])('accepts %j for %j', (code, snippet) => {
    expect(codeContains(code, snippet)).toBe(true)
  })

  it.each([
    ['hours = minutes / 60', 'minutes // 60'],
    ['candy = 1', ' and '],
    ['print("Hi  there")', 'print("Hi there")'],
    ['# use minutes // 60 here\nhours = 2', 'minutes // 60'],
    ['print("Hot day: drink water")', '    print("Hot day: drink water")'],
    ['returnx', 'return x'],
  ])('rejects %j for %j', (code, snippet) => {
    expect(codeContains(code, snippet)).toBe(false)
  })
})

describe('normalizeCode', () => {
  it('keeps a # inside a string, so editing after it is a real change', () => {
    expect(normalizeCode('print("Total #1")')).not.toBe(normalizeCode('print("Total #2")'))
    expect(normalizeCode("print('a # b')\nx = 1  # note")).toBe("print('a # b')\nx = 1")
  })

  it('keeps # inside triple-quoted strings across lines', () => {
    expect(normalizeCode('s = """\n# one\n"""')).not.toBe(normalizeCode('s = """\n# two\n"""'))
  })

  it('ignores comment-only and blank-line edits', () => {
    expect(normalizeCode('x = 1\n\n# done\n')).toBe(normalizeCode('x = 1  # set x'))
  })
})

describe('evaluateGoal', () => {
  const lesson = { code: 'hours = ???\nprint(hours)', goalCheck: { codeIncludes: ['minutes // 60'] } }
  const run = (code: string, executedCode: string | null = code) => evaluateGoal(lesson, {
    code, starterCode: lesson.code, status: 'success', executedCode,
    events: [{ kind: 'print', text: '2' }],
  })

  it('accepts correct code written without spaces around the operator', () => {
    expect(run('minutes = 135\nhours = minutes//60\nprint(hours)').met).toBe(true)
  })

  it('treats an edit after a # inside a string as needing a new run', () => {
    const progress = run('minutes = 135\nhours = minutes // 60\nprint("Total #2", hours)', 'minutes = 135\nhours = minutes // 60\nprint("Total #1", hours)')
    expect(progress.missing).toContain('Run again after your latest edits')
  })
})
