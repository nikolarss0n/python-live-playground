import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLesson } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import type { ResultEvent } from '../execution/protocol'
import { BLANK_ANSWERS } from './blankAnswers'
import { FULLSTACK_LESSON_DRAFTS } from './fullstackLessons'

const SIM_DIR = path.resolve('src/execution')

const hasPython = spawnSync('python3', ['--version']).status === 0
function run(code: string, seed = 1): { ok: boolean; events: ResultEvent[]; stderr: string } {
  const prelude = `import sys\nsys.path.insert(0, ${JSON.stringify(SIM_DIR)})\nimport fastapi_sim, playdb\nfastapi_sim.install()\nfastapi_sim.reset()\nplaydb.configure(${seed})\n`
  const source = `${prelude}exec(compile(${JSON.stringify(code)}, "<playground>", "exec", dont_inherit=True), {"__name__": "__main__"})\n`
  const result = spawnSync('python3', ['-I', '-c', source], { encoding: 'utf8', timeout: 8000 })
  const events = result.stdout.split('\n').filter(Boolean).map((text) => ({ kind: 'print', text }) as ResultEvent)
  return { ok: result.status === 0, events, stderr: result.stderr }
}
function fill(code: string, answers: readonly string[]): string {
  let index = 0
  return code.replace(/\?\?\?/g, () => answers[index++] ?? BLANK)
}

describe.skipIf(!hasPython)('full-stack data lessons with SQLite and the simulator', () => {
  it.each(FULLSTACK_LESSON_DRAFTS.flatMap((draft) => [[draft.id, 1], [draft.id, 7]] as const))('%s (seed %i): the starter fails and the intended fill meets the goal', (id, seed) => {
    const lesson = getLesson(id)
    const answers = BLANK_ANSWERS[id]
    expect(answers, id).toBeDefined()
    expect(lesson.code.split(BLANK).length - 1, id).toBe(answers.length)

    expect(run(lesson.code, seed).ok, `${id} starter should not run`).toBe(false)

    const solved = fill(lesson.code, answers)
    const { ok, events, stderr } = run(solved, seed)
    const printed = events.map((e) => (e.kind === 'print' ? e.text : '')).join('\n')
    expect(ok, `${id} solution failed:\n${printed}\n${stderr}`).toBe(true)
    const progress = evaluateGoal(lesson, { code: solved, starterCode: lesson.code, events, status: 'success', executedCode: solved })
    expect(progress.missing, `${id}:\n${printed}`).toEqual([])
    expect(progress.met, id).toBe(true)
  })
})

describe('full-stack data chapter', () => {
  it('groups seven lessons with Data · API · View tabs after the FastAPI lessons', () => {
    const lessons = FULLSTACK_LESSON_DRAFTS.map((draft) => getLesson(draft.id))
    expect(lessons.map((lesson) => lesson.chapter)).toEqual(Array(7).fill('Full-stack data'))
    expect(lessons.map((lesson) => lesson.number)).toEqual([25, 26, 27, 28, 29, 30, 31])
    expect(lessons.every((lesson) => lesson.fullstack && lesson.bookChapter === undefined)).toBe(true)
  })
})
