export const GENAI_SECURITY_EXERCISE_IDS = [
  'genai-bedrock',
  'genai-retries',
  'genai-tools',
  'genai-authorization',
  'genai-audit',
] as const

export type GenaiSecurityExerciseId = (typeof GENAI_SECURITY_EXERCISE_IDS)[number]

export const GENAI_SECURITY_CHECKS: Record<
  GenaiSecurityExerciseId,
  readonly { id: string; label: string }[]
> = {
  'genai-bedrock': [
    { id: 'converse-request', label: 'Build a Converse request with a bounded response' },
    { id: 'converse-response', label: 'Read text blocks from the model response' },
    { id: 'converse-boundaries', label: 'Reject empty questions and incomplete responses' },
  ],
  'genai-retries': [
    { id: 'transient-retry', label: 'Recover from a transient provider failure' },
    { id: 'terminal-error', label: 'Never retry authorization or validation errors' },
    { id: 'retry-budget', label: 'Stop at the attempt limit without an extra wait' },
  ],
  'genai-tools': [
    { id: 'tool-observation', label: 'Return a read-only tool result to the model' },
    { id: 'tool-boundary', label: 'Reject unknown tools and malformed arguments' },
    { id: 'tool-budget', label: 'Bound model turns and report failures safely' },
  ],
  'genai-authorization': [
    { id: 'allowed-record', label: 'Allow a scoped read inside the trusted tenant' },
    { id: 'deny-default', label: 'Deny missing identity and missing permissions' },
    { id: 'tenant-boundary', label: 'Reject cross-tenant reads and model-made approvals' },
  ],
  'genai-audit': [
    { id: 'audit-metadata', label: 'Keep useful request and performance metadata' },
    { id: 'audit-redaction', label: 'Exclude prompts, responses, secrets and personal data' },
    { id: 'audit-values', label: 'Validate values even under allowed field names' },
  ],
}

export function isGenaiSecurityExerciseId(value: string): value is GenaiSecurityExerciseId {
  return GENAI_SECURITY_EXERCISE_IDS.some((id) => id === value)
}
