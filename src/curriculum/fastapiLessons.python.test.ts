import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLesson } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import type { ResultEvent } from '../execution/protocol'
import { BLANK_ANSWERS } from './blankAnswers'
import { FASTAPI_BUILD_LESSON_DRAFTS } from './fastapiBuildLessons'
import { FASTAPI_BUILD_LADDERS } from './fastapiBuildAnswers'
import { FASTAPI_LADDER_LESSON_DRAFTS } from './fastapiLadderLessons'

const SIM_DIR = path.resolve('src/execution')
const PRELUDE = `import sys\nsys.path.insert(0, ${JSON.stringify(SIM_DIR)})\nimport fastapi_sim\nfastapi_sim.install()\nfastapi_sim.reset()\n`

const hasPython = spawnSync('python3', ['--version']).status === 0
function run(code: string): { ok: boolean; events: ResultEvent[]; stderr: string } {
  const source = `${PRELUDE}exec(compile(${JSON.stringify(code)}, "<playground>", "exec", dont_inherit=True), {"__name__": "__main__"})\n`
  const result = spawnSync('python3', ['-I', '-c', source], { encoding: 'utf8', timeout: 5000 })
  const events = result.stdout.split('\n').filter(Boolean).map((text) => ({ kind: 'print', text }) as ResultEvent)
  return { ok: result.status === 0, events, stderr: result.stderr }
}
function fill(code: string, answers: readonly string[]): string {
  let index = 0
  return code.replace(/\?\?\?/g, () => answers[index++] ?? BLANK)
}

describe.skipIf(!hasPython)('FastAPI lessons in the simulator', () => {
  it.each([...FASTAPI_LADDER_LESSON_DRAFTS, ...FASTAPI_BUILD_LESSON_DRAFTS].map((draft) => [draft.id] as const))('%s: the starter fails and the intended fill meets the goal', (id) => {
    const lesson = getLesson(id)
    const answers = BLANK_ANSWERS[id]
    expect(answers, id).toBeDefined()
    expect(lesson.code.split(BLANK).length - 1, id).toBe(answers.length)

    expect(run(lesson.code).ok, `${id} starter should not run`).toBe(false)

    const solved = fill(lesson.code, answers)
    const { ok, events, stderr } = run(solved)
    const printed = events.map((e) => (e.kind === 'print' ? e.text : '')).join('\n')
    expect(ok, `${id} solution failed:\n${printed}\n${stderr}`).toBe(true)
    const progress = evaluateGoal(lesson, { code: solved, starterCode: lesson.code, events, status: 'success', executedCode: solved })
    expect(progress.missing, `${id}:\n${printed}`).toEqual([])
    expect(progress.met, id).toBe(true)
  })
})

describe('FastAPI lessons where the learner writes the code', () => {
  it('covers lessons 7-22 with one ??? each and a full hint ladder', () => {
    expect(FASTAPI_BUILD_LESSON_DRAFTS.map((draft) => draft.number)).toEqual(Array.from({ length: 16 }, (_, index) => index + 7))
    for (const draft of FASTAPI_BUILD_LESSON_DRAFTS) {
      expect(draft.code.split(BLANK).length - 1, draft.id).toBe(1)
      const ladder = FASTAPI_BUILD_LADDERS[draft.id]
      expect(ladder, draft.id).toBeDefined()
      for (const rung of [ladder.idea, ladder.tool, ladder.plan, ladder.shape]) expect(rung.length, draft.id).toBeGreaterThan(40)
    }
  })

  it('leaves imports to the learner from lesson 15 on', () => {
    for (const draft of FASTAPI_BUILD_LESSON_DRAFTS.filter((lesson) => lesson.number >= 15 && lesson.number <= 21)) {
      expect(draft.code, draft.id).not.toMatch(/^(from|import) /m)
      expect(BLANK_ANSWERS[draft.id][0], draft.id).toMatch(/^from fastapi import /m)
    }
  })
})
