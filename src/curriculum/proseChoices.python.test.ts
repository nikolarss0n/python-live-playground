import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { blankHints } from '../blankHints'
import { getLesson, type Lesson } from '../examples'
import type { ResultEvent } from '../execution/protocol'
import { BLANK, codeContains, evaluateGoal } from '../goalCheck'
import { buildGoalRequest } from '../jev/goalJudge'

const solutions: Readonly<Record<string, readonly string[]>> = {
  "mid-java-concurrency-bridge": [
    "\"visibility, not compound-operation atomicity\"",
    "worker_count",
    "\"wait\""
  ],
  "mid-tdd-delivery": [
    "isalnum",
    "\"green\"",
    "\"security scan\"",
    "\"mitigate user impact\""
  ],
  "mid-corrections-gotchas": [
    "\"insertion-ordered in modern Python; OrderedDict still has specialized APIs\"",
    "\"average O(1), not an unconditional worst-case guarantee\"",
    "\"learns statistical representations and uses context\""
  ],
  "ai-transformer-block": [
    "len(rows[0])",
    "len(vector)",
    "merged[i][d]",
    "\"one new token sequentially\""
  ],
  "ai-markov-chains": [
    "TRANSITIONS[current]",
    "\"random surfer with damping\"",
    "\"attention over the context window\"",
    "0.85"
  ],
  "ai-data-science-workflow": [
    "\"vectorized array math\"",
    "\"labeled tabular exploration\"",
    "\"fit transform predict pipelines\"",
    "seen",
    "len(observed) // 2"
  ],
  "ai-boosting-decisions": [
    "\"sequential residual-correcting trees reduce bias\"",
    "\"LightGBM\"",
    "\"XGBoost\"",
    "patience",
    "\"SHAP values\""
  ],
  "ai-frameworks-bias-variance": [
    "\"underfit\"",
    "gap",
    "\"nn.Module + explicit loop\"",
    "\"Conv\"",
    "\"LSTM or attention\"",
    "\"early stopping\""
  ],
  "ai-optimization-quantization": [
    "repeated_request",
    "repeated_prefix",
    "100_000_000",
    "\"train adapters over a quantized base\"",
    "4"
  ],
  "ai-semantic-layer": [
    "\"formal relationships and constraints\"",
    "\"fibo:hasIssuer\"",
    "REQUIRED - present",
    "\"semantic\""
  ],
  "ai-tool-results-repair": [
    "ARG_SCHEMA[\"required\"]",
    "\"temp\"",
    "repaired[\"temperature\"]",
    "\"tool call\""
  ],
  "ai-llm-threat-scenarios": [
    "document[\"tenant\"] == tenant",
    "\"human review required\"",
    "False"
  ],
  "ai-finetuning-techniques": [
    "\"SFT with LoRA/PEFT\"",
    "\"train from scratch\"",
    "2 * rank * hidden * layers",
    "\"fine-tuned + RAG\"",
    "\"adapters over a quantized frozen base\""
  ],
  "ai-feature-engineering-deep-dive": [
    "row[\"price\"] * row[\"volume\"]",
    "row[\"price\"] / row[\"earnings\"]",
    "row[\"previous_price\"]",
    "train",
    "\"forward time split\"",
    "\"stratified k-fold\"",
    "total_variance"
  ]
}

