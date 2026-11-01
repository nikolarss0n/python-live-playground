import { describe, expect, it } from 'vitest'
import { explainSlot } from './blankSlot'

function at(code: string) {
  return explainSlot(code, code.indexOf('???'))
}

describe('explainSlot', () => {
  it('reads the role of the blank from the line around it', () => {
    expect(at('def f(x):\n    return ???\n').what).toMatch(/`f` should hand back/)
    expect(at('for n in ???:\n    print(n)\n').what).toMatch(/loop over/)
    expect(at('try:\n    int("x")\nexcept ???:\n    pass\n').what).toMatch(/type of error/)
    expect(at('people.sort(key=???)\n').why).toMatch(/lambda/)
    expect(at('hours = minutes ??? 60\n').what).toBe('An operator.')
    expect(at('person = {\n    "name": ???,\n}\n').what).toMatch(/`name` key/)
    expect(at('count += ???\n').why).toMatch(/count = count \+ n/)
  })

  it('points at names the learner can use', () => {
    expect(at('import ???\nmath.sqrt(4)\n').clues.join(' ')).toMatch(/`math\.`/)
    expect(at('from math import ???\nsqrt(16)\n').clues.join(' ')).toMatch(/`sqrt`/)
    expect(at('score = 70\npassing = 60\nif ???:\n    print("pass")\n').clues.join(' ')).toMatch(/`passing`, `score`/)
    expect(at('n = 0\nwhile n < 5:\n    n = ???\n').what).toMatch(/new value for `n`/)
  })
})
