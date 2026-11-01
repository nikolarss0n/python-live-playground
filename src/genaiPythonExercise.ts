export const GENAI_PYTHON_EXERCISE_IDS = [
  'genai-typed',
  'genai-async',
  'genai-pytest',
  'genai-prompts',
  'genai-structured',
] as const

export type GenaiPythonExerciseId = (typeof GENAI_PYTHON_EXERCISE_IDS)[number]

export const GENAI_PYTHON_CHECKS: Record<
  GenaiPythonExerciseId,
  readonly { id: string; label: string }[]
> = {
  'genai-typed': [
    { id: 'typed-request', label: 'Return a typed request with trimmed fields' },
    { id: 'required-fields', label: 'Reject empty or missing request fields' },
    { id: 'runtime-types', label: 'Reject wrong types at the input boundary' },
  ],
  'genai-async': [
    { id: 'concurrent-tools', label: 'Await both tools concurrently in input order' },
    { id: 'timeout-result', label: 'Return a result or a bounded timeout' },
    { id: 'cancel-work', label: 'Cancel and await work after a timeout' },
  ],
  'genai-pytest': [
    { id: 'case-table', label: 'Run valid and invalid cases with assertions' },
    { id: 'trim-regression', label: 'Catch a regression that stops trimming text' },
    { id: 'invalid-regression', label: 'Catch a regression that accepts empty input' },
  ],
  'genai-prompts': [
    { id: 'message-roles', label: 'Keep system instructions separate from user data' },
    { id: 'prompt-version', label: 'Return a stable prompt version and preserve data' },
    { id: 'context-budget', label: 'Reject oversized user content with a character limit' },
  ],
  'genai-structured': [
    { id: 'valid-answer', label: 'Parse an answer with string citations' },
    { id: 'malformed-answer', label: 'Reject malformed JSON and missing fields' },
    { id: 'strict-answer', label: 'Reject wrong types, empty text, and extra fields' },
  ],
}

export function isGenaiPythonExerciseId(value: string): value is GenaiPythonExerciseId {
  return GENAI_PYTHON_EXERCISE_IDS.some((id) => id === value)
}
