import { describe, expect, it } from 'vitest'
import { explainToken } from './codeExplain'

const CODE = `import math
from collections import Counter

class Counter2:
    def __init__(self, start=0):
        self.value = start

    def bump(self, step):
        self.value += step
        return self.value

counts = Counter("abca")
for name, total in counts.items():
    print(name, math.sqrt(total))
`

const at = (word: string, nth = 0) => {
  let index = -1
  for (let i = 0; i <= nth; i++) index = CODE.indexOf(word, index + 1)
  return explainToken(CODE, index + 1)
}

describe('explainToken', () => {
  it('explains __init__ and self', () => {
    expect(at('__init__')).toMatchObject({ kind: 'special method' })
    expect(at('__init__')?.text).toMatch(/automatically/)
    const self = at('self')
    expect(self?.kind).toBe('parameter')
    expect(self?.origin).toMatch(/`__init__` in class `Counter2`/)
  })

  it('says where the learner’s own names come from', () => {
    expect(at('start', 1)?.origin ?? at('start', 1)?.text).toMatch(/Parameter of `__init__` \(line 5\).*0/)
    expect(at('step', 1)?.text).toMatch(/Parameter of `bump`/)
    expect(at('name', 1)?.text).toMatch(/Loop variable from line 13.*counts.items\(\)/)
    expect(at('counts', 1)?.text).toMatch(/Variable set on line 12/)
    expect(at('Counter(')?.origin).toMatch(/Imported from `collections` on line 2/)
    expect(at('Counter2')?.text).toMatch(/Class defined on line 4/)
  })

  it('explains attributes, methods, keywords, built-ins and modules', () => {
    expect(at('value', 1)).toMatchObject({ kind: 'attribute', origin: 'First set on line 6.' })
    expect(at('items')).toMatchObject({ kind: 'method' })
    expect(at('sqrt')?.text).toMatch(/Square root/)
    expect(at('return')?.kind).toBe('keyword')
    expect(at('print')?.kind).toBe('built-in')
    expect(at('math', 1)?.kind).toBe('module')
  })

  it('ignores numbers and unknown words', () => {
    expect(explainToken('x = 42', 5)).toBeNull()
    expect(explainToken('mystery()', 2)).toBeNull()
  })
})
