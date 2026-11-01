import type { LessonDraft } from '../examples'
import { FOUNDATION_DAYS } from './foundationDays'
import { ADVANCED_DAYS } from './advancedDays'
import type { CheckDefinition, RefresherContext, RefresherDay, RefresherDayId, StudyStage } from './types'

export const REFRESHER_DAYS: RefresherDay[] = [...FOUNDATION_DAYS, ...ADVANCED_DAYS]

export function getRefresherDay(id: string): RefresherDay | null {
  return REFRESHER_DAYS.find((day) => day.id === id) ?? null
}

export const REFRESHER_LESSON_DRAFTS: LessonDraft[] = REFRESHER_DAYS.map((day) => ({
  id: day.id,
  difficulty: 'refresher',
  number: day.day,
  topic: day.title,
  chapter: day.day < 8 ? 'Python foundations' : day.day < 12 ? 'Files, APIs & async' : 'Interview practice & review',
  goal: day.kind === 'mock' ? 'Complete a timed practice interview, then review your approach.' : day.problem,
  why: 'Build Python fluency through recall, explanation, guided practice, an independent attempt, and mistake review.',
  tasks: day.checks.map((check) => check.label),
  code: day.kind === 'mock' ? '# Start the mock when you are ready to reveal its problem.\n' : day.guidedStarter,
  goalCheck: { noBlanks: true, requireSuccess: true },
}))

export function refresherChecksFor(id: RefresherDayId, context: RefresherContext): CheckDefinition[] {
  if (id === 'refresher-14') {
    return (context.revisit ?? ['refresher-03', 'refresher-04']).flatMap((selected) =>
      (() => { const day = getRefresherDay(selected); return day?.kind === 'practice' ? day.consolidation.checks : [] })().map((check) => ({
        id: `${selected}:${check.id}`, label: `Day ${Number(selected.slice(-2))}: ${check.label}`,
      })),
    )
  }
  return getRefresherDay(id)?.checks ?? []
}

export function refresherStarterFor(day: RefresherDay, stage: StudyStage, context: RefresherContext): string {
  if (day.kind === 'consolidation' && stage === 'guided') {
    return '# Plan the two functions and check your environment. Rebuild them once in the independent attempt.\n'
  }
  if (day.kind === 'consolidation' && stage === 'independent') {
    const selected = context.revisit ?? ['refresher-03', 'refresher-04']
    return selected.map((id) => {
      const previous = getRefresherDay(id)
      return previous?.kind === 'practice' ? `# From memory: ${previous.consolidation.functionName} (Day ${previous.day})\n${previous.consolidation.starter}` : ''
    }).join('\n\n')
  }
  if (day.kind === 'mock') {
    return day.variants.find((variant) => variant.id === context.variant)?.starter ?? '# Start the mock to reveal the problem.\n'
  }
  if (stage === 'explain') return day.workedExample
  if (stage === 'guided') return day.guidedStarter
  if (stage === 'independent') return day.independentStarter
  if (stage === 'recall') return day.day === 1
    ? '# Try a variable assignment or a small function. It is fine to start without prior Python experience.\n'
    : '# Recall yesterday from memory. Use this space to try a small example.\n'
  return day.independentStarter
}
