import type { ResultEvent } from '../execution/protocol'
import { sourceBlocks, type SourceBlocks } from './branchOf'

/**
 * A row's place in a loop card. `line` is the loop's own line (or the repeated line when the source is unknown),
 * `group` the index of the card's first row, and `firstInRound` marks where a round's number is shown.
 */
export type LoopSlot = {
  iteration: number
  total: number
  line: number
  group: number
  first: boolean
  last: boolean
  firstInRound: boolean
}

const loopable = (event: ResultEvent) => event.kind === 'print' || event.kind === 'expr'

/**
 * Groups output that one loop printed into rounds. With the source, consecutive rows from the same innermost loop
 * form one card, whichever if/else printed them, and a round starts again when output goes back up the loop body.
 * Rows outside any loop (a function called repeatedly) fall back to repeats of the same line.
 */
export function loopSlots(events: readonly ResultEvent[], source?: string | SourceBlocks | null): (LoopSlot | null)[] {
  const { loops, branches } = typeof source === 'object' && source !== null ? source : sourceBlocks(source ?? '')
  // Two arms of one if/elif/else never both run in the same round.
  const otherArm = (a?: number, b?: number) => {
    const x = a != null ? branches.get(a) : undefined
    const y = b != null ? branches.get(b) : undefined
    return x != null && y != null && x.chain === y.chain && x.line !== y.line
  }
  const slots: (LoopSlot | null)[] = events.map(() => null)
  const loopOf = (event: ResultEvent) => (event.line != null && loopable(event) ? loops.get(event.line) ?? null : null)
  let start = 0
  while (start < events.length) {
    const first = events[start]
    const loop = loopOf(first)
    let end = start + 1
    if (loop != null) {
      while (end < events.length && loopOf(events[end]) === loop) end++
    } else if (first.line != null && loopable(first)) {
      while (end < events.length && events[end].line === first.line && loopable(events[end]) && loopOf(events[end]) == null) end++
    }
    const rounds: number[] = []
    let round = 0
    for (let index = start; index < end; index++) {
      const previous = index > start ? events[index - 1].line ?? 0 : Infinity
      const line = events[index].line ?? 0
      if (line <= previous || (index > start && otherArm(events[index - 1].line, line))) round++
      rounds.push(round)
    }
    if (round >= 2 && first.line != null) {
      for (let index = start; index < end; index++) {
        const iteration = rounds[index - start]
        slots[index] = {
          iteration,
          total: round,
          line: loop ?? first.line,
          group: start,
          first: index === start,
          last: index === end - 1,
          firstInRound: index === start || rounds[index - start - 1] !== iteration,
        }
      }
    }
    start = end
  }
  return slots
}
