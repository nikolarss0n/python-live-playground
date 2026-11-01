import type { Difficulty } from '../examples'

export type Section = 'playground' | 'harness' | 'python' | 'ml' | 'build' | 'interview' | 'algorithms'

/**
 * The menu's top level. Each section strings whole tracks (or a range of one) into one list numbered 1..N;
 * tracks stay as the lesson's kind because refresher, service and GenAI lessons have their own checks and UI.
 */
export const SECTIONS: readonly { id: Section; label: string; parts: readonly { difficulty: Difficulty; from?: number; to?: number }[] }[] = [
  { id: 'python', label: 'Learn Python', parts: [{ difficulty: 'beginner' }, { difficulty: 'intermediate', to: 43 }] },
  { id: 'ml', label: 'Machine learning & LLMs', parts: [{ difficulty: 'ai' }] },
  { id: 'build', label: 'Build AI services', parts: [{ difficulty: 'api' }, { difficulty: 'genai' }, { difficulty: 'service' }] },
  { id: 'interview', label: 'Interview prep', parts: [{ difficulty: 'refresher' }, { difficulty: 'intermediate', from: 44, to: 61 }] },
  { id: 'algorithms', label: 'Algorithm practice', parts: [{ difficulty: 'intermediate', from: 62 }] },
  { id: 'harness', label: 'Agent harness interview', parts: [{ difficulty: 'harness' }] },
  { id: 'playground', label: 'Playground', parts: [{ difficulty: 'playground' }] },
]

export function isSection(value: string): value is Section {
  return SECTIONS.some((section) => section.id === value)
}
