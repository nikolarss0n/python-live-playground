import { describe, expect, it } from 'vitest'
import {
  httpResponseFromHttpEvent,
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
    expect(view?.bodyPreview).toBe('{\n  "error": "missing"\n}')
  })

  it('reads method, path, and simulated from TestClient print dicts', () => {
    const node: CollectionNode = {
      kind: 'dict',
      length: 5,
      entries: [
        {
          key: { kind: 'atom', type: 'str', preview: "'method'" },
          value: { kind: 'atom', type: 'str', preview: "'POST'" },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'path'" },
          value: { kind: 'atom', type: 'str', preview: "'/users'" },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'status'" },
          value: { kind: 'atom', type: 'int', preview: '201' },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'body'" },
          value: {
            kind: 'dict',
            length: 1,
            entries: [
              {
                key: { kind: 'atom', type: 'str', preview: "'name'" },
                value: { kind: 'atom', type: 'str', preview: "'Ada'" },
              },
            ],
          },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'simulated'" },
          value: { kind: 'atom', type: 'bool', preview: 'True' },
        },
      ],
    }
    const view = httpResponseFromStructure(node)
    expect(view?.status).toBe(201)
    expect(view?.method).toBe('POST')
    expect(view?.path).toBe('/users')
    expect(view?.simulated).toBe(true)
    expect(view?.bodyPreview).toContain('Ada')
  })

  it('shows nested list items in the body preview', () => {
    const node: CollectionNode = {
      kind: 'dict',
      length: 2,
      entries: [
        {
          key: { kind: 'atom', type: 'str', preview: "'status'" },
          value: { kind: 'atom', type: 'int', preview: '201' },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'body'" },
          value: {
            kind: 'dict',
            length: 3,
            entries: [
              {
                key: { kind: 'atom', type: 'str', preview: "'id'" },
                value: { kind: 'atom', type: 'int', preview: '1' },
              },
              {
                key: { kind: 'atom', type: 'str', preview: "'name'" },
                value: { kind: 'atom', type: 'str', preview: "'Ada'" },
              },
              {
                key: { kind: 'atom', type: 'str', preview: "'tags'" },
                value: {
                  kind: 'list',
                  length: 1,
                  items: [
                    { kind: 'atom', type: 'str', preview: "'admin'" },
                  ],
                },
              },
            ],
          },
        },
      ],
    }
    const view = httpResponseFromStructure(node)
    expect(view?.bodyPreview).toBe(
      '{\n  "id": 1,\n  "name": "Ada",\n  "tags": [\n    "admin"\n  ]\n}',
    )
  })

  it('shows FastAPI loc paths instead of list(n)', () => {
    const node: CollectionNode = {
      kind: 'dict',
      length: 2,
      entries: [
        {
          key: { kind: 'atom', type: 'str', preview: "'status'" },
          value: { kind: 'atom', type: 'int', preview: '422' },
        },
        {
          key: { kind: 'atom', type: 'str', preview: "'body'" },
          value: {
            kind: 'dict',
            length: 1,
            entries: [
              {
                key: { kind: 'atom', type: 'str', preview: "'detail'" },
                value: {
                  kind: 'list',
                  length: 1,
                  items: [
                    {
                      kind: 'dict',
                      length: 3,
                      entries: [
                        {
                          key: { kind: 'atom', type: 'str', preview: "'loc'" },
                          value: {
                            kind: 'list',
                            length: 2,
                            items: [
                              {
                                kind: 'atom',
                                type: 'str',
                                preview: "'body'",
                              },
                              {
                                kind: 'atom',
                                type: 'str',
                                preview: "'name'",
                              },
                            ],
                          },
                        },
                        {
                          key: { kind: 'atom', type: 'str', preview: "'msg'" },
                          value: {
                            kind: 'atom',
                            type: 'str',
                            preview: "'field required'",
                          },
                        },
                        {
                          key: { kind: 'atom', type: 'str', preview: "'type'" },
                          value: {
                            kind: 'atom',
                            type: 'str',
                            preview: "'missing'",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    }
    const view = httpResponseFromStructure(node)
    expect(view?.bodyPreview).toContain('"loc"')
    expect(view?.bodyPreview).toContain('"body"')
    expect(view?.bodyPreview).toContain('"name"')
    expect(view?.bodyPreview).not.toMatch(/list\(/)
  })

  it('parses printed repr fallback', () => {
    const view = httpResponseFromText(
      "{'status': 200, 'body': {'ok': True}}",
    )
    expect(view?.status).toBe(200)
    expect(view?.statusLabel).toBe('OK')
  })

  it('builds a simulated Call card from a worker http event', () => {
    const view = httpResponseFromHttpEvent({
      method: 'GET',
      path: '/hello',
      status: 200,
      body: '{"message":"hi"}',
      simulated: true,
    })
    expect(view.status).toBe(200)
    expect(view.statusLabel).toBe('OK')
    expect(view.method).toBe('GET')
    expect(view.path).toBe('/hello')
    expect(view.bodyPreview).toBe('{\n  "message": "hi"\n}')
    expect(view.simulated).toBe(true)
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
