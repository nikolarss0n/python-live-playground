/**
 * Accepting a function, method or class completion adds `()` with the cursor inside, unless the name is not a call:
 * a type annotation, a decorator, an import, or a `(` already follows.
 */

import { insertBracket, pickedCompletion } from '@codemirror/autocomplete'
import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const CALLABLE = new Set(['function', 'method', 'class'])

export function wantsParens(state: EditorState, start: number, end: number): boolean {
  if (state.sliceDoc(end, end + 1) === '(') return false
  const line = state.doc.lineAt(start)
  const before = state.sliceDoc(line.from, start)
  if (/^\s*(from|import)\b/.test(before)) return false
  return !/(@|:|->)\s*[\w.]*$/.test(before)
}

/** Runs after the completion lands; closeBrackets' own insert lets a typed `)` step over the closing paren. */
export const callParens = EditorView.updateListener.of((update) => {
  const picked = update.transactions.map((tr) => tr.annotation(pickedCompletion)).find(Boolean)
  if (!picked || !CALLABLE.has(picked.type ?? '')) return
  const end = update.state.selection.main.head
  if (!wantsParens(update.state, end - picked.label.length, end)) return
  const { view } = update
  queueMicrotask(() => {
    if (view.state.selection.main.head !== end) return
    view.dispatch(insertBracket(view.state, '(') ?? { changes: { from: end, insert: '()' }, selection: { anchor: end + 1 }, userEvent: 'input' })
  })
})
