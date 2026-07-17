import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_TIMEOUT_MS,
  type ResultEvent,
  type WorkerInboundMessage,
  type WorkerOutboundMessage,
} from './protocol'

describe('execution protocol constants', () => {
  it('uses a short debounce for live feedback', () => {
    expect(DEFAULT_DEBOUNCE_MS).toBeGreaterThanOrEqual(250)
    expect(DEFAULT_DEBOUNCE_MS).toBeLessThanOrEqual(800)
  })

  it('caps runaway code with a multi-second timeout', () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(3000)
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(15000)
  })
})

describe('result event shapes', () => {
  it('supports print, expression, error, and warning events', () => {
    const events: ResultEvent[] = [
      { kind: 'print', text: 'hi', line: 1 },
      { kind: 'expr', value: '4', line: 2 },
      {
        kind: 'error',
        message: 'ZeroDivisionError: division by zero',
        friendly: 'Division by zero is not allowed.',
        traceback: 'Traceback…',
        line: 3,
      },
      { kind: 'warning', text: 'DeprecationWarning: …' },
    ]
    expect(events).toHaveLength(4)
    expect(events.every((e) => typeof e.kind === 'string')).toBe(true)
  })
})

describe('worker messages', () => {
  it('types inbound run messages', () => {
    const msg: WorkerInboundMessage = {
      type: 'run',
      id: 'run-1',
      code: 'print(1)',
    }
    expect(msg.type).toBe('run')
  })

  it('types outbound result messages', () => {
    const msg: WorkerOutboundMessage = {
      type: 'result',
      id: 'run-1',
      events: [{ kind: 'print', text: '1' }],
      durationMs: 12,
    }
    expect(msg.events[0]?.kind).toBe('print')
  })
})
