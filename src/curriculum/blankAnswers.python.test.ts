import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { getLesson } from '../examples'
import { BLANK } from '../goalCheck'
import { BLANK_ANSWERS } from './blankAnswers'
import { ALGORITHM_PRACTICE_LESSON_DRAFTS } from './algorithmPracticeLessons'
import { FASTAPI_ESSENTIALS_LESSON_DRAFTS } from './fastapiEssentialsLessons'
import { FASTAPI_LADDER_LESSON_DRAFTS } from './fastapiLadderLessons'
import { FOUNDATION_LESSON_DRAFTS } from './foundationLessons'
import { FULLSTACK_LESSON_DRAFTS } from './fullstackLessons'
import { HARNESS_LESSON_DRAFTS } from './harnessInterviewLessons'
import { INTERVIEW_PATTERN_LESSON_DRAFTS } from './interviewPatternLessons'
import { SUPPORT_AUTOMATION_LESSON_DRAFTS } from './supportAutomationLessons'

const coveredElsewhere = new Set(
  [...ALGORITHM_PRACTICE_LESSON_DRAFTS, ...FASTAPI_ESSENTIALS_LESSON_DRAFTS, ...FASTAPI_LADDER_LESSON_DRAFTS, ...FOUNDATION_LESSON_DRAFTS, ...FULLSTACK_LESSON_DRAFTS, ...HARNESS_LESSON_DRAFTS, ...INTERVIEW_PATTERN_LESSON_DRAFTS, ...SUPPORT_AUTOMATION_LESSON_DRAFTS].map((draft) => draft.id),
)
const hasPython = spawnSync('python3', ['--version']).status === 0

describe('blank answers', () => {
  it.each(Object.keys(BLANK_ANSWERS).map((id) => [id] as const))('%s has one answer per blank', (id) => {
    const lesson = getLesson(id)
    expect(lesson.id).toBe(id)
    expect(lesson.code.split(BLANK).length - 1).toBe(BLANK_ANSWERS[id].length)
  })
})

describe.skipIf(!hasPython)('blank answers in real Python', () => {
  const ids = Object.keys(BLANK_ANSWERS).filter((id) => !coveredElsewhere.has(id))
  it.each(ids.map((id) => [id] as const))('%s: the filled starter runs', (id) => {
    let index = 0
    const filled = getLesson(id).code.replace(/\?\?\?/g, () => BLANK_ANSWERS[id][index++])
    const result = spawnSync('python3', ['-I', '-c', filled], { encoding: 'utf8', timeout: 5000 })
    expect(result.status, `${id}:\n${result.stderr}`).toBe(0)
  })
})
