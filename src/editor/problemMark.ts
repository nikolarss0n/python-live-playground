/**
 * In-editor problem marker: a red mark on the exact token (or a caret where something is missing). Hovering the line,
 * or Mod-. with the cursor on it, opens a small card with the reason and, when known, the corrected code. Any edit clears it.
 */

import { type EditorState, StateEffect, StateField, type Range, type Text } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType, hoverTooltip, keymap, showTooltip, type Tooltip } from '@codemirror/view'

export type ProblemMark = {
  source: string
  line: number
  /** 0-based columns within the line; equal values mark a position */
  from: number
  to: number
  message: string
  /** Corrected text for the whole line */
  fixedLine?: string
  /** Line `fixedLine` replaces when it is not the marked line */
  fixLine?: number
  /** Whole corrected program, for fixes that touch several lines (a rename or a moved line); `fixedLine` is then its preview */
  fixedCode?: string
  /** Extra code to insert above the line as comments (model suggestions) */
  snippet?: string
}

export const setProblemMark = StateEffect.define<ProblemMark | null>()
/** Pins the card open (keyboard) or closes it */
export const setProblemCardOpen = StateEffect.define<boolean>()

type ProblemState = { mark: ProblemMark | null; decorations: DecorationSet; open: boolean }
const empty: ProblemState = { mark: null, decorations: Decoration.none, open: false }

const problemField = StateField.define<ProblemState>({
  create: () => empty,
  update(value, tr) {
    let next = tr.docChanged ? empty : value
    for (const effect of tr.effects) {
      if (effect.is(setProblemMark)) next = effect.value ? { mark: effect.value, decorations: buildDecorations(tr.state.doc, effect.value), open: false } : empty
      if (effect.is(setProblemCardOpen) && next.mark) next = { ...next, open: effect.value }
    }
    return next
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    showTooltip.compute([field], (state) => {
      const { mark, open } = state.field(field)
      return open && mark ? cardTooltip(state.doc, mark) : null
    }),
  ],
})

function cardTooltip(doc: Text, mark: ProblemMark): Tooltip | null {
  const line = lineSafe(doc, mark.line)
  if (!line) return null
  return { pos: line.from + Math.min(mark.from, line.length), above: false, create: (view) => ({ dom: new ProblemCard(mark).toDOM(view) }) }
}

const problemHover = hoverTooltip((view, pos) => {
  const { mark, open } = view.state.field(problemField)
  if (!mark || open || view.state.doc.lineAt(pos).number !== mark.line) return null
  return cardTooltip(view.state.doc, mark)
}, { hoverTime: 250 })

const problemKeys = keymap.of([
  {
    key: 'Mod-.',
    run(view) {
      const { mark, open } = view.state.field(problemField)
      if (!mark) return false
      view.dispatch({ effects: setProblemCardOpen.of(!open) })
      return true
    },
  },
  {
    key: 'Escape',
    run(view) {
      if (!view.state.field(problemField).open) return false
      view.dispatch({ effects: setProblemCardOpen.of(false) })
      return true
    },
  },
])

function lineSafe(doc: Text, number: number) {
  return number >= 1 && number <= doc.lines ? doc.line(number) : null
}

export function currentProblemMark(state: EditorState): ProblemMark | null {
  return state.field(problemField, false)?.mark ?? null
}

/** Text the "Apply" button writes, or null when the mark has nothing to apply. */
export function problemChange(view: EditorView, mark: ProblemMark) {
  const line = lineSafe(view.state.doc, mark.line)
  if (!line) return null
  if (mark.fixedCode !== undefined) return { from: 0, to: view.state.doc.length, insert: mark.fixedCode }
  if (mark.fixedLine !== undefined) {
    const target = lineSafe(view.state.doc, mark.fixLine ?? mark.line)
    return target ? { from: target.from, to: target.to, insert: mark.fixedLine } : null
  }
  if (mark.snippet) {
    const indent = /^\s*/.exec(line.text)?.[0] ?? ''
    const comment = [`${mark.source}: ${mark.message}`, ...mark.snippet.split('\n')].map((row) => `${indent}# ${row}`.trimEnd()).join('\n')
    return { from: line.from, to: line.from, insert: `${comment}\n` }
  }
  return null
}

