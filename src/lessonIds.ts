import { LESSONS } from './examples'

/** Old lesson ID → the ID it was renamed to. Saved drafts, last-opened lessons and ?lesson= links follow these. */
export const LESSON_ID_ALIASES: Readonly<Record<string, string>> = {}

/** Shipped lesson IDs that were removed without a replacement; their drafts stay in storage as retired. */
export const RETIRED_LESSON_IDS: readonly string[] = []

const CURRENT_IDS = new Set(LESSONS.map((lesson) => lesson.id))

/** The current lesson ID for a saved or linked one, or null when it no longer names a lesson. */
export function resolveLessonId(id: string): string | null {
  if (CURRENT_IDS.has(id)) return id
  const seen = new Set<string>()
  let next = LESSON_ID_ALIASES[id]
  while (next !== undefined && !seen.has(next)) {
    if (CURRENT_IDS.has(next)) return next
    seen.add(next)
    next = LESSON_ID_ALIASES[next]
  }
  return null
}
