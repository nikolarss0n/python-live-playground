import { pythonLanguage } from '@codemirror/lang-python'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { docstringRanges } from './docstring'

describe('docstrings', () => {
  it('marks only the first string statement of a function or class body', () => {
    const doc = 'def f():\n    """Doc"""\n    x = "not a doc"\n    "later"\n\nclass A:\n    "Class doc"\n'
    const state = EditorState.create({ doc, extensions: pythonLanguage })
    ensureSyntaxTree(state, doc.length)
    expect(docstringRanges(state).map(({ from, to }) => doc.slice(from, to))).toEqual(['"""Doc"""', '"Class doc"'])
  })
})
