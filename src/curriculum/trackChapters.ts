import type { Difficulty } from '../examples'

/**
 * Menu chapters for the numbered tracks, as [last lesson number, chapter name] in ascending order.
 * Each chapter covers a consecutive run of lessons, so the lesson menu always reads 1, 2, 3, ...
 */
export const TRACK_CHAPTERS: Partial<Record<Difficulty, readonly (readonly [number, string])[]>> = {
  intermediate: [
    [4, 'Sequences & comprehensions'],
    [8, 'Dicts, sets & tuples'],
    [14, 'Standard library & errors'],
    [20, 'Idiomatic Python'],
    [29, 'Reliable data pipelines'],
    [32, 'Runtime & object model'],
    [36, 'Java to Python'],
    [43, 'Engineering deep dives'],
    [49, 'Array patterns'],
    [61, 'Data structures & algorithms'],
    [69, 'Arrays & strings'],
    [72, 'Searching & sorting'],
    [75, 'Trees'],
    [78, 'Graphs'],
    [83, 'Dynamic programming'],
    [86, 'Lists, stacks & recursion'],
  ],
  ai: [
    [5, 'Text & vectors'],
    [8, 'Prompts & pipelines'],
    [13, 'Learning & LLM internals'],
    [16, 'Retrieval, evals & tools'],
    [26, 'Classical machine learning'],
    [36, 'LLM apps & RAG'],
    [44, 'ML deep dives'],
    [49, 'Advanced retrieval & agents'],
    [56, 'Quality, safety & tuning'],
  ],
  api: [
    [9, 'HTTP from scratch'],
    [15, 'API contracts & reliability'],
    [19, 'Streaming, caching & routing'],
    [26, 'Observability & releases'],
    [31, 'Serving & infrastructure'],
    [37, 'Agents & architecture'],
    [40, 'Capacity & data systems'],
    [54, 'Support automation'],
    [61, 'Full-stack data'],
  ],
  fastapi: [
    [6, 'First endpoints'],
    [9, 'Create, read, update, delete'],
    [14, 'Validation & responses'],
    [18, 'Dependencies & auth'],
    [22, 'Structure & testing'],
    [24, 'Under the hood'],
  ],
  service: [[3, 'Project: build one service']],
  harness: [
    [4, 'Agent loop'],
    [9, 'Production controls'],
    [11, 'Evals & observability'],
    [13, 'Mock interview'],
  ],
  genai: [
    [5, 'GenAI service foundations'],
    [7, 'GenAI providers & reliability'],
    [10, 'GenAI agent controls'],
  ],
}

export function trackChapter(difficulty: Difficulty, number: number): string | null {
  return TRACK_CHAPTERS[difficulty]?.find(([last]) => number <= last)?.[1] ?? null
}
