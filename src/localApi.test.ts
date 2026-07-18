import { describe, expect, it, vi } from 'vitest'
import { checkLocalApiHealth, probeLocalApi } from './localApi'

describe('localApi probe', () => {
  it('returns status and body on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: async () => '{"ok":true}',
    })
    const result = await probeLocalApi(
      { id: 'health', label: 'h', method: 'GET', path: '/health' },
      'http://127.0.0.1:8000',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.status).toBe(200)
      expect(result.bodyText).toContain('ok')
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('maps network failure to a calm offline message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await probeLocalApi(
      { id: 'health', label: 'h', method: 'GET', path: '/health' },
      'http://127.0.0.1:8000',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Offline|companion/i)
    }
  })

  it('checkLocalApiHealth is true only for 200', async () => {
    const ok = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      text: async () => '{}',
    })
    expect(
      await checkLocalApiHealth(
        'http://127.0.0.1:8000',
        ok as unknown as typeof fetch,
      ),
    ).toBe(true)

    const bad = vi.fn().mockResolvedValue({
      status: 500,
      statusText: 'ERR',
      text: async () => '{}',
    })
    expect(
      await checkLocalApiHealth(
        'http://127.0.0.1:8000',
        bad as unknown as typeof fetch,
      ),
    ).toBe(false)
  })
})
