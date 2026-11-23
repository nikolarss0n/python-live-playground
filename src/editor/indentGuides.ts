import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'

const indentMatcher = new MatchDecorator({
  regexp: /^ +/g,
  decorate(add, from, to) {
    const spaces = to - from
    const fullEnd = to - spaces % 4
    const attributes = { title: spaces + (spaces === 1 ? ' leading space' : ' leading spaces') }
    if (from < fullEnd) add(from, fullEnd, Decoration.mark({ class: 'cm-indent-guides', attributes }))
    if (fullEnd < to) add(fullEnd, to, Decoration.mark({ class: 'cm-indent-guides cm-indent-partial', attributes }))
  },
})

export const indentGuidesExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = indentMatcher.createDeco(view) }
    update(update: ViewUpdate) { this.decorations = indentMatcher.updateDeco(update, this.decorations) }
  },
  { decorations: (plugin) => plugin.decorations },
)
