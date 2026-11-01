/**
 * Docstrings (a string that is the first statement of a function or class body) get their own muted color.
 * Grammar path tags lose to the stock `String` rule, so this marks them from the syntax tree instead.
 */

import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

const docMark = Decoration.mark({ class: 'cm-docstring' })

export function docstringRanges(state: EditorState, from = 0, to = state.doc.length): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'Body') return
      let first = node.node.firstChild
      while (first && first.name === ':') first = first.nextSibling
      const string = first?.name === 'ExpressionStatement' ? first.firstChild : null
      if (string && (string.name === 'String' || string.name === 'ContinuedString') && !string.nextSibling) found.push({ from: string.from, to: string.to })
    },
  })
  return found
}

function build(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (const { from, to } of view.visibleRanges) {
    for (const range of docstringRanges(view.state, from, to)) ranges.push(docMark.range(range.from, range.to))
  }
  return Decoration.set(ranges, true)
}

export const docstringExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = build(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)
