import { describe, expect, it, vi } from 'vitest'
import { getLesson } from './examples'
import {
  askLessonCoach,
  buildCoachMessages,
  buildLessonContextPack,
} from './lessonCoach'
import type { LessonProgressView } from './lessonProgress'

describe('lessonCoach', () => {
  it('builds a compact structured context pack', () => {
    const lesson = getLesson('printing')
    const view: LessonProgressView = {
      tasks: lesson.tasks.map((text, i) => ({
        text,
        instruction: lesson.taskInstructions?.[i] ?? null,
        status: i === 0 ? 'todo' : 'todo',
      })),
      next: 'Run your code',
      extraHint: null,
      showStuckControl: false,
      allTasksDone: false,
      goalMet: false,
    }
    const pack = buildLessonContextPack({
      lesson,
      code: lesson.code,
      progress: { met: false, missing: ['Replace every ??? with real code'] },
      view,
      events: [
        { kind: 'print', text: 'Hello, world!', line: 3 },
        { kind: 'print', text: '4', line: 4 },
      ],
    })
    expect(pack).toContain('track: beginner')
    expect(pack).toContain('topic: Printing')
    expect(pack).toContain('goal:')
    expect(pack).toContain('tasks:')
    expect(pack).toContain('code:')
    expect(pack).toContain('results:')
    expect(pack).toContain('Hello, world!')
    expect(pack.length).toBeLessThan(4000)
  })

  it('puts CONTEXT only in system and keeps history short', () => {
    const messages = buildCoachMessages({
      contextPack: 'goal: print a greeting',
      history: [
        { role: 'user', text: 'What is ???' },
        { role: 'assistant', text: 'A blank to fill.' },
      ],
      question: 'Where do I put my name?',
    })
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('CONTEXT:')
    expect(messages[0]?.content).toContain('goal: print a greeting')
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: 'Where do I put my name?',
    })
    expect(messages.filter((m) => m.role === 'user')).toHaveLength(2)
  })

  it('asks the model with structured messages', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: 'grok-test',
          choices: [
            {
              message: {
                content: 'Replace the first ??? with your name in quotes.',
              },
            },
          ],
        }),
    })
    const result = await askLessonCoach({
      baseUrl: 'https://api.x.ai/v1',
      apiKey: 'sk-test',
      model: 'grok-test',
      contextPack: 'goal: greet',
      history: [],
      question: 'How do I start?',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toMatch(/Replace/i)
    }
    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as { body: string }).body,
    ) as { max_tokens: number; messages: unknown[] }
    expect(body.max_tokens).toBeLessThanOrEqual(220)
    expect(body.messages.length).toBeGreaterThanOrEqual(2)
  })
})
