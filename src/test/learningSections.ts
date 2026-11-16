import { SECTIONS } from '../curriculum/sections'
import { writeEnabledSections } from '../learningSwitches'

/** Lesson-flow tests run with every learning section switched on, as a learner who opted in would. */
export function turnOnAllSections(): void {
  writeEnabledSections(new Set(SECTIONS.map((section) => section.id)))
}
