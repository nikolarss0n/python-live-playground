/**
 * Completions after `name.`: methods for dicts, lists, strings and sets (guessed from how the name is assigned or
 * annotated) and members of common standard-library modules the code imports. Static, so it works before any run.
 */

import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { pythonLanguage } from '@codemirror/lang-python'

type Kind = 'dict' | 'list' | 'str' | 'set'

const METHODS: Record<Kind, readonly (readonly [string, string])[]> = {
  dict: [['get', '(key, default=None)'], ['items', '()'], ['keys', '()'], ['values', '()'], ['pop', '(key, default)'], ['setdefault', '(key, default=None)'],
    ['update', '(other)'], ['copy', '()'], ['clear', '()'], ['popitem', '()']],
  list: [['append', '(item)'], ['extend', '(items)'], ['insert', '(index, item)'], ['pop', '(index=-1)'], ['remove', '(item)'], ['index', '(item)'],
    ['count', '(item)'], ['sort', '(key=None, reverse=False)'], ['reverse', '()'], ['copy', '()'], ['clear', '()']],
  str: [['split', '(sep=None)'], ['join', '(items)'], ['strip', '()'], ['lower', '()'], ['upper', '()'], ['replace', '(old, new)'], ['startswith', '(prefix)'],
    ['endswith', '(suffix)'], ['find', '(sub)'], ['format', '(*args)'], ['count', '(sub)'], ['isdigit', '()'], ['title', '()'], ['splitlines', '()'],
    ['lstrip', '()'], ['rstrip', '()']],
  set: [['add', '(item)'], ['discard', '(item)'], ['remove', '(item)'], ['union', '(other)'], ['intersection', '(other)'], ['difference', '(other)'],
    ['issubset', '(other)'], ['pop', '()'], ['clear', '()'], ['copy', '()']],
}

const MODULES: Record<string, readonly string[]> = {
  asyncio: ['run', 'gather', 'wait_for', 'sleep', 'create_task', 'TimeoutError', 'Queue', 'Lock', 'Semaphore', 'as_completed', 'wait'],
  json: ['dumps', 'loads', 'dump', 'load', 'JSONDecodeError'],
  time: ['perf_counter', 'time', 'sleep', 'monotonic', 'strftime'],
  inspect: ['signature', 'Parameter', 'isfunction', 'iscoroutinefunction', 'getsource', 'getdoc'],
  math: ['sqrt', 'floor', 'ceil', 'pi', 'inf', 'isclose', 'log', 'exp', 'pow', 'fabs', 'gcd'],
  random: ['random', 'randint', 'choice', 'choices', 'shuffle', 'sample', 'seed', 'uniform'],
  re: ['search', 'match', 'fullmatch', 'findall', 'finditer', 'sub', 'split', 'compile', 'IGNORECASE'],
  collections: ['Counter', 'defaultdict', 'deque', 'namedtuple', 'OrderedDict', 'ChainMap'],
  itertools: ['chain', 'product', 'permutations', 'combinations', 'groupby', 'islice', 'count', 'accumulate', 'zip_longest'],
  functools: ['lru_cache', 'cache', 'partial', 'reduce', 'wraps'],
  heapq: ['heappush', 'heappop', 'heapify', 'nlargest', 'nsmallest'],
  uuid: ['uuid4', 'UUID'],
  datetime: ['datetime', 'date', 'timedelta', 'timezone'],
  dataclasses: ['dataclass', 'field', 'asdict'],
  typing: ['Any', 'Callable', 'Optional', 'Protocol', 'TypedDict', 'Literal'],
}

const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Best guess at a variable's kind from its last assignment or annotation. */
export function guessKind(code: string, name: string): Kind | null {
  const pattern = new RegExp(`(?:^|[\\s(,])${escape(name)}\\s*(?::\\s*([A-Za-z_][\\w.]*))?[^=\\n]*?=(?!=)\\s*(.*)$|(?:^|[\\s(,])${escape(name)}\\s*:\\s*([A-Za-z_][\\w.]*)`, 'gm')
  let kind: Kind | null = null
  for (const match of code.matchAll(pattern)) {
    kind = fromAnnotation(match[1] ?? match[3]) ?? (match[2] !== undefined ? fromValue(match[2]) : null) ?? kind
  }
  return kind
}

function fromAnnotation(annotation: string | undefined): Kind | null {
  const base = annotation?.toLowerCase().replace(/^typing\./, '')
  if (!base) return null
  if (base === 'dict' || base === 'defaultdict' || base === 'counter' || base === 'mapping') return 'dict'
  if (base === 'list' || base === 'sequence') return 'list'
  if (base === 'str') return 'str'
  if (base === 'set' || base === 'frozenset') return 'set'
  return null
}

function fromValue(value: string): Kind | null {
  const text = value.trim()
  if (text.startsWith('{')) return text === '{' || text.startsWith('{}') || /^\{\s*("[^"]*"|'[^']*'|\w+)\s*:/.test(text) || text.startsWith('{**') ? 'dict' : 'set'
  if (text.startsWith('[')) return 'list'
  if (/^[rbfu]{0,2}["']/i.test(text)) return 'str'
  if (/^(dict|defaultdict|Counter|OrderedDict|collections\.(defaultdict|Counter|OrderedDict))\(/.test(text)) return 'dict'
  if (/^(list|sorted)\(/.test(text)) return 'list'
  if (/^(set|frozenset)\(/.test(text)) return 'set'
  if (/^str\(/.test(text)) return 'str'
  return null
}

/** Module a name refers to through `import x` or `import x as name`. */
export function importedModule(code: string, name: string): string | null {
  for (const match of code.matchAll(/^\s*import\s+(.+)$/gm)) {
    for (const part of match[1].split(',')) {
      const [module, alias] = part.trim().split(/\s+as\s+/)
      if ((alias ?? module) === name && MODULES[module]) return module
    }
  }
  return null
}

export function dotCompletions(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/[A-Za-z_]\w*\.\w*$/)
  if (!before) return null
  const name = before.text.slice(0, before.text.indexOf('.'))
  const charBefore = context.state.sliceDoc(before.from - 1, before.from)
  if (charBefore === '.' || /\d/.test(name[0])) return null
  const code = context.state.doc.toString()
  const from = before.from + name.length + 1
  const module = importedModule(code, name)
  if (module) {
    return { from, validFor: /^\w*$/, options: MODULES[module].map((label): Completion => ({ label, type: /^[A-Z]/.test(label) ? 'class' : 'function', detail: module })) }
  }
  const kind = guessKind(code, name)
  if (!kind) return null
  return { from, validFor: /^\w*$/, options: METHODS[kind].map(([label, detail]): Completion => ({ label, type: 'method', detail, boost: label === 'get' ? 1 : 0 })) }
}

export function dotCompletionExtension() {
  return pythonLanguage.data.of({ autocomplete: dotCompletions })
}
