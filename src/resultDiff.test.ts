import { describe, expect, it } from 'vitest'
import { eventFingerprint, updatedEventIndices } from './resultDiff'
import type { ResultEvent } from './execution/protocol'

const a: ResultEvent = { kind: 'print', text: 'hi', line: 1 }
const b: ResultEvent = { kind: 'print', text: 'yo', line: 1 }
const c: ResultEvent = { kind: 'expr', value: '4', line: 2 }

describe('resultDiff', () => {
  it('fingerprints by kind, line, and content', () => {
    expect(eventFingerprint(a)).not.toBe(eventFingerprint(b))
    expect(eventFingerprint(a)).toBe(eventFingerprint({ ...a }))
  })

  it('marks only new or changed rows', () => {
    const updated = updatedEventIndices([a, b, c], [a, c])
    expect([...updated]).toEqual([1])
  })

  it('marks nothing without a previous run', () => {
    expect(updatedEventIndices([a, b], null).size).toBe(0)
    expect(updatedEventIndices([a], []).size).toBe(0)
  })
})
