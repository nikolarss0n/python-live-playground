/**
 * Browser-local lesson share: encode lesson + code in the URL hash.
 * No server, no account.
 */

import { isDifficulty, type Difficulty } from './examples'

export type SnapshotPayload = {
  v: 1
  lessonId: string
  difficulty: Difficulty
  code: string
}

const PREFIX = 'plp='

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSnapshot(payload: SnapshotPayload): string {
  return PREFIX + toBase64Url(JSON.stringify(payload))
}

export function decodeSnapshot(hash: string): SnapshotPayload | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(PREFIX)) return null
  try {
    const json = fromBase64Url(raw.slice(PREFIX.length))
    const data = JSON.parse(json) as SnapshotPayload
    if (data?.v !== 1) return null
    if (typeof data.lessonId !== 'string' || typeof data.code !== 'string') {
      return null
    }
    if (!isDifficulty(data.difficulty)) {
      return null
    }
    // Guard absurd payloads
    if (data.code.length > 80_000) return null
    return data
  } catch {
    return null
  }
}

export function readSnapshotFromLocation(
  loc: Pick<Location, 'hash'> = window.location,
): SnapshotPayload | null {
  return decodeSnapshot(loc.hash || '')
}

export function writeSnapshotToLocation(
  payload: SnapshotPayload,
  loc: Location = window.location,
): string {
  const hash = '#' + encodeSnapshot(payload)
  const url = `${loc.pathname}${loc.search}${hash}`
  window.history.replaceState(null, '', url)
  return loc.origin + url
}

export async function copyShareUrl(payload: SnapshotPayload): Promise<string> {
  const url = writeSnapshotToLocation(payload)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
  }
  return url
}
