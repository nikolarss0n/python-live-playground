import { describe, expect, it } from 'vitest'
import { pickPromptFromEvents, resolveModelPrompt } from './ModelRunBar'
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

describe('resolveModelPrompt', () => {
  it('prefers printed text over fallback', () => {
    const r = resolveModelPrompt(
      [{ kind: 'print', text: 'Printed prompt long enough', line: 1 }],
      'Fallback prompt long enough',
    )
    expect(r?.source).toBe('print')
    expect(r?.text).toContain('Printed')
  })

  it('uses lesson fallback when Results are empty', () => {
    const r = resolveModelPrompt([], 'Default lesson prompt here.')
    expect(r?.source).toBe('fallback')
    expect(r?.text).toContain('Default lesson')
  })
})
