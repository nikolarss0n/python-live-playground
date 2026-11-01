/**
 * Parse quiet Call-form text into invoke query/headers/body.
 * Lines or a JSON object; blank input means “omit”.
 */

export type ParsedRecord = Record<string, string>

function trimmed(text: string): string {
  return text.trim()
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.startsWith('{')) return null
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON object required')
  }
  return parsed as Record<string, unknown>
}

function stringifyValues(
  record: Record<string, unknown>,
): ParsedRecord {
  const out: ParsedRecord = {}
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return out
}

function parseLines(
  text: string,
  split: (line: string) => [string, string] | null,
): ParsedRecord {
  const out: ParsedRecord = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const pair = split(line)
    if (!pair) continue
    const [key, value] = pair
    if (key) out[key] = value
  }
  return out
}

export function parseQueryText(text: string): ParsedRecord | undefined {
  const value = trimmed(text)
  if (!value) return undefined
  const asJson = parseJsonObject(value)
  if (asJson) return stringifyValues(asJson)
  const fromAmp = value.includes('=') && !value.includes('\n') && value.includes('&')
  const source = fromAmp ? value.split('&').join('\n') : value
  const parsed = parseLines(source, (line) => {
    const eq = line.indexOf('=')
    if (eq <= 0) return [line, '']
    return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()]
  })
  return Object.keys(parsed).length ? parsed : undefined
}

export function parseHeadersText(text: string): ParsedRecord | undefined {
  const value = trimmed(text)
  if (!value) return undefined
  const asJson = parseJsonObject(value)
  if (asJson) return stringifyValues(asJson)
  const parsed = parseLines(value, (line) => {
    const sep = line.indexOf(':')
    if (sep <= 0) return [line.trim(), '']
    return [line.slice(0, sep).trim(), line.slice(sep + 1).trim()]
  })
  return Object.keys(parsed).length ? parsed : undefined
}

export function isBlankJsonBody(text: string): boolean {
  const value = trimmed(text)
  if (!value) return true
  return /^\{\s*\}$/.test(value)
}

export function parseJsonBody(text: string): unknown {
  const value = trimmed(text)
  if (!value) return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error('Body must be valid JSON')
  }
}

export function routeNeedsBody(method: string): boolean {
  const upper = method.toUpperCase()
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH'
}
