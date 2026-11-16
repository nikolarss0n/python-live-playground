import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { indentDotsExtension } from './indentDots'

let view: EditorView | null = null
afterEach(() => { view?.destroy(); view = null })

describe('indentation dots', () => {
  it('marks only the spaces at the start of each line, including blank indented lines', () => {
    view = new EditorView({
      state: EditorState.create({ doc: 'if x:\n    print("a b")\n        y = 1\n    \nz = 2', extensions: indentDotsExtension }),
      parent: document.body,
    })
    expect([...view.dom.querySelectorAll('.cm-indent-dots')].map((element) => element.textContent)).toEqual(['    ', '        ', '    '])
  })
})
