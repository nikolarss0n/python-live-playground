import { explainSlot } from './blankSlot'
import { ALGORITHM_LADDER_KICKERS, ALGORITHM_LAYERS } from './curriculum/algorithmLayers'
import { HARNESS_LADDERS } from './curriculum/harnessLadders'
import { FASTAPI_BUILD_LADDERS } from './curriculum/fastapiBuildAnswers'
import { BLANK_ANSWERS } from './curriculum/blankAnswers'
import type { Lesson } from './examples'
import { BLANK } from './goalCheck'

export type HintStep = { text: string; detail?: string; kicker?: string }

export type BlankHint = {
  /** Document offsets of this ??? in the current code */
  from: number
  to: number
  /** Which starter blank this is, so the ladder survives filling the others */
  starterIndex: number
  /** Nudges from general to specific; the answer, when known, comes after them */
  steps: HintStep[]
  answer?: string
}

type Blank = { from: number; lineText: string; occurrence: number; lineBlanks: number }

const IGNORED_WORDS = new Set([
  'and', 'def', 'del', 'for', 'from', 'import', 'not', 'print', 'return', 'self', 'the', 'this', 'that', 'with', 'while',
  'into', 'each', 'line', 'one', 'then', 'your',
])

function findBlanks(code: string): Blank[] {
  const blanks: Blank[] = []
  let lineStart = 0
  for (const lineText of code.split('\n')) {
    const offsets: number[] = []
    for (let at = lineText.indexOf(BLANK); at >= 0; at = lineText.indexOf(BLANK, at + BLANK.length)) offsets.push(at)
    offsets.forEach((at, occurrence) => blanks.push({ from: lineStart + at, lineText, occurrence, lineBlanks: offsets.length }))
    lineStart += lineText.length + 1
  }
  return blanks
}

function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) ?? []).filter((word) => !IGNORED_WORDS.has(word)))
}

function sharedEnds(a: string, b: string): number {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  return start + end
}

/** Maps a blank in the learner's code back to the starter blank on the most similar line. */
function starterIndexFor(blank: Blank, starter: readonly Blank[], current: readonly Blank[]): number | null {
  const same = (a: Blank, b: Blank) => a.lineText === b.lineText && a.occurrence === b.occurrence
  const twins = starter.flatMap((candidate, index) => (same(candidate, blank) ? [index] : []))
  if (twins.length) {
    // Identical lines (two `self.value = ???`) map in order of appearance.
    const earlier = current.filter((other) => other.from < blank.from && same(other, blank)).length
    return twins[Math.min(earlier, twins.length - 1)]
  }
  let best: { score: number; line: string } | null = null
  for (const candidate of starter) {
    if (candidate.lineBlanks < blank.lineBlanks) continue
    const score = sharedEnds(candidate.lineText.trim(), blank.lineText.trim())
    if (!best || score > best.score) best = { score, line: candidate.lineText }
  }
  if (!best || best.score < 4) return null
  const lineBlanks = starter.filter((candidate) => candidate.lineText === best.line)
  // Learners usually fill a line left to right, so the remaining blanks are its last ones.
  const index = lineBlanks.length - blank.lineBlanks + blank.occurrence
  return starter.indexOf(lineBlanks[index] ?? lineBlanks[lineBlanks.length - 1])
}

function taskIndexFor(lesson: Lesson, lineText: string, starterIndex: number, starterCount: number): number {
  const lineWords = words(lineText.replace(/#.*$/, ''))
  let best = -1
  let bestScore = 0
  lesson.tasks.forEach((task, index) => {
    const taskWords = words(`${task} ${lesson.taskInstructions?.[index] ?? ''}`)
    const score = [...lineWords].filter((word) => taskWords.has(word)).length
    if (score > bestScore) {
      best = index
      bestScore = score
    }
  })
  if (best >= 0) return best
  return Math.min(lesson.tasks.length - 1, Math.floor((starterIndex * lesson.tasks.length) / Math.max(1, starterCount)))
}

/** One hint ladder per ??? still in `code`, in document order. */
export function blankHints(lesson: Lesson, code: string): BlankHint[] {
  const starter = findBlanks(lesson.code)
  const answers = BLANK_ANSWERS[lesson.id]
  const current = findBlanks(code)
  return current.map((blank, position) => {
    const mapped = starterIndexFor(blank, starter, current)
    const starterIndex = mapped ?? Math.min(position, Math.max(0, starter.length - 1))
    const starterBlank = mapped === null ? undefined : starter[mapped]
    const starterLine = starterBlank?.lineText ?? blank.lineText
    const slot = starterBlank ? explainSlot(lesson.code, starterBlank.from) : explainSlot(code, blank.from)
    const inlineComment = /\S.*?#\s*(.+)$/.exec(starterLine)?.[1]?.trim()
    const commentClue = inlineComment && !inlineComment.includes(BLANK) ? [`The comment on this line says: “${inlineComment}”.`] : []
    const ladder = ALGORITHM_LAYERS[lesson.id] ?? HARNESS_LADDERS[lesson.id] ?? FASTAPI_BUILD_LADDERS[lesson.id]
    if (ladder) {
      // Algorithm bodies start empty: climb from the idea to the shape of the code; the Solution pill has the answer.
      const rungs = [ladder.idea, ladder.tool, ladder.plan, ladder.shape]
      return {
        from: blank.from,
        to: blank.from + BLANK.length,
        starterIndex,
        steps: rungs.map((text, index) => ({ text, kicker: ALGORITHM_LADDER_KICKERS[index] })),
      }
    }
    const steps: HintStep[] = [{ text: slot.what, detail: [slot.why, ...commentClue, ...slot.clues].join(' ') }]
    if (lesson.tasks.length) {
      const task = taskIndexFor(lesson, starterLine, starterIndex, starter.length)
      const detail = lesson.taskInstructions?.[task]
      const extra = lesson.hints?.[0]
      steps.push({ text: `Task: ${lesson.tasks[task]}`, ...(detail && detail !== lesson.tasks[task] ? { detail } : extra ? { detail: extra } : {}) })
    } else if (lesson.hints?.length) {
      steps.push({ text: lesson.hints[0] })
    }
    const answer = mapped === null ? undefined : answers?.[mapped]
    return { from: blank.from, to: blank.from + BLANK.length, starterIndex, steps, ...(answer ? { answer } : {}) }
  })
}

/** Number of levels a blank offers: every step, then the answer when one is known. */
export function hintLevels(hint: BlankHint): number {
  return hint.steps.length + (hint.answer ? 1 : 0)
}
