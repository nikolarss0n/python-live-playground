import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import {
  chipBorderForVariable,
  chipColorForVariable,
  colorForVariable,
  namesOnSourceLine,
  pathFill,
  pathStroke,
} from './variableColors'

describe('path paint intensity', () => {
  it('uses the same soft fill for every name (no mixed hues)', () => {
    expect(chipColorForVariable('name', true)).toBe(
      chipColorForVariable('score', true),
    )
    expect(chipColorForVariable('name', false)).toBe(pathFill(false))
    expect(chipBorderForVariable('name', true)).toBe(pathStroke(true))
  })

  it('aliases colorForVariable to the shared path fill', () => {
    expect(colorForVariable('name', false)).toBe(pathFill(false))
  })
})

describe('namesOnSourceLine', () => {
  function stateFor(code: string) {
    return EditorState.create({
      doc: code,
      extensions: [python()],
    })
  }

  it('finds user variables on a print line and skips print', () => {
    const code = `name = "world"\nprint(f"Hello, {name}!")\n`
    const state = stateFor(code)
    expect(namesOnSourceLine(state, 2)).toEqual(['name'])
  })

  it('finds multiple names on one line', () => {
    const code = `a = 1\nb = 2\nprint(a + b)\n`
    const state = stateFor(code)
    expect(namesOnSourceLine(state, 3).sort()).toEqual(['a', 'b'])
  })

  it('returns empty for expression-only lines', () => {
    const code = `2 + 2\n`
    const state = stateFor(code)
    expect(namesOnSourceLine(state, 1)).toEqual([])
  })
})
