/**
 * First-class ??? blanks: underline + soft tint; click selects the token.
 */

import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { BLANK } from '../goalCheck'

const blankMatcher = new MatchDecorator({
  regexp: new RegExp(BLANK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  decoration: Decoration.mark({
    class: 'cm-blank-token',
    attributes: {
      title: 'Your turn — replace ??? with real code',
    },
  }),
})

const blankPlugin = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = blankMatcher.createDeco(view)
    }

    update(update: ViewUpdate) {
      this.decorations = blankMatcher.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement | null
        if (!target?.closest?.('.cm-blank-token')) return false
        // Select the whole ??? so typing replaces it.
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return false
        const line = view.state.doc.lineAt(pos)
        const text = line.text
        const local = pos - line.from
        const idx = text.indexOf(BLANK)
        if (idx < 0) return false
        // Prefer the blank under the cursor if several on the line.
        let start = idx
        let search = 0
        while (search <= local) {
          const next = text.indexOf(BLANK, search)
          if (next < 0 || next > local) break
          start = next
          search = next + BLANK.length
        }
        if (local < start || local > start + BLANK.length) {
          // click near blank still ok if within mark
          if (Math.abs(local - start) > BLANK.length + 1) return false
        }
        view.dispatch({
          selection: {
            anchor: line.from + start,
            head: line.from + start + BLANK.length,
          },
          userEvent: 'select.blank',
        })
        return true
      },
    },
  },
)

export function blankHighlightExtension() {
  return blankPlugin
}
