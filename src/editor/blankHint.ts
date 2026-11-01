/**
 * Hint bubble anchored on one ??? blank: a small card above the token with the current hint step,
 * "More help" for the next step, and Insert once the answer is shown. Any edit or Esc closes it.
 */

import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, showTooltip, type Tooltip } from '@codemirror/view'

export type HintBubble = {
  from: number
  to: number
  /** 1-based level shown now, out of `levels` */
  level: number
  levels: number
  text: string
  /** Why the line needs it and clues from the surrounding code */
  detail?: string
  /** The next level reveals the answer */
  nextIsAnswer?: boolean
  kicker?: string
  /** Set when this level reveals the answer */
  answer?: string
  onMore?: () => void
}

export const setHintBubble = StateEffect.define<HintBubble | null>()

const hintField = StateField.define<HintBubble | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setHintBubble)) return effect.value
    return tr.docChanged ? null : value
  },
  provide: (field) => [
    showTooltip.from(field, (bubble) => (bubble ? bubbleTooltip(bubble) : null)),
    EditorView.decorations.from(field, (bubble) =>
      bubble ? Decoration.set([Decoration.mark({ class: 'cm-blank-hinted' }).range(bubble.from, bubble.to)]) : Decoration.none),
  ],
})

function renderInlineCode(text: string): (string | HTMLElement)[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((part) => {
    if (!part.startsWith('`')) return part
    const element = document.createElement('code')
    element.textContent = part.slice(1, -1)
    return element
  })
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = label
  element.addEventListener('click', onClick)
  return element
}

function bubbleTooltip(bubble: HintBubble): Tooltip {
  return {
    pos: bubble.from,
    end: bubble.to,
    above: true,
    arrow: true,
    create(view) {
      const dom = document.createElement('div')
      dom.className = 'cm-hint-bubble'
      dom.setAttribute('role', 'status')
      dom.setAttribute('aria-live', 'polite')

      const head = document.createElement('div')
      head.className = 'cm-hint-head'
      const kicker = document.createElement('span')
      kicker.className = 'cm-hint-kicker'
      kicker.textContent = bubble.answer ? 'Answer' : bubble.kicker ?? `Hint ${bubble.level} of ${bubble.levels}`
      const close = button('×', 'cm-hint-close', () => closeHintBubble(view))
      close.setAttribute('aria-label', 'Close hint')
      head.append(kicker, close)

      const body = document.createElement('p')
      body.className = 'cm-hint-text'
      if (bubble.answer) {
        const code = document.createElement('code')
        code.textContent = bubble.answer
        body.append(code)
      } else {
        body.append(...renderInlineCode(bubble.text))
      }
      dom.append(head, body)
      if (bubble.detail && !bubble.answer) {
        const detail = document.createElement('p')
        detail.className = 'cm-hint-detail'
        detail.append(...renderInlineCode(bubble.detail))
        dom.append(detail)
      }

      const actions = document.createElement('div')
      actions.className = 'cm-hint-actions'
      if (bubble.answer) {
        const answer = bubble.answer
        actions.append(button('Insert', 'cm-hint-primary', () => {
          view.dispatch({ changes: { from: bubble.from, to: bubble.to, insert: answer }, selection: { anchor: bubble.from + answer.length }, userEvent: 'input.hint' })
          view.focus()
        }))
      } else if (bubble.onMore && bubble.level < bubble.levels) {
        const onMore = bubble.onMore
        actions.append(button(bubble.nextIsAnswer ? 'Show answer' : 'More help', 'cm-hint-primary', onMore))
      }
      if (actions.childElementCount) dom.append(actions)
      return { dom }
    },
  }
}

export function closeHintBubble(view: EditorView) {
  view.dispatch({ effects: setHintBubble.of(null) })
}

export function currentHintBubble(view: EditorView): HintBubble | null {
  return view.state.field(hintField, false) ?? null
}

export function showHintBubble(view: EditorView, bubble: HintBubble) {
  view.dispatch({ effects: [setHintBubble.of(bubble), EditorView.scrollIntoView(bubble.from, { y: 'center' })] })
}

export function blankHintExtension() {
  return [hintField]
}