class CaretWidget extends WidgetType {
  toDOM() {
    const caret = document.createElement('span')
    caret.className = 'cm-problem-caret'
    caret.setAttribute('aria-hidden', 'true')
    return caret
  }
}

class ProblemCard {
  readonly mark: ProblemMark
  constructor(mark: ProblemMark) { this.mark = mark }
  toDOM(view: EditorView) {
    const { mark } = this
    const card = document.createElement('div')
    card.className = 'cm-problem-card'
    card.setAttribute('role', 'group')
    card.setAttribute('aria-label', `Problem on line ${mark.line}`)

    const message = document.createElement('p')
    const badge = document.createElement('span')
    badge.className = 'cm-problem-source'
    badge.textContent = mark.source
    message.append(badge, ' ', ...renderInlineCode(mark.message))
    card.append(message)

    const preview = mark.fixedLine ?? mark.snippet
    if (preview !== undefined) {
      const pre = document.createElement('pre')
      pre.className = 'cm-problem-fix'
      pre.textContent = mark.fixedLine !== undefined ? dedent(preview) || ' ' : preview
      card.append(pre)
    }

    const actions = document.createElement('div')
    actions.className = 'cm-problem-actions'
    const change = problemChange(view, mark)
    if (change) {
      const apply = document.createElement('button')
      apply.type = 'button'
      apply.className = 'cm-problem-apply'
      apply.textContent = mark.fixedLine !== undefined ? 'Apply fix' : 'Insert as comment'
      apply.addEventListener('click', () => {
        const current = problemChange(view, mark)
        if (current) view.dispatch({ changes: current, effects: setProblemMark.of(null), userEvent: 'input.fix' })
        view.focus()
      })
      actions.append(apply)
    }
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.className = 'cm-problem-dismiss'
    dismiss.textContent = 'Dismiss'
    dismiss.addEventListener('click', () => { view.dispatch({ effects: setProblemMark.of(null) }); view.focus() })
    actions.append(dismiss)
    card.append(actions)
    return card
  }
}

function dedent(text: string): string {
  const rows = text.split('\n')
  const indent = Math.min(...rows.filter((row) => row.trim()).map((row) => row.length - row.trimStart().length))
  return rows.map((row) => row.slice(Number.isFinite(indent) ? indent : 0)).join('\n')
}

/** `a` and `b` in backticks become <code> elements; everything else stays text. */
function renderInlineCode(text: string): (string | HTMLElement)[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((part) => {
    if (!part.startsWith('`')) return part
    const element = document.createElement('code')
    element.textContent = part.slice(1, -1)
    return element
  })
}

function buildDecorations(doc: Text, mark: ProblemMark): DecorationSet {
  const line = lineSafe(doc, mark.line)
  if (!line) return Decoration.none
  const from = line.from + Math.min(mark.from, line.length)
  const to = line.from + Math.min(Math.max(mark.to, mark.from), line.length)
  const ranges: Range<Decoration>[] = [Decoration.line({ class: 'cm-problem-line' }).range(line.from)]
  ranges.push(from < to
    ? Decoration.mark({ class: 'cm-problem-mark' }).range(from, to)
    : Decoration.widget({ widget: new CaretWidget(), side: 1 }).range(from))
  return Decoration.set(ranges, true)
}

export function problemMarkExtension() {
  return [problemField, problemHover, problemKeys]
}

export function openProblemCard(view: EditorView) {
  view.dispatch({ effects: setProblemCardOpen.of(true) })
}

export function showProblemMark(view: EditorView, mark: ProblemMark | null) {
  view.dispatch({ effects: setProblemMark.of(mark) })
  if (mark) {
    const line = lineSafe(view.state.doc, mark.line)
    if (line) view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'nearest' }) })
  }
}
