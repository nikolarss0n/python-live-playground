/**
 * Compact lesson coach: structured context + short multi-turn chat.
 * Uses the learner’s Settings key (OpenAI-compatible / SpaceXAI).
 */

import type { Lesson } from './examples'
import type { ResultEvent } from './execution/protocol'
import type { GoalProgress } from './goalCheck'
import type { LessonProgressView } from './lessonProgress'
import { chatCompletion, type ChatMessage } from './llmClient'

export type CoachTurn = {
  role: 'user' | 'assistant'
  text: string
}

export type CoachUiMessage = {
  id: string
  role: 'user' | 'assistant' | 'note'
  text: string
}

const SYSTEM = `You are a quiet Python lesson coach inside a live browser playground.
Use only the structured CONTEXT block for this lesson. Stay on-task.
Rules:
- Answer in plain text, max ~80 words unless the learner asks for more.
- Prefer the smallest next edit (especially ??? blanks). Point to lines when useful.
- Do not rewrite their whole program unless they ask.
- If the goal is met, suggest the stretch or moving on — briefly.
- No markdown headings or bullet walls. At most one short code snippet if needed.`

const MAX_CODE = 1400
const MAX_RESULT_LINES = 6
const MAX_RESULT_CHARS = 90
const MAX_HISTORY = 6
const MAX_TOKENS = 220

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const head = Math.floor(max * 0.65)
  const tail = max - head - 5
  return `${t.slice(0, head)}\n…\n${t.slice(-tail)}`
}

function resultLine(event: ResultEvent): string | null {
  if (event.kind === 'print') {
    return clip(event.text.replace(/\s+/g, ' '), MAX_RESULT_CHARS)
  }
  if (event.kind === 'expr') {
    return clip(event.value.replace(/\s+/g, ' '), MAX_RESULT_CHARS)
  }
  if (event.kind === 'error') {
    return `ERROR ${clip(event.message, MAX_RESULT_CHARS)}`
  }
  if (event.kind === 'warning') {
    return `WARN ${clip(event.text, MAX_RESULT_CHARS)}`
  }
  return null
}

/** Compact structured pack for the model (low tokens, high signal). */
export function buildLessonContextPack(input: {
  lesson: Lesson
  code: string
  progress: GoalProgress
  view: LessonProgressView
  events: readonly ResultEvent[]
}): string {
  const { lesson, code, progress, view, events } = input
  const taskLines = view.tasks.map((t) => {
    const mark = t.status === 'done' ? 'x' : ' '
    const how =
      t.status !== 'done' && t.instruction
        ? ` | how: ${clip(t.instruction, 160)}`
        : ''
    return `- [${mark}] ${clip(t.text, 100)}${how}`
  })

  const out: string[] = []
  for (const e of events) {
    const line = resultLine(e)
    if (line) out.push(line)
    if (out.length >= MAX_RESULT_LINES) break
  }

  const parts = [
    `track: ${lesson.difficulty}`,
    `n: ${lesson.number}`,
    `topic: ${lesson.topic}`,
    `chapter: ${lesson.chapter}`,
    `goal: ${clip(lesson.goal, 180)}`,
  ]
  if (lesson.why) parts.push(`why: ${clip(lesson.why, 160)}`)
  parts.push(`goal_met: ${progress.met ? 'yes' : 'no'}`)
  if (!progress.met && progress.missing[0]) {
    parts.push(`missing: ${clip(progress.missing[0], 120)}`)
  }
  if (view.next) parts.push(`next: ${clip(view.next, 120)}`)
  parts.push('tasks:')
  parts.push(...(taskLines.length ? taskLines : ['- (none)']))
  if (lesson.stretch) parts.push(`stretch: ${clip(lesson.stretch, 120)}`)
  parts.push('code:')
  parts.push(clip(code, MAX_CODE) || '(empty)')
  if (out.length) {
    parts.push('results:')
    for (const line of out) parts.push(`- ${line}`)
  }
  return parts.join('\n')
}

export function buildCoachMessages(opts: {
  contextPack: string
  history: readonly CoachTurn[]
  question: string
}): ChatMessage[] {
  const history = opts.history.slice(-MAX_HISTORY).map((t) => ({
    role: t.role,
    content: clip(t.text, 400),
  }))
  return [
    {
      role: 'system',
      content: `${SYSTEM}\n\nCONTEXT:\n${opts.contextPack}`,
    },
    ...history,
    { role: 'user', content: opts.question.trim() },
  ]
}

export async function askLessonCoach(opts: {
  baseUrl: string
  apiKey: string
  model: string
  contextPack: string
  history: readonly CoachTurn[]
  question: string
  fetchImpl?: typeof fetch
}): Promise<
  | { ok: true; text: string; model: string; durationMs: number }
  | { ok: false; error: string; durationMs: number }
> {
  const q = opts.question.trim()
  if (!q) {
    return { ok: false, error: 'Type a short question first.', durationMs: 0 }
  }
  return chatCompletion({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: buildCoachMessages({
      contextPack: opts.contextPack,
      history: opts.history,
      question: q,
    }),
    maxTokens: MAX_TOKENS,
    temperature: 0.3,
    fetchImpl: opts.fetchImpl,
  })
}

let coachId = 0
export function nextCoachId(prefix = 'c'): string {
  coachId += 1
  return `${prefix}-${coachId}`
}
