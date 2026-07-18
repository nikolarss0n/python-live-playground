import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot } from './shareSnapshot'

describe('shareSnapshot', () => {
  it('round-trips a lesson payload', () => {
    const payload = {
      v: 1 as const,
      lessonId: 'printing',
      difficulty: 'beginner' as const,
      code: 'print("hi")\n',
    }
    const encoded = encodeSnapshot(payload)
    expect(encoded.startsWith('plp=')).toBe(true)
    expect(decodeSnapshot(encoded)).toEqual(payload)
    expect(decodeSnapshot('#' + encoded)).toEqual(payload)
  })

  it('rejects garbage', () => {
    expect(decodeSnapshot('nope')).toBeNull()
    expect(decodeSnapshot('plp=%%%')).toBeNull()
  })
})
