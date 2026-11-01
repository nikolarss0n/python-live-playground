import { describe, expect, it } from 'vitest'
import {
  isBlankJsonBody,
  parseHeadersText,
  parseJsonBody,
  parseQueryText,
  routeNeedsBody,
} from './simApiCall'

describe('parseQueryText', () => {
  it('parses name=value lines', () => {
    expect(parseQueryText('name=Ada\nlimit=2')).toEqual({
      name: 'Ada',
      limit: '2',
    })
  })

  it('parses a JSON object', () => {
    expect(parseQueryText('{"name":"Ada"}')).toEqual({ name: 'Ada' })
  })

  it('returns undefined for blank input', () => {
    expect(parseQueryText('  \n')).toBeUndefined()
  })
})

describe('parseHeadersText', () => {
  it('parses Header: value lines', () => {
    expect(parseHeadersText('Authorization: Bearer secret\nX-API-Key: acme')).toEqual({
      Authorization: 'Bearer secret',
      'X-API-Key': 'acme',
    })
  })

  it('parses a JSON object', () => {
    expect(parseHeadersText('{"Authorization":"Bearer secret"}')).toEqual({
      Authorization: 'Bearer secret',
    })
  })
})

describe('parseJsonBody', () => {
  it('parses JSON objects', () => {
    expect(parseJsonBody('{"name":"Ada","tags":["admin"]}')).toEqual({
      name: 'Ada',
      tags: ['admin'],
    })
  })

  it('returns undefined for blank input', () => {
    expect(parseJsonBody('')).toBeUndefined()
  })

  it('treats empty braces as a blank body', () => {
    expect(isBlankJsonBody('{\n  \n}')).toBe(true)
    expect(isBlankJsonBody('{"name":"Ada"}')).toBe(false)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseJsonBody('{name:}')).toThrow(/json/i)
  })
})

describe('routeNeedsBody', () => {
  it('is true for write methods', () => {
    expect(routeNeedsBody('POST')).toBe(true)
    expect(routeNeedsBody('PUT')).toBe(true)
    expect(routeNeedsBody('PATCH')).toBe(true)
    expect(routeNeedsBody('GET')).toBe(false)
    expect(routeNeedsBody('DELETE')).toBe(false)
  })
})
