import { describe, expect, it } from 'vitest'
import { LESSONS } from './examples'
import { LESSON_ID_ALIASES, RETIRED_LESSON_IDS, resolveLessonId } from './lessonIds'
import { SHIPPED_LESSON_IDS } from './curriculum/shippedLessonIds'

describe('lesson ID history', () => {
  const current = new Set(LESSONS.map((lesson) => lesson.id))

  it('lists every current lesson as shipped', () => {
    const missing = [...current].filter((id) => !SHIPPED_LESSON_IDS.includes(id))
    expect(missing, 'add these IDs to src/curriculum/shippedLessonIds.ts').toEqual([])
  })

  it('never drops a shipped ID without an alias or a retirement entry', () => {
    const lost = SHIPPED_LESSON_IDS.filter((id) => !current.has(id) && !(id in LESSON_ID_ALIASES) && !RETIRED_LESSON_IDS.includes(id))
    expect(lost, 'map renamed IDs in LESSON_ID_ALIASES or list removed ones in RETIRED_LESSON_IDS').toEqual([])
  })

  it('points every alias at a current lesson and never aliases a live ID', () => {
    for (const [from, to] of Object.entries(LESSON_ID_ALIASES)) {
      expect(current.has(from), from).toBe(false)
      expect(resolveLessonId(to), `${from} -> ${to}`).not.toBeNull()
    }
    for (const id of RETIRED_LESSON_IDS) expect(current.has(id) || id in LESSON_ID_ALIASES, id).toBe(false)
  })

  it('resolves current IDs to themselves and unknown ones to null', () => {
    expect(resolveLessonId(LESSONS[0].id)).toBe(LESSONS[0].id)
    expect(resolveLessonId('no-such-lesson')).toBeNull()
  })
})
