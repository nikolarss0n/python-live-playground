import { describe, expect, it } from 'vitest'
import type { ResultEvent } from '../execution/protocol'
import { loopSlots } from './loopSlots'

const print = (line: number, text = 'x') => ({ kind: 'print', text, line }) as ResultEvent

describe('loopSlots', () => {
  const code = [
    'mails = ["maria@g.com", "sam@w.de", "j@o.com", "kumar@s.de"]',
    'for mail in mails:',
    '    if len(mail) < 8:',
    '        print("short")',
    '    else:',
    '        print("long")',
    'print("done")',
  ].join('\n')

  it('counts every round of the loop, whichever branch printed', () => {
    const slots = loopSlots([print(6), print(6), print(4), print(6), print(7)], code)
    expect(slots.slice(0, 4).map((slot) => slot && [slot.iteration, slot.total, slot.line])).toEqual([
      [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
    ])
    expect(slots[0]?.first).toBe(true)
    expect(slots[3]?.last).toBe(true)
    expect(slots[4]).toBeNull()
  })

  it('keeps two prints of one round together under one round number', () => {
    const twoPerRound = 'for i in range(2):\n    print(i)\n    print(i * 2)\n'
    const slots = loopSlots([print(2), print(3), print(2), print(3)], twoPerRound)
    expect(slots.map((slot) => slot && [slot.iteration, slot.total, slot.firstInRound])).toEqual([
      [1, 2, true], [1, 2, false], [2, 2, true], [2, 2, false],
    ])
  })

  it('falls back to repeats of one line without the source, or outside a loop', () => {
    expect(loopSlots([print(3), print(3), print(5)]).map((slot) => slot?.total ?? null)).toEqual([2, 2, null])
    expect(loopSlots([print(4)], code)).toEqual([null])
  })
})
