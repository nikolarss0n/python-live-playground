import { describe, expect, it } from 'vitest'
import { branchesOf } from './branchOf'

describe('branchesOf', () => {
  it('names the if and else that each line sits in', () => {
    const code = [
      'mails = ["a@b.com",',
      '  "cd@e.de"]',
      'for mail in mails:',
      '    n = len(mail)',
      '    if n == 1:',
      '        print("*")',
      '    elif n == 2:',
      '        print("**")',
      '    else:',
      '        # masked',
      '        print(mail[0])',
      'print("done")',
    ].join('\n')
    const branches = branchesOf(code)
    expect(branches.get(6)).toEqual({ keyword: 'if', line: 5, chain: 5 })
    expect(branches.get(8)).toEqual({ keyword: 'elif', line: 7, chain: 5 })
    expect(branches.get(11)).toEqual({ keyword: 'else', line: 9, chain: 5 })
    expect(branches.get(2)).toBeUndefined()
    expect(branches.get(4)).toBeUndefined()
    expect(branches.get(12)).toBeUndefined()
  })

  it('gives a loop inside a branch to the loop, and ignores colons in strings', () => {
    const code = 'if True:\n    for i in range(2):\n        print(i)\n    print("a: b")\n'
    const branches = branchesOf(code)
    expect(branches.get(3)).toBeUndefined()
    expect(branches.get(4)).toEqual({ keyword: 'if', line: 1, chain: 1 })
  })
})
