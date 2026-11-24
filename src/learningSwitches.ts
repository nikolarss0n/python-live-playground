/**
 * Which learning sections show. All are off by default: the app opens as a plain Python editor, and each section
 * (Learn Python, Interview prep, Playground, ...) is a switch in Settings. A `?lesson=` or shared link still opens
 * its lesson, without turning its section on.
 */

import { SECTIONS, isSection, type Section } from './curriculum/sections'
import { readPreference, writePreference } from './preferences'

export const LEARNING_SWITCHES_KEY = 'plp-learning-sections'

export function readEnabledSections(): Set<Section> {
  try {
    const parsed: unknown = JSON.parse(readPreference(LEARNING_SWITCHES_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is Section => typeof value === 'string' && isSection(value)) : [])
  } catch {
    return new Set()
  }
}

export function writeEnabledSections(sections: ReadonlySet<Section>): void {
  writePreference(LEARNING_SWITCHES_KEY, JSON.stringify(SECTIONS.map((section) => section.id).filter((id) => sections.has(id))))
}

/** Sections the track menu offers: the switched-on ones, plus the one a link opened. */
export function menuSections(enabled: ReadonlySet<Section>, current: Section, opened: Section | null) {
  return SECTIONS.filter((section) => enabled.has(section.id) || (section.id === current && section.id === opened))
}

/** The section a `?lesson=` or shared link asked for when the page loaded, if any. */
export function linkedLessonId(location: Pick<Location, 'search' | 'hash'> = window.location): string | null {
  const query = new URLSearchParams(location.search).get('lesson')
  if (query) return query
  return location.hash.startsWith('#plp=') ? 'shared' : null
}
