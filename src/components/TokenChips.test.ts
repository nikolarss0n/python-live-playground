import { describe, expect, it } from 'vitest'
import { looksLikeTokenList } from './TokenChips'
import type { CollectionNode } from '../execution/collectionStructure'

const tokens: CollectionNode = {
  kind: 'list',
  length: 3,
  items: [
    { kind: 'atom', type: 'str', preview: "'hello'" },
    { kind: 'atom', type: 'str', preview: "'world'" },
    { kind: 'atom', type: 'str', preview: "'python'" },
  ],
}

describe('looksLikeTokenList', () => {
  it('accepts short string lists', () => {
    expect(looksLikeTokenList(tokens)).toBe(true)
  })

  it('rejects mixed or nested collections', () => {
    expect(
      looksLikeTokenList({
        kind: 'list',
        length: 1,
        items: [
          {
            kind: 'list',
            length: 0,
            items: [],
          },
        ],
      }),
    ).toBe(false)
    expect(
      looksLikeTokenList({
        kind: 'dict',
        length: 1,
        entries: [
          {
            key: { kind: 'atom', type: 'str', preview: "'a'" },
            value: { kind: 'atom', type: 'int', preview: '1' },
          },
        ],
      }),
    ).toBe(false)
  })
})
