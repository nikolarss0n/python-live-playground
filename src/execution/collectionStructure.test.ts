import { describe, expect, it } from 'vitest'
import {
  collectionLabel,
  collectionSummary,
  isCollectionRoot,
  parseCollectionNode,
  type CollectionNode,
} from './collectionStructure'

const sampleList: CollectionNode = {
  kind: 'list',
  length: 3,
  items: [
    { kind: 'atom', type: 'int', preview: '1' },
    { kind: 'atom', type: 'int', preview: '2' },
    { kind: 'atom', type: 'str', preview: "'x'" },
  ],
}

const sampleDict: CollectionNode = {
  kind: 'dict',
  length: 2,
  entries: [
    {
      key: { kind: 'atom', type: 'str', preview: "'name'" },
      value: { kind: 'atom', type: 'str', preview: "'Ada'" },
    },
    {
      key: { kind: 'atom', type: 'str', preview: "'n'" },
      value: {
        kind: 'list',
        length: 2,
        items: [
          { kind: 'atom', type: 'int', preview: '1' },
          { kind: 'atom', type: 'int', preview: '2' },
        ],
      },
    },
  ],
}

describe('collectionStructure helpers', () => {
  it('detects expandable roots vs atoms', () => {
    expect(isCollectionRoot(sampleList)).toBe(true)
    expect(isCollectionRoot(sampleDict)).toBe(true)
    expect(
      isCollectionRoot({ kind: 'atom', type: 'int', preview: '1' }),
    ).toBe(false)
    expect(isCollectionRoot(undefined)).toBe(false)
  })

  it('labels collections with kind and length', () => {
    expect(collectionLabel(sampleList)).toBe('list(3)')
    expect(collectionLabel(sampleDict)).toBe('dict(2)')
    expect(
      collectionLabel({ kind: 'set', length: 0, items: [] }),
    ).toBe('set(0)')
  })

  it('builds a quiet one-line summary when collapsed', () => {
    expect(collectionSummary(sampleList)).toBe("[1, 2, 'x']")
    expect(collectionSummary(sampleDict)).toContain("'name'")
    expect(collectionSummary({ kind: 'list', length: 0, items: [] })).toBe(
      '[]',
    )
  })

  it('parses worker-shaped JSON into nodes', () => {
    const parsed = parseCollectionNode(sampleDict)
    expect(parsed?.kind).toBe('dict')
    if (parsed?.kind === 'dict') {
      expect(parsed.entries).toHaveLength(2)
      expect(parsed.entries[1]?.value.kind).toBe('list')
    }
  })

  it('rejects malformed structure payloads', () => {
    expect(parseCollectionNode(null)).toBeNull()
    expect(parseCollectionNode({ kind: 'list' })).toBeNull()
    expect(parseCollectionNode({ kind: 'atom', type: 'int' })).toBeNull()
  })
})
