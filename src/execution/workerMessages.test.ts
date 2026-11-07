import { describe, expect, it } from 'vitest'
import { readResultEvent, readWorkerMessage } from './workerMessages'

describe('worker message validation', () => {
  it('passes well-formed results through unchanged', () => {
    const message = {
      type: 'result', id: 'run-1', durationMs: 4,
      events: [
        { kind: 'print', text: 'hi', line: 1, structure: { kind: 'list', length: 1, items: [{ kind: 'atom', type: 'int', preview: '1' }] } },
        { kind: 'error', message: 'ZeroDivisionError: x', friendly: 'f', traceback: 't', line: 2, frames: [{ line: 2, name: '<module>', column: null }] },
        { kind: 'http', method: 'GET', path: '/', status: 200, body: '{}', simulated: true },
      ],
      routes: [{ method: 'GET', path: '/' }],
      checks: [{ id: 'a', label: 'A', passed: true, detail: '' }],
      fullstack: { tables: [{ name: 't', count: 1, columns: [{ name: 'id', type: 'INTEGER' }], rows: [[1]] }], calls: [{ method: 'GET', path: '/', status: 200, body: { ok: true } }] },
    }
    expect(readWorkerMessage(message)).toEqual(message)
  })

  it('drops events Python could forge to crash the page', () => {
    const result = readWorkerMessage({
      type: 'result', id: 'run-1', durationMs: 1,
      events: [{ kind: 'print', text: { x: 1 } }, { kind: 'print', text: 'ok' }, null, 'text', { kind: 'html', text: '<b>' }],
    })
    expect(result).toEqual({ type: 'result', id: 'run-1', durationMs: 1, events: [{ kind: 'print', text: 'ok' }] })
  })

  it('strips a forged explanation so the main thread rebuilds it', () => {
    expect(readResultEvent({ kind: 'error', message: 'm', friendly: 'f', traceback: 't', explanation: { title: 1 } })).toEqual({ kind: 'error', message: 'm', friendly: 'f', traceback: 't' })
  })

  it('keeps the text but drops a malformed or runaway structure', () => {
    let deep: unknown = { kind: 'atom', type: 'int', preview: '1' }
    for (let i = 0; i < 100; i += 1) deep = { kind: 'list', length: 1, items: [deep] }
    expect(readResultEvent({ kind: 'print', text: 'x', structure: deep })).toEqual({ kind: 'print', text: 'x' })
    expect(readResultEvent({ kind: 'expr', value: '1', line: 1, structure: { kind: 'dict', length: 1, entries: [{ key: 1 }] } })).toEqual({ kind: 'expr', value: '1', line: 1 })
  })

  it('rejects unknown message types and non-string ids', () => {
    expect(readWorkerMessage({ type: 'result', id: 5, events: [] })).toBeNull()
    expect(readWorkerMessage({ type: 'navigate', url: 'https://example.com' })).toBeNull()
    expect(readWorkerMessage('ready')).toBeNull()
    expect(readWorkerMessage({ type: 'failed', id: 'init', error: { a: 1 } })).toEqual({ type: 'failed', id: 'init', error: 'Python failed.' })
  })

  it('shares one structure budget across all events in a message', () => {
    const wide = { kind: 'list', length: 15_000, items: Array.from({ length: 15_000 }, () => ({ kind: 'atom', type: 'int', preview: '1' })) }
    const result = readWorkerMessage({ type: 'result', id: 'r', durationMs: 1, events: [1, 2, 3].map(() => ({ kind: 'print', text: 'x', structure: wide })) })
    if (result?.type !== 'result') throw new Error('expected a result')
    expect(result.events).toHaveLength(3)
    expect(result.events.filter((event) => 'structure' in event)).toHaveLength(1)
  })

  it('caps full-stack tables, rows and calls and replaces oversized bodies', () => {
    const rows = Array.from({ length: 2_000 }, (_, i) => [i, 'extra'])
    const result = readWorkerMessage({
      type: 'result', id: 'r', durationMs: 1, events: [],
      fullstack: {
        tables: Array.from({ length: 80 }, (_, i) => ({ name: `t${i}`, count: 2_000, columns: [{ name: 'id', type: 'INTEGER' }], rows })),
        calls: Array.from({ length: 900 }, () => ({ method: 'GET', path: '/', status: 200, body: 'x'.repeat(200_000) })),
      },
    })
    if (result?.type !== 'result' || !result.fullstack) throw new Error('expected full-stack data')
    expect(result.fullstack.tables).toHaveLength(50)
    expect(result.fullstack.tables[0]?.rows).toHaveLength(500)
    expect(result.fullstack.tables[0]?.rows[0]).toEqual([0])
    expect(result.fullstack.calls).toHaveLength(500)
    expect(result.fullstack.calls[0]?.body).toBe('[response body too large to show]')
  })

  it('shows an expression without a line as plain output instead of losing it', () => {
    expect(readResultEvent({ kind: 'expr', value: '42' })).toEqual({ kind: 'print', text: '42' })
    expect(readResultEvent({ kind: 'expr', value: '42', line: 3 })).toEqual({ kind: 'expr', value: '42', line: 3 })
    expect(readResultEvent({ kind: 'expr', value: 42 })).toBeNull()
  })
})
