import { describe, expect, it } from 'vitest'
import { guessKind, importedModule } from './dotCompletion'

describe('dot completion', () => {
  it('guesses a variable kind from its assignment or annotation', () => {
    expect(guessKind('TOOLS = {\n    "a": f,\n}', 'TOOLS')).toBe('dict')
    expect(guessKind('DONE: dict[str, dict] = {}', 'DONE')).toBe('dict')
    expect(guessKind('WRITE_TOOLS = {"pay", "move"}', 'WRITE_TOOLS')).toBe('set')
    expect(guessKind('used = []', 'used')).toBe('list')
    expect(guessKind('name = f"x"', 'name')).toBe('str')
    expect(guessKind('def f(args: dict, n: int):\n    pass', 'args')).toBe('dict')
    expect(guessKind('if x == 1:\n    pass', 'x')).toBeNull()
  })

  it('finds imported modules, including aliases', () => {
    expect(importedModule('import asyncio\nimport json as j', 'asyncio')).toBe('asyncio')
    expect(importedModule('import asyncio\nimport json as j', 'j')).toBe('json')
    expect(importedModule('import playdb', 'playdb')).toBeNull()
  })
})
