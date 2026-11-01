import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { wantsParens } from './callParens'

function check(text: string) {
  const state = EditorState.create({ doc: text })
  const end = text.length
  const start = end - (/[\w]+$/.exec(text)?.[0].length ?? 0)
  return wantsParens(state, start, end)
}

describe('call parens', () => {
  it('adds parens for calls but not annotations, decorators or imports', () => {
    expect(check('seen = set')).toBe(true)
    expect(check('x = TOOLS.get')).toBe(true)
    expect(check('def f(a: dict')).toBe(false)
    expect(check('def f() -> str')).toBe(false)
    expect(check('@tool')).toBe(false)
    expect(check('from json import dumps')).toBe(false)
  })
})
