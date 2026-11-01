/** Hover any word in the editor to see what it is, what it means and, for the learner's own names, where it comes from. */

import { syntaxTree } from '@codemirror/language'
import { hoverTooltip } from '@codemirror/view'
import { explainToken } from '../codeExplain'

function withCode(parent: HTMLElement, text: string) {
  text.split(/(`[^`]+`)/).forEach((part) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const code = document.createElement('code')
      code.textContent = part.slice(1, -1)
      parent.append(code)
    } else if (part) parent.append(part)
  })
}

export function codeHoverExtension() {
  return hoverTooltip(
    (view, pos, side) => {
      const node = syntaxTree(view.state).resolveInner(pos, side)
      if (/String|Comment/.test(node.name)) return null
      const info = explainToken(view.state.doc.toString(), pos)
      if (!info) return null
      return {
        pos: info.from,
        end: info.to,
        above: true,
        arrow: true,
        create() {
          const dom = document.createElement('div')
          dom.className = 'cm-code-explain'
          const head = document.createElement('div')
          head.className = 'cm-code-explain-head'
          const name = document.createElement('code')
          name.textContent = info.name
          const kind = document.createElement('span')
          kind.className = 'cm-code-explain-kind'
          kind.textContent = info.kind
          head.append(name, kind)
          const body = document.createElement('p')
          body.className = 'cm-code-explain-text'
          withCode(body, info.text)
          dom.append(head, body)
          if (info.origin) {
            const origin = document.createElement('p')
            origin.className = 'cm-code-explain-origin'
            withCode(origin, info.origin)
            dom.append(origin)
          }
          return { dom }
        },
      }
    },
    { hoverTime: 350 },
  )
}
