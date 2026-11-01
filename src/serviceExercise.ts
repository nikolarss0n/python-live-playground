import { GENAI_PYTHON_EXERCISE_IDS, GENAI_PYTHON_CHECKS } from './genaiPythonExercise'
import { GENAI_SECURITY_EXERCISE_IDS, GENAI_SECURITY_CHECKS } from './genaiSecurityExercise'
import { isRefresherDayId, type RefresherDayId } from './refresher/types'

export const SERVICE_EXERCISE_IDS = [
  'service-validation',
  'service-endpoint',
  'service-tests',
] as const

export type ServiceExerciseId = (typeof SERVICE_EXERCISE_IDS)[number]
export const GENAI_EXERCISE_IDS = [...GENAI_PYTHON_EXERCISE_IDS, ...GENAI_SECURITY_EXERCISE_IDS] as const
export type LegacyExerciseId = ServiceExerciseId | (typeof GENAI_EXERCISE_IDS)[number]
export type ExerciseId = LegacyExerciseId | RefresherDayId

export type ExerciseCheck = {
  id: string
  label: string
  passed: boolean
  detail: string
}

export const SERVICE_CHECKS: Record<
  ServiceExerciseId,
  readonly { id: string; label: string }[]
> = {
  'service-validation': [
    { id: 'valid-question', label: 'Return a trimmed question' },
    { id: 'empty-question', label: 'Reject empty or missing questions' },
    { id: 'question-types', label: 'Reject non-text questions and non-object input' },
  ],
  'service-endpoint': [
    { id: 'post-question', label: 'POST /ask returns the trimmed question' },
    { id: 'invalid-request', label: 'Invalid requests return 422 with a detail' },
    { id: 'reuse-validator', label: 'The endpoint calls your validation function' },
  ],
  'service-tests': [
    { id: 'service-contract', label: 'The service still handles valid and invalid input' },
    { id: 'valid-test', label: 'Your valid-request test catches wrong status and body' },
    { id: 'invalid-test', label: 'Your invalid-request test catches an accepted bad request' },
  ],
}

export function isServiceExerciseId(value: string): value is ServiceExerciseId {
  return SERVICE_EXERCISE_IDS.some((id) => id === value)
}


export const EXERCISE_CHECKS: Record<LegacyExerciseId, readonly { id: string; label: string }[]> = {
  ...SERVICE_CHECKS,
  ...GENAI_PYTHON_CHECKS,
  ...GENAI_SECURITY_CHECKS,
}

export function isExerciseId(value: string): value is ExerciseId {
  return isRefresherDayId(value) || isServiceExerciseId(value) || GENAI_EXERCISE_IDS.some((id) => id === value)
}
