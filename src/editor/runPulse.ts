/**
 * Brief highlight on source lines that produced the latest run results.
 * Reduced-motion users get a static soft mark that clears with the next edit.
 */

import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'

export const setPulseLines = StateEffect.define<readonly number[]>()
export const clearPulseLines = StateEffect.define<null>()

const pulseField = StateField.define<readonly number[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setPulseLines)) return e.value
      if (e.is(clearPulseLines)) return []
    }
    if (tr.docChanged) return []
    return value
  },
})

function buildPulseSet(lines: readonly number[], view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const pulse = Decoration.line({ class: 'cm-run-pulse-line' })
  const seen = new Set<number>()
  const sorted = [...lines].filter((n) => n >= 1).sort((a, b) => a - b)
  for (const lineNo of sorted) {
    if (seen.has(lineNo)) continue
    seen.add(lineNo)
    try {
      const line = view.state.doc.line(lineNo)
      builder.add(line.from, line.from, pulse)
    } catch {
      // line gone
    }
  }
  return builder.finish()
}

const pulsePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none

    constructor(view: EditorView) {
      this.decorations = buildPulseSet(view.state.field(pulseField), view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setPulseLines) || e.is(clearPulseLines)),
        )
      ) {
        this.decorations = buildPulseSet(
          update.state.field(pulseField),
          update.view,
        )
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export function runPulseExtension() {
  return [pulseField, pulsePlugin]
}

export function pulseSourceLines(
  view: EditorView | null,
  lines: readonly number[],
): void {
  if (!view) return
  view.dispatch({ effects: setPulseLines.of([...lines]) })
  window.setTimeout(() => {
    try {
      view.dispatch({ effects: clearPulseLines.of(null) })
    } catch {
      // view disposed
    }
  }, 1400)
}

export function linesFromEvents(
  events: readonly { line?: number }[],
): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const e of events) {
    if (e.line != null && e.line > 0 && !seen.has(e.line)) {
      seen.add(e.line)
      out.push(e.line)
    }
  }
  return out
}
