import type { ResultEvent } from '../execution/protocol'

/** Prefer the longest non-empty print — usually the filled prompt. */
export function pickPromptFromEvents(events: readonly ResultEvent[]): string | null {
  let best: string | null = null
  for (const e of events) {
    if (e.kind !== 'print') continue
    const t = e.text.trim()
    if (t.length < 8) continue
    // Skip pure JSON/dict dumps when a longer instruction exists later
    if (!best || t.length >= best.length) best = t
  }
  return best
}

export function resolveModelPrompt(
  events: readonly ResultEvent[],
  fallback?: string,
): { text: string; source: 'print' | 'fallback' } | null {
  const fromPrint = pickPromptFromEvents(events)
  if (fromPrint) return { text: fromPrint, source: 'print' }
  const fb = fallback?.trim()
  if (fb && fb.length >= 8) return { text: fb, source: 'fallback' }
  return null
}
