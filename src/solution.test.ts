import { describe, expect, it } from 'vitest'
import { solutionParts } from './solution'

describe('solutionParts', () => {
  it('fills each blank in order and marks the filled parts', () => {
    expect(solutionParts('a = ???\nb = ???\n', ['1', '2'])).toEqual([
      { text: 'a = ', filled: false },
      { text: '1', filled: true },
      { text: '\nb = ', filled: false },
      { text: '2', filled: true },
      { text: '\n', filled: false },
    ])
  })
})
