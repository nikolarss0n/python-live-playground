import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { getLesson } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import type { ResultEvent } from '../execution/protocol'
import { BLANK_ANSWERS } from './blankAnswers'
import { ALGORITHM_PRACTICE_LESSON_DRAFTS } from './algorithmPracticeLessons'

const hasPython = spawnSync('python3', ['--version']).status === 0
function run(code: string): { ok: boolean; events: ResultEvent[] } {
  const result = spawnSync('python3', ['-I', '-c', code], { encoding: 'utf8', timeout: 5000 })
  const events = result.stdout.split('\n').filter(Boolean).map((text) => ({ kind: 'print', text }) as ResultEvent)
  return { ok: result.status === 0, events }
}
function fill(code: string, answers: readonly string[]): string {
  let index = 0
  return code.replace(/\?\?\?/g, () => answers[index++] ?? BLANK)
}

describe.skipIf(!hasPython)('algorithm practice lessons in real Python', () => {
  it.each(ALGORITHM_PRACTICE_LESSON_DRAFTS.map((draft) => [draft.id] as const))('%s: the starter fails and the intended fill meets the goal', (id) => {
    const lesson = getLesson(id)
    const answers = BLANK_ANSWERS[id]
    expect(answers, id).toBeDefined()
    expect(lesson.code.split(BLANK).length - 1, id).toBe(answers.length)

    expect(run(lesson.code).ok, `${id} starter should not run`).toBe(false)

    const solved = fill(lesson.code, answers)
    const { ok, events } = run(solved)
    expect(ok, `${id} solution failed:\n${events.map((e) => e.kind === 'print' && e.text).join('\n')}`).toBe(true)
    const progress = evaluateGoal(lesson, { code: solved, starterCode: lesson.code, events, status: 'success', executedCode: solved })
    expect(progress.missing, id).toEqual([])
    expect(progress.met, id).toBe(true)
  })
})
