import { expect, it } from 'vitest'
import { reviewDesignPatterns } from './designPatterns'

it('locates structural matches across project files without executing them', () => {
  const result = reviewDesignPatterns({
    'factory.py': 'class Html: pass\nclass Pdf: pass\ndef exporter(kind):\n    if kind == "pdf": return Pdf()\n    return Html()',
    'tools/trace.py': 'def trace(func):\n    def wrapper(x): return func(x)\n    return wrapper',
    'client.py': 'class Reader:\n    def __init__(self, source): self.source = source\n    def read(self): return self.source.fetch()',
    'broken.py': 'def bad(:',
    'notes.txt': 'def trace(fn): pass',
  })
  expect(result.scanned).toBe(3)
  expect(result.matches.map(m => [m.pattern, m.locations[0]])).toEqual([
    ['Simple factory', { path: 'factory.py', line: 3 }],
    ['Function decorator', { path: 'tools/trace.py', line: 1 }],
    ['Adapter', { path: 'client.py', line: 3 }],
  ])
  expect(result.skipped).toEqual([{ path: 'broken.py', line: 1 }])
})

it('suggests Strategy only for independent functions sharing a conditional decision', () => {
  const dispatch = (name: string) => 'def ' + name + '(kind):\n    if kind == "json": return 1\n    elif kind == "csv": return 2'
  const files = { 'one.py': dispatch('first') }
  expect(reviewDesignPatterns(files).suggestions).toEqual([])
  const report = reviewDesignPatterns({ ...files, 'two.py': dispatch('second') })
  expect(report.suggestions).toHaveLength(1)
  expect(report.suggestions[0].locations).toEqual([{ path: 'one.py', line: 1 }, { path: 'two.py', line: 1 }])
  expect(report.matches).toEqual([])
})

it('ignores suggestive names, comments and nested returns belonging to another function', () => {
  const result = reviewDesignPatterns({ 'a.py': '# @decorator\nclass Adapter: pass\nclass Factory: pass\ndef outer(x):\n    def inner(): return x()\n    return 2' })
  expect(result.matches).toEqual([])
})

it('resolves local classes imported across files with relative names and aliases', () => {
  const result = reviewDesignPatterns({
    'pkg/formats.py': 'class Html: pass\nclass Pdf: pass',
    'pkg/service.py': 'from .formats import Html as Web, Pdf\ndef select(kind):\n    if kind == "web": return Web()\n    return Pdf()',
  })
  expect(result.matches).toMatchObject([{ pattern: 'Simple factory', locations: [{ path: 'pkg/service.py', line: 2 }] }])
})
