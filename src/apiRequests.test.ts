import { describe, expect, it } from 'vitest'
import { buildRequest, preparedDraft, refusals, responseFromEvents, routeKey, sameField } from './apiRequests'
import type { DiscoveredRoute } from './execution/protocol'

const CREATE: DiscoveredRoute = {
  method: 'POST', path: '/items/{item_id}', callPath: '/items/1', name: 'create_item',
  query: [{ name: 'q', value: '', required: false }, { name: 'limit', value: '10', required: false }],
  headers: [{ name: 'x-token', value: 'string', required: true }],
  body: '{\n  "name": "string"\n}',
}

describe('prepared API requests', () => {
  it('starts a request from what the route asks for', () => {
    expect(routeKey(CREATE)).toBe('POST /items/{item_id}')
    expect(preparedDraft(CREATE)).toEqual({ path: '/items/1', query: { q: '', limit: '10' }, headers: { 'x-token': 'string' }, body: CREATE.body })
  })

  it('sends filled fields only and parses the body', () => {
    expect(buildRequest(CREATE, preparedDraft(CREATE))).toEqual({
      method: 'POST', path: '/items/1', query: { limit: '10' }, headers: { 'x-token': 'string' }, body: { name: 'string' },
    })
    expect(buildRequest({ method: 'GET', path: '/hello' }, preparedDraft({ method: 'GET', path: '/hello' }))).toEqual({ method: 'GET', path: '/hello' })
  })

  it('refuses a body that is not JSON', () => {
    expect(() => buildRequest(CREATE, { ...preparedDraft(CREATE), body: '{name' })).toThrow('Body must be valid JSON')
  })

  it('reads the response a Send produced', () => {
    const http = { kind: 'http' as const, method: 'POST', path: '/items/1', status: 201, body: '{"name":"string"}', simulated: true }
    expect(responseFromEvents([{ kind: 'print', text: 'hi' }, http], 3)).toEqual({ kind: 'response', path: '/items/1', status: 201, body: { name: 'string' }, durationMs: 3 })
    expect(responseFromEvents([http, { kind: 'error', message: 'SimFastAPIError: no Request object', friendly: '', traceback: '' }], 1))
      .toEqual({ kind: 'failed', message: 'SimFastAPIError: no Request object' })
    expect(responseFromEvents([{ kind: 'print', text: 'hi' }], 1)).toBeNull()
    expect(responseFromEvents([{ ...http, status: 500, line: 12 }], 2)).toMatchObject({ status: 500, line: 12 })
    expect(responseFromEvents([{ ...http, status: 500, file: 'routes/books.py', line: 9 }], 2)).toMatchObject({ status: 500, file: 'routes/books.py', line: 9 })
  })

  it('reads which fields a 422 refused, and nothing from any other response', () => {
    const refused = (body: unknown, status = 422) => refusals({ kind: 'response', path: '/items', status, body, durationMs: 1 })
    const detail = [
      { loc: ['query', 'limit'], msg: 'Input should be a valid integer', type: 'int_parsing' },
      { loc: ['header', 'x-token'], msg: 'field required', type: 'missing' },
      { loc: ['body', 'author', 'name'], msg: 'String should have at least 2 characters', type: 'string_too_short' },
      { loc: ['query', 'ids', 1], msg: 'Input should be a valid integer', type: 'type_error' },
      { loc: ['body'], msg: 'JSON decode error', type: 'json_invalid' },
      { loc: ['cookie', 'session'], msg: 'field required' },
      { loc: 'query', msg: 'not a list' },
      null,
    ]
    expect(refused({ detail })).toEqual([
      { where: 'query', field: 'limit', name: 'limit', message: 'Input should be a valid integer' },
      { where: 'header', field: 'x-token', name: 'x-token', message: 'field required' },
      { where: 'body', field: 'author', name: 'author.name', message: 'String should have at least 2 characters' },
      { where: 'query', field: 'ids', name: 'ids.1', message: 'Input should be a valid integer' },
      { where: 'body', field: '', name: '', message: 'JSON decode error' },
    ])
    expect(refused({ detail: Array.from({ length: 500 }, () => detail[0]) })).toHaveLength(20)
    expect(refused({ detail }, 400)).toEqual([])
    expect(refused({ detail: 'Bad token' })).toEqual([])
    expect(refused(null)).toEqual([])
    expect(refusals({ kind: 'failed', message: 'x' })).toEqual([])
    expect(refusals(undefined)).toEqual([])
    expect(sameField('x_token', 'X-Token')).toBe(true)
    expect(sameField('x_token', 'token')).toBe(false)
  })
})
