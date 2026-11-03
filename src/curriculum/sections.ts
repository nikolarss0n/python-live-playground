import type { Difficulty } from '../examples'

export type Section = 'playground' | 'harness' | 'python' | 'ml' | 'fastapi' | 'build' | 'interview' | 'algorithms'

/**
 * The menu's top level. Each section strings whole tracks (or a range of one) into one list numbered 1..N;
 * tracks stay as the lesson's kind because refresher, service and GenAI lessons have their own checks and UI.
 */
export const SECTIONS: readonly { id: Section; label: string; parts: readonly { difficulty: Difficulty; from?: number; to?: number }[] }[] = [
  { id: 'python', label: 'Learn Python', parts: [{ difficulty: 'beginner' }, { difficulty: 'intermediate', to: 43 }] },
  { id: 'ml', label: 'Machine learning & LLMs', parts: [{ difficulty: 'ai' }] },
  { id: 'build', label: 'Build AI services', parts: [{ difficulty: 'api', to: 40 }, { difficulty: 'api', from: 49, to: 54 }, { difficulty: 'genai' }, { difficulty: 'service' }] },
  // FastAPI (api 41-48) and full-stack data (api 55-61) have their own section; the rest of the api track stays in build.
  { id: 'fastapi', label: 'FastAPI', parts: [{ difficulty: 'api', from: 41, to: 48 }, { difficulty: 'api', from: 55, to: 61 }] },
  { id: 'interview', label: 'Interview prep', parts: [{ difficulty: 'refresher' }, { difficulty: 'intermediate', from: 44, to: 61 }] },
  { id: 'algorithms', label: 'Algorithm practice', parts: [{ difficulty: 'intermediate', from: 62 }] },
  { id: 'harness', label: 'Agent harness interview', parts: [{ difficulty: 'harness' }] },
  { id: 'playground', label: 'Playground', parts: [{ difficulty: 'playground' }] },
]

export function isSection(value: string): value is Section {
  return SECTIONS.some((section) => section.id === value)
}
