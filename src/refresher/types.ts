export const PRACTICE_DAY_IDS = [
  'refresher-01', 'refresher-02', 'refresher-03', 'refresher-04',
  'refresher-05', 'refresher-06', 'refresher-07', 'refresher-08',
  'refresher-09', 'refresher-10', 'refresher-11',
] as const

export const REFRESHER_DAY_IDS = [...PRACTICE_DAY_IDS, 'refresher-12', 'refresher-13', 'refresher-14'] as const
export type PracticeDayId = (typeof PRACTICE_DAY_IDS)[number]
export type RefresherDayId = (typeof REFRESHER_DAY_IDS)[number]
export type MockDayId = 'refresher-12' | 'refresher-13'
export type MockVariantId = 'a' | 'b' | 'c'
export const STUDY_STAGES = ['recall', 'explain', 'guided', 'independent', 'review'] as const
export type StudyStage = (typeof STUDY_STAGES)[number]

export type CheckDefinition = { id: string; label: string }
export type SyntaxConcept = { term: string; explanation: string; example: string }

type DayBase = {
  id: RefresherDayId
  day: number
  title: string
  minutes: 60 | 75 | 90
  recall: string
  concepts: SyntaxConcept[]
  workedExample: string
  guidedStarter: string
  independentStarter: string
  problem: string
  acceptance: string[]
  hints: string[]
  reviewPrompts: string[]
  resources: { label: string; url: string }[]
  checks: CheckDefinition[]
}

export type PracticeDay = DayBase & {
  id: PracticeDayId
  kind: 'practice'
  support: 'worked' | 'partial' | 'minimal'
  consolidation: { functionName: string; problem: string; starter: string; checks: CheckDefinition[] }
}

export type MockVariant = {
  id: MockVariantId
  title: string
  prompt: string
  starter: string
  requirements: string[]
  followUp?: { prompt: string; requirements: string[] }
}

export type MockDay = DayBase & {
  id: MockDayId
  kind: 'mock'
  variants: MockVariant[]
}

export type ConsolidationDay = DayBase & {
  id: 'refresher-14'
  kind: 'consolidation'
}

export type RefresherDay = PracticeDay | MockDay | ConsolidationDay

export type RefresherContext = {
  variant?: MockVariantId
  followUp?: boolean
  revisit?: readonly [PracticeDayId, PracticeDayId]
}

export function isRefresherDayId(value: string): value is RefresherDayId {
  return REFRESHER_DAY_IDS.some((id) => id === value)
}

export function isPracticeDayId(value: string): value is PracticeDayId {
  return PRACTICE_DAY_IDS.some((id) => id === value)
}
