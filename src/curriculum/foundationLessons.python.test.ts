import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { getLesson, lessonsForDifficulty } from '../examples'
import { BLANK, evaluateGoal } from '../goalCheck'
import type { ResultEvent } from '../execution/protocol'
import { BEGINNER_PATH } from './beginnerPath'
import { BLANK_ANSWERS } from './blankAnswers'
import { FOUNDATION_LESSON_DRAFTS } from './foundationLessons'

/** Edits a lesson asks for beyond its blanks. */
const EXTRA_EDITS: Record<string, [string, string][]> = {
  'comments-indentation': [['\nprint("Hot day', '\n    print("Hot day']],
}
const solutionFor = (id: string) => ({ blanks: [...(BLANK_ANSWERS[id] ?? [])], edits: EXTRA_EDITS[id] })

const workDir = mkdtempSync(path.join(tmpdir(), 'plp-foundation-'))
afterAll(() => rmSync(workDir, { recursive: true, force: true }))

const hasPython = spawnSync('python3', ['--version']).status === 0
function run(code: string): { ok: boolean; events: ResultEvent[]; stderr: string } {
  const result = spawnSync('python3', ['-I', '-c', code], { encoding: 'utf8', timeout: 5000, cwd: workDir })
  const events = result.stdout.split('\n').filter(Boolean).map((text) => ({ kind: 'print', text }) as ResultEvent)
  return { ok: result.status === 0, events, stderr: result.stderr }
}
function solve(code: string, { blanks, edits = [] }: { blanks: string[]; edits?: [string, string][] }): string {
  let index = 0
  const filled = code.replace(/\?\?\?/g, () => blanks[index++] ?? BLANK)
  return edits.reduce((text, [from, to]) => text.replace(from, to), filled)
}

describe.skipIf(!hasPython)('foundation lessons in real Python', () => {
  it.each(FOUNDATION_LESSON_DRAFTS.map((draft) => [draft.id] as const))('%s: the starter fails and the intended fix meets the goal', (id) => {
    const lesson = getLesson(id)
    const solution = solutionFor(id)
    expect(BLANK_ANSWERS[id], id).toBeDefined()
    expect(lesson.code.split(BLANK).length - 1, id).toBe(solution.blanks.length)

    expect(run(lesson.code).ok, `${id} starter should not run`).toBe(false)

    const solved = solve(lesson.code, solution)
    const { ok, events, stderr } = run(solved)
    const printed = events.map((e) => (e.kind === 'print' ? e.text : '')).join('\n')
    expect(ok, `${id} solution failed:\n${printed}\n${stderr}`).toBe(true)
    const progress = evaluateGoal(lesson, { code: solved, starterCode: lesson.code, events, status: 'success', executedCode: solved })
    expect(progress.missing, `${id}:\n${printed}`).toEqual([])
    expect(progress.met, id).toBe(true)
  })
})

describe('beginner path', () => {
  it('numbers the track in path order and keeps each starter header in step', () => {
    const track = lessonsForDifficulty('beginner')
    expect(track.map((lesson) => lesson.id)).toEqual(BEGINNER_PATH.flatMap(({ ids }) => ids))
    for (const lesson of track) {
      const header = /^# Lesson (\d+) — /.exec(lesson.code)
      if (header) expect(Number(header[1]), lesson.id).toBe(lesson.number)
    }
  })
})
