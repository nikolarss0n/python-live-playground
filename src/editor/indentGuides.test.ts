import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { indentGuidesExtension } from './indentGuides'

let view: EditorView | null = null
afterEach(() => { view?.destroy(); view = null })

describe('indentation guides', () => {
  it('marks only the spaces at the start of each line, including blank indented lines', () => {
    view = new EditorView({
      state: EditorState.create({ doc: 'if x:\n    print("a b")\n        y = 1\n    \nz = 2', extensions: indentGuidesExtension }),
      parent: document.body,
    })
    expect(view.dom.querySelector('.cm-indent-guides')).toHaveAttribute('title', '4 leading spaces')
    view.dispatch({ changes: { from: 6, insert: ' ' } })
    expect(view.dom.querySelector('.cm-indent-guides')).toHaveAttribute('title', '5 leading spaces')
    expect([...view.dom.querySelectorAll('.cm-indent-guides')].map((element) => element.textContent)).toEqual(['    ', ' ', '        ', '    '])
    expect(view.dom.querySelector('.cm-indent-partial')).toHaveTextContent(/^ $/, { normalizeWhitespace: false })
    view.dispatch({ changes: { from: 6, insert: '   ' } })
    expect(view.dom.querySelector('.cm-indent-partial')).toBeNull()
    expect(view.dom.querySelector('.cm-indent-guides')).toHaveAttribute('title', '8 leading spaces')
  })
})
