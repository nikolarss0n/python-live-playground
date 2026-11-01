import { describe, expect, it } from 'vitest'
import { getRefresherDay, REFRESHER_DAYS } from './refresher/catalog'
import {
  LESSONS,
  getLesson,
  lessonLabel,
  lessonHeading,
  lessonsForDifficulty,
  lessonsByChapter,
  firstLessonId,
  BLANK,
  DEFAULT_LESSON_ID,
  DEFAULT_SECTION,
  SECTIONS,
  lessonsForSection,
} from './examples'
import { evaluateGoal } from './goalCheck'

describe('lessons', () => {
  it('has complete Python, ML/LLM, and production AI tracks', () => {
    const beginner = lessonsForDifficulty('beginner')
    const intermediate = lessonsForDifficulty('intermediate')
    const ai = lessonsForDifficulty('ai')
    const api = lessonsForDifficulty('api')
    expect(beginner).toHaveLength(32)
    expect(intermediate).toHaveLength(86)
    expect(ai).toHaveLength(56)
    expect(api).toHaveLength(61)

    for (const track of [beginner, intermediate, ai, api]) {
      track.forEach((lesson) => {
        expect(lesson.topic.length).toBeGreaterThan(0)
        expect(lesson.chapter.length).toBeGreaterThan(0)
        expect(lesson.stretch?.length).toBeGreaterThan(0)
        expect(lesson.goal.length).toBeGreaterThan(10)
        expect(lesson.why?.length).toBeGreaterThan(30)
        expect(lesson.tasks.length).toBeGreaterThan(0)
        expect(lesson.taskInstructions).toHaveLength(lesson.tasks.length)
        expect(lesson.taskInstructions?.every((instruction) => instruction.length > 55)).toBe(
          true,
        )
        expect(lesson.code.length).toBeGreaterThan(0)
        expect(lesson.goalCheck).toBeTruthy()
      })
    }

    expect(ai[0]?.pipeline?.length).toBeGreaterThan(0)
    expect(ai.every((l) => l.pipeline && l.pipeline.length > 0)).toBe(true)
    expect(api.every((l) => l.pipeline && l.pipeline.length > 0)).toBe(true)
    expect(api[0]?.id).toBe('api-request')
    expect(api.some((l) => l.id === 'api-auth')).toBe(true)
    expect(intermediate.some((l) => l.id === 'mid-generators')).toBe(true)
    expect(intermediate.some((l) => l.id === 'mid-context-managers')).toBe(true)
    expect(ai.some((l) => l.id === 'ai-softmax')).toBe(true)
    expect(ai.some((l) => l.id === 'ai-retrieval')).toBe(true)
    expect(ai.some((l) => l.id === 'ai-safe-tools')).toBe(true)
    expect(ai.some((l) => l.topic === 'Cross-entropy & gradient descent')).toBe(true)
    expect(ai.some((l) => l.topic === 'Hybrid retrieval & RRF')).toBe(true)
    expect(ai.some((l) => /RAG capstone/i.test(l.topic))).toBe(true)
    expect(api.some((l) => /timeouts.*retries.*backoff/i.test(l.topic))).toBe(true)
    expect(api.some((l) => /release gate/i.test(l.topic))).toBe(true)
    expect(intermediate.some((l) => l.topic === 'Type hints & contracts')).toBe(true)
    expect(beginner.some((l) => /feedback classifier/i.test(l.topic))).toBe(true)
    expect(ai.some((l) => /Markov chains/i.test(l.topic))).toBe(true)
    expect(ai.some((l) => /Spark dataflow/i.test(l.topic))).toBe(true)
    expect(intermediate.some((l) => /Java core through Python/i.test(l.topic))).toBe(true)
    expect(api.some((l) => /MCP tool contracts/i.test(l.topic))).toBe(true)
    expect(api.some((l) => /document RAG capstone/i.test(l.topic))).toBe(true)
    expect(ai.some((l) => /Eval design & judges/i.test(l.topic))).toBe(true)
    expect(intermediate.some((l) => /Concurrency safety patterns/i.test(l.topic))).toBe(
      true,
    )
    expect(api.some((l) => /Containers & serverless mechanics/i.test(l.topic))).toBe(
      true,
    )
    expect(getLesson('ai-prompt-template').runWithModel).toBe(true)
    const withModel = lessonsForDifficulty('ai').filter((l) => l.runWithModel)
    expect(withModel.length).toBeGreaterThanOrEqual(6)
    expect(
      withModel.every(
        (l) => (l.modelPromptFallback?.length ?? 0) > 10 || l.id === 'ai-prompt-template',
      ),
    ).toBe(true)

    const mid = lessonsForDifficulty('intermediate')
    expect(mid.every((l) => l.predict && l.compare)).toBe(true)
    expect(beginner.every((l) => l.predict && l.compare)).toBe(true)
    expect(ai.every((l) => l.predict && l.compare)).toBe(true)
    expect(api.every((l) => l.predict && l.compare)).toBe(true)
    expect(LESSONS.every((l) => !/try one more small variation/i.test(l.stretch ?? ''))).toBe(
      true,
    )
  })

  it('gives learners something to edit (blanks or a clear fix)', () => {
    for (const lesson of LESSONS) {
      if (lesson.difficulty === 'playground') continue
      if (lesson.difficulty === 'refresher') {
        const day = getRefresherDay(lesson.id)
        expect(day).not.toBeNull()
        if (!day) throw new Error(`Missing refresher metadata: ${lesson.id}`)
        if (day.kind === 'practice') {
          const commentsOnly = day.independentStarter.split('\n').every((line) => !line.trim() || line.trim().startsWith('#'))
          expect(day.independentStarter.trim().length).toBeGreaterThan(0)
          expect(/def [\s\S]*(?:\bpass\b|NotImplementedError)/.test(day.independentStarter) || commentsOnly).toBe(true)
          expect(day.independentStarter).not.toBe(day.workedExample)
          expect(day.checks).toHaveLength(3)
        } else if (day.kind === 'mock') {
          expect(day.variants).toHaveLength(3)
          for (const variant of day.variants) expect(variant.starter).toMatch(/def [\s\S]*(?:\bpass\b|NotImplementedError)/)
        } else {
          for (const previous of REFRESHER_DAYS) {
            if (previous.kind === 'practice') expect(previous.consolidation.starter).toMatch(/def [\s\S]*\bpass\b/)
          }
        }
        continue
      }
      const interactive =
        lesson.code.includes(BLANK) ||
        lesson.id === 'errors' ||
        lesson.id === 'python-for' ||
        lesson.id === 'infinite'
      expect(interactive).toBe(true)
    }
  })

  it('keeps every expanded AI Engineer lesson substantive and browser-local', () => {
    const legacyLastNumber = {
      intermediate: 20,
      ai: 16,
      api: 9,
      service: 3,
    } as const

    const legacyBeginner = new Set(['printing', 'variables', 'types', 'expressions', 'strings', 'booleans', 'conditionals', 'lists',
      'for-loops', 'while-loops', 'dicts', 'functions', 'errors', 'python-for', 'infinite', 'capstone'])
    const trackPosition = (lesson: (typeof LESSONS)[number]) => lessonsForDifficulty(lesson.difficulty).indexOf(lesson) + 1
    const expanded = LESSONS.filter((lesson) =>
      lesson.difficulty === 'beginner' ? !legacyBeginner.has(lesson.id) : trackPosition(lesson) > legacyLastNumber[lesson.difficulty],
    )
    expect(expanded).toHaveLength(174)

    for (const lesson of expanded) {
      expect(lesson.goal.length, lesson.id).toBeGreaterThan(80)
      expect(lesson.why?.length ?? 0, lesson.id).toBeGreaterThan(80)
      expect(lesson.tasks.length, lesson.id).toBeGreaterThanOrEqual(3)
      expect(lesson.code, lesson.id).toContain(BLANK)
      expect(lesson.stretch?.length ?? 0, lesson.id).toBeGreaterThan(75)
      expect(lesson.code, lesson.id).not.toMatch(
        /(?:import|from)\s+(?:requests|urllib)|https?:\/\//i,
      )
    }
  })

  it('labels lessons and headings', () => {
    const first = getLesson(DEFAULT_LESSON_ID)
    expect(lessonLabel(first)).toMatch(/^Day \d+ · /)
    expect(lessonHeading(first)).toMatch(/^Interview prep · Day /)
    expect(firstLessonId(DEFAULT_SECTION)).toBe(DEFAULT_LESSON_ID)
    expect(getLesson('mid-pattern-pick').bookChapter).toBe('dsa-sql')
    expect(getLesson('mid-sliding-window').id).toBe('mid-sliding-window')
    expect(getLesson('api-fastapi-dispatch').bookChapter).toBe('fastapi')
    expect(getLesson('api-fastapi-status').number).toBe(41)
    expect(getLesson('mid-stack-brackets').number).toBe(21)
  })

  it('groups lessons into chapters for the menu', () => {
    const groups = lessonsByChapter('python')
    expect(groups.length).toBeGreaterThanOrEqual(3)
    expect(groups[0]?.chapter).toBe('First steps')
    const ids = groups.flatMap((g) => g.lessons.map((l) => l.id))
    expect(ids).toContain('printing')
    expect(ids).toContain('capstone')

    expect(groups.map((g) => g.chapter)).toContain('Idiomatic Python')
    expect(lessonsByChapter('interview').map((g) => g.chapter)).toEqual([
      'Python foundations', 'Files, APIs & async', 'Interview practice & review', 'Array patterns', 'Data structures & algorithms',
    ])
    expect(lessonsByChapter('algorithms').map((g) => [g.chapter, g.lessons.length])).toEqual([
      ['Arrays & strings', 8], ['Searching & sorting', 3], ['Trees', 3], ['Graphs', 3], ['Dynamic programming', 5], ['Lists, stacks & recursion', 3],
    ])
    expect(lessonsByChapter('ml').map((g) => g.chapter)).toContain(
      'LLM apps & RAG',
    )
  })

  it('keeps every chapter a consecutive run of at least two lessons', () => {
    for (const { id } of SECTIONS) {
      expect(lessonsForSection(id).map((lesson) => lesson.number), id).toEqual(lessonsForSection(id).map((_, index) => index + 1))
      const groups = lessonsByChapter(id)
      expect(new Set(groups.map((g) => g.chapter)).size, id).toBe(groups.length)
      for (const group of groups) {
        if (id !== 'playground') expect(group.lessons.length, `${id}: ${group.chapter}`).toBeGreaterThanOrEqual(2)
        group.lessons.forEach((lesson, index) => {
          expect(lesson.number, `${id}: ${group.chapter}`).toBe(group.lessons[0].number + index)
        })
      }
    }
  })

  it('keeps every lesson id unique', () => {
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length)
  })

  it('includes compare pairs on repair labs', () => {
    expect(getLesson('errors').compare?.fixed).toContain('b = 2')
    expect(getLesson('python-for').compare?.fixed).toContain('range')
  })

  it('does not mark goals complete on stale runs or unfinished blanks', () => {
    const printing = getLesson('printing')
    const unfinished = evaluateGoal(printing, {
      code: printing.code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'Hello, world!' },
        { kind: 'print', text: 'x' },
      ],
      executedCode: printing.code,
    })
    expect(unfinished.met).toBe(false)
    expect(unfinished.missing.some((m) => /\?\?\?/.test(m) || /Replace/i.test(m))).toBe(
      true,
    )

    const code = 'print("a")\nprint("b")\n'
    const stale = evaluateGoal(printing, {
      code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'a' },
        { kind: 'print', text: 'b' },
      ],
      executedCode: 'print("old")\n',
    })
    expect(stale.met).toBe(false)
    expect(stale.missing.some((m) => /run again/i.test(m))).toBe(true)
  })

  it('marks printing complete only with two real prints of edited code', () => {
    const printing = getLesson('printing')
    const code = 'print("Hi Ada")\nprint("I code")\n'
    const finished = evaluateGoal(printing, {
      code,
      starterCode: printing.code,
      status: 'success',
      events: [
        { kind: 'print', text: 'Hi Ada' },
        { kind: 'print', text: 'I code' },
      ],
      executedCode: code,
    })
    expect(finished.met).toBe(true)
  })

  it('requires success for skill lessons', () => {
    const variables = getLesson('variables')
    const code = 'name = "Ada"\nprint(f"Hello, {name}!")\n'
    const failed = evaluateGoal(variables, {
      code,
      starterCode: variables.code,
      status: 'error',
      events: [],
      executedCode: code,
    })
    expect(failed.met).toBe(false)
  })
})

describe('playground', () => {
  it('is one free lesson with every full-stack tab and no checks', () => {
    const lessons = lessonsForSection('playground')
    expect(lessons.map((lesson) => lesson.id)).toEqual(['playground'])
    expect(lessons[0].goalCheck).toBeUndefined()
    expect(lessons[0].tasks).toEqual([])
    expect(lessons[0].fullstack?.calls.length).toBeGreaterThan(0)
    expect(lessons[0].code).not.toContain('???')
  })
})
