import { describe, expect, it } from 'vitest'
import { blankHints, hintLevels } from './blankHints'
import { getLesson, LESSONS } from './examples'

describe('blankHints', () => {
  const lesson = getLesson('mid-enumerate-zip')

  it('explains each blank, then gives its task, then the answer', () => {
    const hints = blankHints(lesson, lesson.code)
    expect(hints).toHaveLength(3)
    expect(hints[0].steps[0].text).toMatch(/start counting/)
    expect(hints[0].steps[0].detail).toMatch(/counts from 0/)
    expect(hints[0].steps[1].text).toBe('Task: Finish enumerate so numbering starts at 1')
    expect(hints[1].steps[0].text).toMatch(/zip\(\)/)
    expect(hints[1].steps[1].detail).toMatch(/Pass names and years to zip/)
    expect(hints.map((hint) => hint.answer)).toEqual(['1', 'names', 'years'])
    expect(hintLevels(hints[0])).toBe(3)
    expect(lesson.code.slice(hints[2].from, hints[2].to)).toBe('???')
  })

  it('tells identical lines apart and names the parameters in scope', () => {
    const counter = getLesson('mid-classes')
    const hints = blankHints(counter, counter.code)
    expect(hints.map((hint) => hint.answer)).toEqual(['start', 'self.value + step'])
    expect(hints[0].steps[0].detail).toMatch(/__init__.*parameter `start`/)
    expect(hints[1].steps[0].detail).toMatch(/parameter `step`/)
  })

  it('keeps answers on the right blank after earlier blanks are filled', () => {
    const code = lesson.code.replace('start=???', 'start=1').replace('zip(???, ???)', 'zip(names, ???)')
    const hints = blankHints(lesson, code)
    expect(hints.map((hint) => [hint.starterIndex, hint.answer])).toEqual([[2, 'years']])
  })

  it('drops the answer when the blank line no longer resembles the starter', () => {
    const hints = blankHints(lesson, '???\n')
    expect(hints).toHaveLength(1)
    expect(hints[0].answer).toBeUndefined()
    expect(hints[0].steps.length).toBeGreaterThan(0)
  })

  it('offers at least one nudge for every starter blank in every lesson', () => {
    for (const each of LESSONS) {
      for (const hint of blankHints(each, each.code)) expect(hint.steps[0]?.text.trim(), each.id).toBeTruthy()
    }
  })
})

describe('algorithm hint layers', () => {
  it('climbs from the idea to the shape of the code instead of giving the answer', () => {
    const lesson = getLesson('algo-two-sum')
    const hints = blankHints(lesson, lesson.code)
    expect(hints).toHaveLength(1)
    expect(hints[0].answer).toBeUndefined()
    expect(hints[0].steps.map((step) => step.kicker)).toEqual(['The idea', 'What to use', 'Plan', 'Shape of the code'])
    expect(hints[0].steps[1].text).toContain('set')
  })

  it('has a ladder for every algorithm lesson, whose body starts empty', async () => {
    const { ALGORITHM_LAYERS } = await import('./curriculum/algorithmLayers')
    for (const each of LESSONS.filter((lesson) => lesson.id.startsWith('algo-'))) {
      expect(ALGORITHM_LAYERS[each.id], each.id).toBeDefined()
      expect(each.code.split('???').length - 1, each.id).toBe(1)
      expect(each.code, each.id).toMatch(/:\n(?:    """.*"""\n)?(?:    #.*\n)*    \?\?\?\n/)
    }
  })
})
