/**
 * Leading spaces show as faint dots, one per space, so a learner can count Python's four-space indentation.
 * Only the indentation at the start of a line is marked; spaces inside code stay plain.
 */

import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'

const indentMatcher = new MatchDecorator({
  regexp: /^ +/g,
  decoration: Decoration.mark({ class: 'cm-indent-dots' }),
})

export const indentDotsExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = indentMatcher.createDeco(view) }
    update(update: ViewUpdate) { this.decorations = indentMatcher.updateDeco(update, this.decorations) }
  },
  { decorations: (plugin) => plugin.decorations },
)
