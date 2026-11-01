import type { ResultEvent } from '../execution/protocol'

export type LoopSlot = { iteration: number; total: number; line: number }

/** Consecutive print/expr rows from one source line are iterations of the same loop. */
export function loopSlots(events: readonly ResultEvent[]): (LoopSlot | null)[] {
  const slots: (LoopSlot | null)[] = events.map(() => null)
  let start = 0
  while (start < events.length) {
    const line = events[start].line
    const loopable = (event: ResultEvent) => event.kind === 'print' || event.kind === 'expr'
    let end = start + 1
    if (line != null && loopable(events[start])) {
      while (end < events.length && events[end].line === line && loopable(events[end])) end++
    }
    if (end - start >= 2 && line != null) {
      for (let index = start; index < end; index++) slots[index] = { iteration: index - start + 1, total: end - start, line }
    }
    start = end
  }
  return slots
}
