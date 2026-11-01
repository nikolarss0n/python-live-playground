// Live check of Jev goal judging on lesson tasks. Run with `npm run verify:jev-goal` (needs TYPESAFE_API_KEY in .env.local).
import { readFileSync } from 'node:fs'
import { forwardJev } from '../src/jev/forward.ts'
import { askJevGoal, type GoalRequirement } from '../src/jev/goalJudge.ts'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
  .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter((match) => match !== null).map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')]))
const apiKey = env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? ''
if (!apiKey) { console.error('TYPESAFE_API_KEY is not set in .env.local'); process.exit(1) }

const fetchImpl = (async (_url: string, init: RequestInit) => {
  const result = await forwardJev(String(init.body), { apiKey, model: env.TYPESAFE_MODEL ?? 'jev-latest' })
  return new Response(result.body, { status: result.status, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

const PRINTING_GOAL = 'Make Python show two messages that you chose yourself.'
const PRINTING_STARTER = 'print("Hello, world!")\nprint(???)\n'
const PRINTING: GoalRequirement[] = [
  { id: 'task1', text: 'Change the first print so it greets you by name' },
  { id: 'task2', text: 'Fill in the second print (replace ???)' },
  { id: 'goal', text: PRINTING_GOAL },
]
const LOOP_GOAL = 'Print the numbers 1 to 5, one per line, with a for loop.'
const LOOP: GoalRequirement[] = [
  { id: 'task1', text: 'Use range so the loop starts at 1 and ends at 5' },
  { id: 'goal', text: LOOP_GOAL },
]

const IF_GOAL = 'Make the program print "Passed" for your score.'
const IF_STARTER = 'score = ???\n\nif score >= 90:\n    print("Excellent")\nelif score >= 60:\n    print("Passed")\nelse:\n    print("Try again")\n'
const IF: GoalRequirement[] = [
  { id: 'task1', text: 'Set score so the Passed branch runs (60–89)' },
  { id: 'task2', text: 'Then change score to 90 or more so it prints Excellent' },
  { id: 'goal', text: IF_GOAL },
]
const ifCode = (score: number) => IF_STARTER.replace('???', String(score))

type Case = { name: string; goal: string; starter: string; requirements: GoalRequirement[]; code: string; output: string[]; expect: Record<string, boolean> }
const CASES: Case[] = [
  { name: 'first print unchanged', goal: PRINTING_GOAL, starter: PRINTING_STARTER, requirements: PRINTING,
    code: 'print("Hello, world!")\nprint(\'I am master\')\n', output: ['Hello, world!', 'I am master'], expect: { task1: false, task2: true, goal: false } },
  { name: 'both done', goal: PRINTING_GOAL, starter: PRINTING_STARTER, requirements: PRINTING,
    code: 'print("Hello, Nikolay!")\nprint("I am learning Python")\n', output: ['Hello, Nikolay!', 'I am learning Python'], expect: { task1: true, task2: true, goal: true } },
  { name: 'greeting without a name', goal: PRINTING_GOAL, starter: PRINTING_STARTER, requirements: PRINTING,
    code: 'print("Hi there")\nprint("Python is fun")\n', output: ['Hi there', 'Python is fun'], expect: { task1: false, task2: true, goal: true } },
  { name: 'loop off by one', goal: LOOP_GOAL, starter: 'for n in range(???):\n    print(n)\n', requirements: LOOP,
    code: 'for n in range(1, 5):\n    print(n)\n', output: ['1', '2', '3', '4'], expect: { task1: false, goal: false } },
  { name: 'loop correct', goal: LOOP_GOAL, starter: 'for n in range(???):\n    print(n)\n', requirements: LOOP,
    code: 'for n in range(1, 6):\n    print(n)\n', output: ['1', '2', '3', '4', '5'], expect: { task1: true, goal: true } },
  { name: 'hard-coded prints instead of a loop', goal: LOOP_GOAL, starter: 'for n in range(???):\n    print(n)\n', requirements: LOOP,
    code: 'print(1)\nprint(2)\nprint(3)\nprint(4)\nprint(5)\n', output: ['1', '2', '3', '4', '5'], expect: { task1: false, goal: false } },
  { name: 'if: passed score', goal: IF_GOAL, starter: IF_STARTER, requirements: IF,
    code: ifCode(75), output: ['Passed'], expect: { task1: true, task2: false, goal: true } },
  { name: 'if: excellent score', goal: IF_GOAL, starter: IF_STARTER, requirements: IF,
    code: ifCode(95), output: ['Excellent'], expect: { task1: false, task2: true, goal: false } },
]

let passed = 0
let total = 0
for (const item of CASES) {
  const result = await askJevGoal({ lessonGoal: item.goal, requirements: item.requirements, code: item.code, starterCode: item.starter, output: item.output }, { fetchImpl })
  if (!result.ok) { console.log(`FAIL ${item.name}: ${result.error}`); total += Object.keys(item.expect).length; continue }
  for (const judgement of result.judgements) {
    total += 1
    const ok = judgement.met === item.expect[judgement.id]
    if (ok) passed += 1
    console.log(`${ok ? 'PASS' : 'MISS'} ${item.name} / ${judgement.id}: ${judgement.verdict} (${judgement.confidence.toFixed(2)})`)
  }
  console.log(`  ${result.durationMs}ms`)
}
console.log(`\n${passed}/${total} judged as expected`)
process.exit(passed === total ? 0 : 1)
