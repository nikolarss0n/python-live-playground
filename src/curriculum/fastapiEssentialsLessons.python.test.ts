import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLesson } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import type { ResultEvent } from '../execution/protocol'
import { BLANK_ANSWERS } from './blankAnswers'
import { FASTAPI_ESSENTIALS_LESSON_DRAFTS } from './fastapiEssentialsLessons'

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

describe.skipIf(!hasPython)('FastAPI essentials lessons in the simulator', () => {
  it.each(FASTAPI_ESSENTIALS_LESSON_DRAFTS.map((draft) => [draft.id] as const))('%s: the starter fails and the intended fill meets the goal', (id) => {
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
