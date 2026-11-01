import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { currentProblemMark, openProblemCard, problemMarkExtension, showProblemMark } from './problemMark'

let view: EditorView | null = null
afterEach(() => { view?.destroy(); view = null })

function mount(doc: string) {
  view = new EditorView({ state: EditorState.create({ doc, extensions: problemMarkExtension() }), parent: document.body })
  return view
}

describe('problem mark', () => {
  it('marks the exact token and applies the corrected line', () => {
    const editor = mount('a = 1\ndefz f():\n    pass')
    showProblemMark(editor, { source: 'Jev', line: 2, from: 0, to: 4, message: '`defz` is not a Python keyword.', fixedLine: 'def f():' })
    expect(editor.dom.querySelector('.cm-problem-mark')?.textContent).toBe('defz')
    expect(editor.dom.querySelector('.cm-problem-card')).toBeNull()
    openProblemCard(editor)
    const card = editor.dom.querySelector('[aria-label="Problem on line 2"]')
    expect(card?.textContent).toContain('defz is not a Python keyword.')
    ;(card!.querySelector('.cm-problem-apply') as HTMLButtonElement).click()
    expect(editor.state.doc.toString()).toBe('a = 1\ndef f():\n    pass')
    expect(currentProblemMark(editor.state)).toBeNull()
  })

  it('applies a whole-program fix such as a rename across lines', () => {
    const editor = mount('sum = 0\nprint(sum([1, 2]))\nprint(sum)')
    showProblemMark(editor, { source: 'Fix', line: 2, from: 6, to: 9, message: 'Rename it.', fixedLine: 'sum_value = 0', fixLine: 1,
      fixedCode: 'sum_value = 0\nprint(sum([1, 2]))\nprint(sum_value)' })
    openProblemCard(editor)
    ;(editor.dom.querySelector('.cm-problem-apply') as HTMLButtonElement).click()
    expect(editor.state.doc.toString()).toBe('sum_value = 0\nprint(sum([1, 2]))\nprint(sum_value)')
  })

  it('inserts model snippets as comments and clears on any edit or dismiss', () => {
    const editor = mount('def f():\n    retrun 1')
    showProblemMark(editor, { source: 'AI', line: 2, from: 4, to: 12, message: 'Use return.', snippet: 'return 1' })
    openProblemCard(editor)
    ;(editor.dom.querySelector('.cm-problem-apply') as HTMLButtonElement).click()
    expect(editor.state.doc.toString()).toBe('def f():\n    # AI: Use return.\n    # return 1\n    retrun 1')
    showProblemMark(editor, { source: 'AI', line: 1, from: 0, to: 3, message: 'x' })
    editor.dispatch({ changes: { from: 0, insert: ' ' } })
    expect(currentProblemMark(editor.state)).toBeNull()
    showProblemMark(editor, { source: 'Jev', line: 1, from: 9, to: 9, message: 'x' })
    expect(editor.dom.querySelector('.cm-problem-caret')).not.toBeNull()
    openProblemCard(editor)
    ;(editor.dom.querySelector('.cm-problem-dismiss') as HTMLButtonElement).click()
    expect(currentProblemMark(editor.state)).toBeNull()
  })
})
