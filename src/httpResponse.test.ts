import { describe, expect, it } from 'vitest'
import {
  httpResponseFromStructure,
  httpResponseFromText,
} from './httpResponse'
import type { CollectionNode } from './execution/collectionStructure'

const responseNode: CollectionNode = {
  kind: 'dict',
  length: 2,
  entries: [
    {
      key: { kind: 'atom', type: 'str', preview: "'status'" },
      value: { kind: 'atom', type: 'int', preview: '404' },
    },
    {
      key: { kind: 'atom', type: 'str', preview: "'body'" },
      value: {
        kind: 'dict',
        length: 1,
        entries: [
          {
            key: { kind: 'atom', type: 'str', preview: "'error'" },
            value: { kind: 'atom', type: 'str', preview: "'missing'" },
          },
        ],
      },
    },
  ],
}

describe('httpResponse', () => {
  it('detects structured response dicts', () => {
    const view = httpResponseFromStructure(responseNode)
    expect(view?.status).toBe(404)
    expect(view?.statusLabel).toBe('Not Found')
    expect(view?.bodyPreview).toContain('error')
  })

  it('parses printed repr fallback', () => {
    const view = httpResponseFromText(
      "{'status': 200, 'body': {'ok': True}}",
    )
    expect(view?.status).toBe(200)
    expect(view?.statusLabel).toBe('OK')
  })

  it('ignores unrelated dicts', () => {
    expect(httpResponseFromText("{'a': 1}")).toBeNull()
    expect(
      httpResponseFromStructure({
        kind: 'dict',
        length: 1,
        entries: [
          {
            key: { kind: 'atom', type: 'str', preview: "'a'" },
            value: { kind: 'atom', type: 'int', preview: '1' },
          },
        ],
      }),
    ).toBeNull()
  })
})
