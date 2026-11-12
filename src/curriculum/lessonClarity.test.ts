import { describe, expect, it } from 'vitest'
import { LESSONS, type Lesson } from '../examples'

const lessons = LESSONS.filter(
  ({ difficulty }) => difficulty !== 'refresher' && difficulty !== 'playground',
)

const fallbackStretchOpenings = [
  'Stretch: add one empty or boundary input to',
  'Stretch: turn one edge case from this',
  'Stretch: vary one',
  'Stretch: send one malformed or unauthorized input through this',
]

const bannedBeginnerWord = /^(?:normali[sz][a-z]*|boundar[a-z]*|polic[a-z]*|aggregat[a-z]*|deterministic[a-z]*|evidence|contracts?)$/

function bannedBeginnerWords(text: string, topic: string): string[] {
  const topicWords = new Set(topic.toLowerCase().match(/[a-z0-9_]+/g) ?? [])
  const words = text.toLowerCase().match(/[a-z0-9_]+/g) ?? []
  return words.filter((word) => !word.includes('_') && !topicWords.has(word) && bannedBeginnerWord.test(word))
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '')
}

function sentences(text: string): string[] {
  // The editor placeholder is not three sentence-ending question marks.
  return text.replace(/\?{3}/g, 'BLANK').split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim()).filter(Boolean)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function beginnerText(lesson: Pick<Lesson, 'goal' | 'why' | 'tasks' | 'taskInstructions' | 'stretch' | 'code'>): string {
  return [
    lesson.goal,
    lesson.why ?? '',
    ...lesson.tasks,
    ...(lesson.taskInstructions ?? []),
    lesson.stretch ?? '',
    ...lesson.code.split('\n').filter((line) => line.trimStart().startsWith('#')),
  ].join('\n')
}

function lessonsWithRepeatedSentences(): Set<string> {
  const sentenceLessons = new Map<string, Set<string>>()
  for (const lesson of lessons) {
    for (const instruction of lesson.taskInstructions ?? []) {
      for (const sentence of sentences(instruction)) {
        if (wordCount(sentence) < 8) continue
        const normalized = normalizeText(sentence)
        const ids = sentenceLessons.get(normalized) ?? new Set<string>()
        ids.add(lesson.id)
        sentenceLessons.set(normalized, ids)
      }
    }
  }
  return new Set(
    [...sentenceLessons.values()].filter((ids) => ids.size > 3).flatMap((ids) => [...ids]),
  )
}

const repeatedSentenceLessons = lessonsWithRepeatedSentences()

const rules: readonly { name: string; fails: (lesson: Lesson) => boolean }[] = [
  {
    name: 'R1: How lines do not open with their task title',
    fails: (lesson) => lesson.tasks.some((task, index) =>
      normalizeText(lesson.taskInstructions?.[index] ?? '').startsWith(normalizeText(task))),
  },
  {
    name: 'R2: How sentences of eight or more words occur in at most three lessons',
    fails: (lesson) => repeatedSentenceLessons.has(lesson.id),
  },
  {
    name: 'R3: stretches do not use generated fallback openings',
    fails: (lesson) => fallbackStretchOpenings.some((opening) =>
      normalizeText(lesson.stretch ?? '').startsWith(normalizeText(opening))),
  },
  {
    name: 'R4: goals have at most three sentences of at most 25 words each',
    fails: (lesson) => {
      const goalSentences = sentences(lesson.goal)
      return goalSentences.length > 3 || goalSentences.some((sentence) => wordCount(sentence) > 25)
    },
  },
  {
    name: 'R5: task titles have at most 12 words',
    fails: (lesson) => lesson.tasks.some((task) => wordCount(task) > 12),
  },
  {
    name: 'R6: numbered starter headers agree with the lesson number',
    fails: (lesson) => {
      const firstLine = lesson.code.split('\n')[0] ?? ''
      const header = /^#\s+\S+\s+(\d+)\s+—/.exec(firstLine)
      return header !== null && Number(header[1]) !== lesson.number
    },
  },
  {
    name: 'R7: beginner instructions avoid unexplained engineering words',
    fails: (lesson) => lesson.difficulty === 'beginner' && bannedBeginnerWords(beginnerText(lesson), lesson.topic).length > 0,
  },
]

describe('lesson clarity', () => {
  for (const { name, fails } of rules) {
    const failingLessonIds = lessons.filter(fails).map(({ id }) => id)
    it(`${name} (${failingLessonIds.length} affected lessons)`, () => {
      expect(failingLessonIds, name).toEqual([])
    })
  }
})

describe('clarity sentence boundaries', () => {
  it('keeps URL queries, attribute names and decimals inside their sentence', () => {
    expect(sentences('Use /ask?q=hours and row.value with threshold 0.8. Done when Results shows 200.')).toEqual([
      'Use /ask?q=hours and row.value with threshold 0.8.',
      'Done when Results shows 200.',
    ])
  })

  it('keeps editor blanks inside a sentence and separates prose punctuation', () => {
    expect(sentences('Fill ??? in ask. Run it! Is q required? Yes.')).toEqual([
      'Fill BLANK in ask.', 'Run it!', 'Is q required?', 'Yes.',
    ])
  })
})

describe('beginner word variants', () => {
  it('checks starter comment lines without checking executable names or strings', () => {
    const text = beginnerText({
      goal: 'Read values.', tasks: [],
      code: '# Goal: Use policies.\n    # Check boundaries.\ncontract = "evidence"\nprint("# aggregation")',
    })
    expect(bannedBeginnerWords(text, 'Lists')).toEqual(['policies', 'boundaries'])
  })

  it('keeps topic and starter-identifier exemptions inside comments', () => {
    const text = beginnerText({
      goal: 'Clean text.', tasks: [],
      code: '# Normalization uses normalize_text and policy_id.\n# Contract checks are separate.',
    })
    expect(bannedBeginnerWords(text, 'Text normalization')).toEqual(['contract'])
  })

  it('rejects plurals and derived words, including both normalization spellings', () => {
    const words = ['normalize', 'normalise', 'normalization', 'normalisation', 'normalized',
      'boundary', 'boundaries', 'policy', 'policies', 'aggregate', 'aggregation', 'aggregated',
      'deterministic', 'deterministically', 'evidence', 'contract', 'contracts']
    expect(bannedBeginnerWords(words.join(' '), 'Working with data')).toEqual(words)
  })

  it('allows starter identifiers and a term named in the lesson topic', () => {
    expect(bannedBeginnerWords('Use normalize_text and policy_id for normalization.', 'Text normalization')).toEqual([])
  })

  it('does not mistake a topic substring or identifier for a defined term', () => {
    expect(bannedBeginnerWords('Read the contract and policy.', 'Contractors and policy_id')).toEqual(['contract', 'policy'])
  })
})