function choicesFor(lesson: Lesson): { index: number; options: string[] }[] {
  return [...lesson.code.matchAll(/^[ \t]*# Pick one:\n((?:[ \t]*#   [^\n]+\n)+)[^\n]*\?\?\?/gm)].map((match) => {
    const options = match[1].trimEnd().split('\n').map((line) => {
      const parsed: unknown = JSON.parse(line.replace(/^[ \t]*#   /, ''))
      if (typeof parsed !== 'string') throw new Error(`Invalid candidate in ${lesson.id}`)
      return parsed
    })
    const index = lesson.code.slice(0, match.index).split(BLANK).length - 1
    return { index, options }
  })
}

function runAndCheck(lesson: Lesson, answers: readonly string[]) {
  let index = 0
  const code = lesson.code.replace(/\?\?\?/g, () => {
    const answer = answers[index++]
    if (answer === undefined) throw new Error(`Missing answer in ${lesson.id}`)
    return answer
  })
  expect(index, lesson.id).toBe(answers.length)
  const run = spawnSync('python3', ['-I', '-c', code], { encoding: 'utf8', timeout: 5000 })
  expect(run.error, lesson.id).toBeUndefined()
  expect(run.status, `${lesson.id}: ${run.stderr}`).toBe(0)
  const events: ResultEvent[] = run.stdout.split('\n').filter(Boolean).map((text) => ({ kind: 'print', text }))
  return evaluateGoal(lesson, {
    code,
    starterCode: lesson.code,
    executedCode: code,
    status: 'success',
    events,
  })
}

const cases = Object.entries(solutions).map(([id, answers]) => ({ id, answers, lesson: getLesson(id) }))
const wrongPicks = cases.flatMap(({ id, lesson, answers }) =>
  choicesFor(lesson).flatMap(({ index, options }) => options
    .filter((option) => JSON.stringify(option) !== answers[index])
    .map((wrong) => ({ id, lesson, answers, index, wrong }))),
)
const hasPython = spawnSync('python3', ['--version']).status === 0

describe('prose blank candidates', () => {
  it('maps each corrections task and its judging prompt to one editable entry in order', () => {
    const lesson = getLesson('mid-corrections-gotchas')
    const keys = [...lesson.code.matchAll(/^\s*"([^"]+)": \?\?\?,?$/gm)].map((match) => match[1])
    expect(keys).toEqual(['dict_order', 'hashset_lookup', 'llm_wording'])
    expect(lesson.tasks).toHaveLength(keys.length)
    const requirements = lesson.tasks.map((text, index) => ({
      id: `task${index + 1}`, text, detail: lesson.taskInstructions?.[index],
    }))
    const request = buildGoalRequest({
      lessonGoal: lesson.goal, requirements,
      code: lesson.code, starterCode: lesson.code, output: [],
    })
    keys.forEach((key, index) => {
      expect(lesson.tasks[index]).toContain(key)
      expect(lesson.taskInstructions?.[index]).toContain(key)
      const question = request.questions[`task${index + 1}`]
      expect(question.instructions).toContain(key)
      expect(question.instructions).not.toMatch(/python_gc|java_finalize|dead_link/)
    })
    expect(request.state.lessonGoal).not.toMatch(/lifecycle|garbage|finaliz|dead.link/i)
    expect(blankHints(lesson, lesson.code).map((hint) => hint.steps[1]?.text))
      .toEqual(lesson.tasks.map((task) => `Task: ${task}`))
  })

  it('covers the 14 lessons and both wrong choices for all 27 phrase blanks', () => {
    expect(cases).toHaveLength(14)
    expect(wrongPicks).toHaveLength(54)
  })

  it.each(cases)('$id keeps three choices beside each prose blank without satisfying codeIncludes', ({ id, lesson, answers }) => {
    expect(lesson.id).toBe(id)
    expect(lesson.code.split(BLANK).length - 1).toBe(answers.length)
    expect(lesson.code).not.toContain('# Choices:')
    for (const line of lesson.code.matchAll(/^[ \t]*#   ".+"$/gm)) {
      expect(line[0].length, `${id}: candidate should fit on one line`).toBeLessThanOrEqual(100)
    }
    const choices = choicesFor(lesson)
    expect(choices.length).toBeGreaterThan(0)
    for (const { index, options } of choices) {
      expect(options).toHaveLength(3)
      expect(new Set(options).size).toBe(3)
      const answer = answers[index]
      if (answer === undefined) throw new Error(`No phrase answer in ${id}`)
      expect(options.map((option) => JSON.stringify(option))).toContain(answer)
      expect(codeContains(lesson.code, answer), `${id}: a comment must not complete a blank`).toBe(false)
    }
  })
})

describe.skipIf(!hasPython)('prose choices in real Python', () => {
  it.each(cases)('$id accepts its complete solution', ({ lesson, answers }) => {
    expect(runAndCheck(lesson, answers)).toEqual({ met: true, missing: [] })
  })

  it.each(wrongPicks)('$id blank $index rejects "$wrong" despite the correct phrase in a comment', ({ lesson, answers, index, wrong }) => {
    const wrongAnswers = answers.map((answer, position) => position === index ? JSON.stringify(wrong) : answer)
    expect(runAndCheck(lesson, wrongAnswers).met).toBe(false)
  })
})
