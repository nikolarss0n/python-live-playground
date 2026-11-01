import { describe, expect, it, vi } from 'vitest'
import { forwardJev, JEV_ENDPOINT, JEV_MAX_REQUEST_BYTES } from './forward'

const body = JSON.stringify({ state: { code: 'x' }, questions: { cause: { type: 'noul', instructions: 'ok?' } } })

describe('forwardJev', () => {
  it('adds the server-side key and model and returns the answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"answers":{}}'))
    const result = await forwardJev(body, { apiKey: ' secret ', model: 'jev-latest', fetchImpl })
    expect(result).toEqual({ status: 200, body: '{"answers":{}}' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(JEV_ENDPOINT)
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret')
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'jev-latest', state: { code: 'x' } })
  })

  it('refuses unconfigured, oversized, malformed or extra-field requests before calling Jev', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    expect((await forwardJev(body, { apiKey: '', model: '', fetchImpl })).status).toBe(503)
    expect((await forwardJev('x'.repeat(JEV_MAX_REQUEST_BYTES + 1), { apiKey: 'k', model: '', fetchImpl })).status).toBe(413)
    expect((await forwardJev('{', { apiKey: 'k', model: '', fetchImpl })).status).toBe(400)
    expect((await forwardJev(JSON.stringify({ model: 'other', state: {}, questions: {} }), { apiKey: 'k', model: '', fetchImpl })).status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps provider failures generic and never echoes the key', async () => {
    const rejected = await forwardJev(body, { apiKey: 'secret', model: '', fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('bad key secret', { status: 401 })) })
    expect(rejected).toMatchObject({ status: 502 })
    expect(rejected.body).not.toContain('secret')
    const offline = await forwardJev(body, { apiKey: 'secret', model: '', fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')) })
    expect(offline.status).toBe(502)
  })
})
