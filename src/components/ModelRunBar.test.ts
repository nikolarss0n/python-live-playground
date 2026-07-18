import { describe, expect, it } from 'vitest'
import { pickPromptFromEvents } from './ModelRunBar'
import type { ResultEvent } from '../execution/protocol'

describe('pickPromptFromEvents', () => {
  it('picks the longest print as the prompt', () => {
    const events: ResultEvent[] = [
      { kind: 'print', text: 'hi', line: 1 },
      {
        kind: 'print',
        text: 'You are a tutor.\n\nStudent: Ada\nTask: lists',
        line: 2,
      },
      { kind: 'expr', value: '4', line: 3 },
    ]
    const p = pickPromptFromEvents(events)
    expect(p).toContain('Student: Ada')
  })

  it('returns null when no useful prints', () => {
    expect(pickPromptFromEvents([])).toBeNull()
    expect(
      pickPromptFromEvents([{ kind: 'print', text: 'x', line: 1 }]),
    ).toBeNull()
  })
})
