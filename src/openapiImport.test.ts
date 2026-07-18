import { describe, expect, it, vi } from 'vitest'
import {
  fetchOpenApiDocument,
  parseOpenApiDocument,
  pythonSnippetForOperation,
  operationToSample,
} from './openapiImport'

const miniSpec = {
  openapi: '3.1.0',
  paths: {
    '/health': {
      get: { summary: 'Health', operationId: 'health_health_get' },
    },
    '/items/{item_id}': {
      get: { summary: 'Get item', operationId: 'get_item' },
    },
    '/users': {
      post: {
        summary: 'Create user',
        operationId: 'create_user',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  name: { type: 'string', example: 'Ada' },
                },
              },
            },
          },
        },
      },
    },
  },
}

describe('openapiImport', () => {
  it('parses paths into operations with filled path params', () => {
    const ops = parseOpenApiDocument(miniSpec)
    expect(ops.length).toBe(3)
    const item = ops.find((o) => o.pathTemplate.includes('items'))
    expect(item?.path).toBe('/items/a1')
    expect(item?.method).toBe('GET')
    const post = ops.find((o) => o.method === 'POST')
    expect(post?.exampleBody).toMatchObject({ name: 'Ada' })
  })

  it('builds Python request-dict snippets', () => {
    const op = parseOpenApiDocument(miniSpec).find((o) => o.method === 'GET')!
    const snip = pythonSnippetForOperation(op)
    expect(snip).toContain('"method": "GET"')
    expect(snip).toContain('print(request)')
  })

  it('maps operations to Local API samples', () => {
    const op = parseOpenApiDocument(miniSpec).find((o) => o.method === 'POST')!
    const sample = operationToSample(op)
    expect(sample.method).toBe('POST')
    expect(sample.body).toMatchObject({ name: 'Ada' })
  })

  it('fetchOpenApiDocument uses companion openapi.json', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => miniSpec,
    })
    const result = await fetchOpenApiDocument(
      'http://127.0.0.1:8000',
      'secret',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.operations.length).toBe(3)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/openapi.json',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'secret' }),
      }),
    )
  })
})
