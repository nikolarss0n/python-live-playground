import { describe, expect, it } from 'vitest'
import { computeStackedTops } from './resultAlignment'

describe('computeStackedTops', () => {
  it('places rows at their targets when there is room', () => {
    expect(computeStackedTops([10, 40, 80], [12, 12, 12], 2)).toEqual([
      10, 40, 80,
    ])
  })

  it('stacks when targets would overlap', () => {
    // second target sits inside first row band → stack below
    expect(computeStackedTops([0, 5], [20, 20], 4)).toEqual([0, 24])
  })

  it('treats null targets as pure stack', () => {
    expect(computeStackedTops([null, null], [10, 10], 2)).toEqual([0, 12])
  })

  it('never goes negative', () => {
    expect(computeStackedTops([-20, 5], [8, 8], 2)).toEqual([0, 10])
  })
})
