/**
 * Compare successive run result streams for quiet “what changed” cues.
 */

import type { ResultEvent } from './execution/protocol'

/** Stable fingerprint of a result row (content + kind + line). */
export function eventFingerprint(event: ResultEvent): string {
  switch (event.kind) {
    case 'print':
      return `print|${event.line ?? ''}|${event.text}`
    case 'expr':
      return `expr|${event.line}|${event.value}`
    case 'warning':
      return `warning|${event.line ?? ''}|${event.text}`
    case 'error':
      return `error|${event.line ?? ''}|${event.message}`
  }
}

/**
 * Mark indices in `current` that did not appear in `previous`
 * (new or changed rows). Empty previous → nothing highlighted.
 */
export function updatedEventIndices(
  current: readonly ResultEvent[],
  previous: readonly ResultEvent[] | null | undefined,
): Set<number> {
  const out = new Set<number>()
  if (!previous?.length) return out
  const prev = new Set(previous.map(eventFingerprint))
  current.forEach((event, i) => {
    if (!prev.has(eventFingerprint(event))) out.add(i)
  })
  return out
}
