/**
 * Local, deterministic diagnosis of Python errors: maps each error message (plus Python's reported column and call
 * frames) to the exact place to edit, a reason, and a corrected line when the fix is unambiguous. Returns null when the
 * message alone cannot locate the problem; Jev handles those.
 */

import type { ErrorFrame } from '../execution/protocol'
import {
  BUILTINS, CLOSERS, definedNames, deleteToken, explainPinpoint, FOREIGN, KEYWORDS, lineEnd, METHODS,
  missingSeparator, nearest, own, replaceRange, tokenizeLine, type Candidate, type Mistake, type Pinpoint,
} from './pinpoint'

export type DiagnoseInput = {
  code: string
  message: string
  line?: number
  column?: number | null
  endColumn?: number | null
  frames?: readonly ErrorFrame[]
}

type Token = { from: number; to: number; text: string }

const STDLIB = ['array', 'asyncio', 'base64', 'bisect', 'calendar', 'collections', 'contextlib', 'copy', 'csv', 'dataclasses',
  'datetime', 'decimal', 'enum', 'fractions', 'functools', 'hashlib', 'heapq', 'html', 'io', 'itertools', 'json', 'logging',
  'math', 'operator', 'os', 'pathlib', 'pprint', 'random', 're', 'statistics', 'string', 'sys', 'textwrap', 'time', 'timeit',
  'typing', 'unittest', 'urllib', 'uuid', 'zoneinfo']
const TYPE_METHODS: Record<string, string[]> = {
  list: ['append', 'clear', 'copy', 'count', 'extend', 'index', 'insert', 'pop', 'remove', 'reverse', 'sort'],
  str: ['capitalize', 'count', 'endswith', 'find', 'format', 'index', 'isalpha', 'isdigit', 'islower', 'isspace', 'isupper', 'join', 'lower',
    'lstrip', 'replace', 'rstrip', 'split', 'splitlines', 'startswith', 'strip', 'title', 'upper', 'zfill'],
  dict: ['clear', 'copy', 'get', 'items', 'keys', 'pop', 'popitem', 'setdefault', 'update', 'values'],
  set: ['add', 'clear', 'copy', 'difference', 'discard', 'intersection', 'issubset', 'pop', 'remove', 'union', 'update'],
  tuple: ['count', 'index'],
  int: ['bit_length', 'to_bytes'],
  float: ['as_integer_ratio', 'is_integer'],
}
const MODULE_MEMBERS: Record<string, string[]> = {
  math: ['ceil', 'comb', 'cos', 'degrees', 'e', 'exp', 'factorial', 'floor', 'fsum', 'gcd', 'hypot', 'inf', 'isclose', 'isqrt', 'log', 'log10',
    'log2', 'pi', 'pow', 'prod', 'radians', 'sin', 'sqrt', 'tan', 'trunc'],
  random: ['choice', 'choices', 'randint', 'random', 'randrange', 'sample', 'seed', 'shuffle', 'uniform'],
  collections: ['ChainMap', 'Counter', 'OrderedDict', 'defaultdict', 'deque', 'namedtuple'],
  itertools: ['accumulate', 'chain', 'combinations', 'count', 'cycle', 'groupby', 'islice', 'permutations', 'product', 'repeat', 'zip_longest'],
  json: ['dump', 'dumps', 'load', 'loads'],
  datetime: ['date', 'datetime', 'time', 'timedelta', 'timezone'],
  dataclasses: ['asdict', 'dataclass', 'field', 'fields'],
  typing: ['Any', 'Callable', 'Iterable', 'Optional', 'Protocol', 'TypedDict', 'Union'],
  statistics: ['mean', 'median', 'mode', 'pstdev', 'stdev', 'variance'],
  functools: ['cache', 'lru_cache', 'partial', 'reduce', 'wraps'],
  string: ['ascii_letters', 'ascii_lowercase', 'ascii_uppercase', 'digits', 'punctuation'],
}
const MUTATORS = ['append', 'extend', 'insert', 'sort', 'reverse', 'clear', 'remove', 'update', 'add', 'shuffle']
const OTHER_ERRORS: Record<string, string> = {
  FileNotFoundError: 'This file does not exist in the browser. Check the name, or create the file before opening it.',
  PermissionError: 'Python is not allowed to open this path here.',
  OverflowError: 'The number got too large for this operation. Use smaller values or an integer instead of a float.',
  StopIteration: '`next()` ran past the last item. Use a `for` loop, or give `next()` a default value.',
  NotImplementedError: 'This part is a placeholder that raises on purpose. Write its body.',
  UnicodeDecodeError: 'These bytes are not valid text in this encoding. Pass the right `encoding=`, or read the data as bytes.',
  UnicodeEncodeError: 'This text has characters the chosen encoding cannot store. Use `encoding="utf-8"`.',
  MemoryError: 'This builds something too large to fit in memory. Make it smaller or process it in pieces.',
  LookupError: 'The key or position looked up here does not exist.',
  ArithmeticError: 'This calculation is not possible with these values.',
  RuntimeError: 'This operation is not allowed at this point, such as changing a dict while looping over it.',
}
const ORDINALS: Record<string, string> = { '1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth' }
const code = (value: string) => `\`${value}\``
const word = (value: string) => /^[A-Za-z_]\w*$/.test(value)
const indentOf = (text: string) => text.length - text.trimStart().length

export function diagnose(input: DiagnoseInput): Pinpoint | null {
  return traceOrigin(input) ?? diagnoseLine(input)
}

type Origin = { line: number; from: number; to: number; text: string }
const STRING_LITERAL = /^[rRbBuU]?(["'])(.*)\1$/

/**
 * When Python stops inside a function because of a bad value (text where a number belongs, or None), follow that value
 * back through the traceback: parameter → argument at the call site → the assignment or list item it came from.
 */
function traceOrigin(input: DiagnoseInput): Pinpoint | null {
  const frames = (input.frames ?? []).filter((frame) => frame.line >= 1)
  if (frames.length < 2 || !input.line) return null
  const detail = input.message.trim().split(/\r?\n/).at(-1) ?? ''
  if (!/^(TypeError|AttributeError)\b/.test(detail)) return null
  const want: 'none' | 'text' | null = /NoneType/.test(detail) ? 'none' : /'str'|\bstr\b|multiply sequence/.test(detail) ? 'text' : null
  if (!want) return null
  const lines = input.code.split(/\r\n|\n|\r/)
  const textOf = (line: number) => lines[line - 1] ?? ''
  const matches = (value: string) => want === 'none' ? value === 'None' : STRING_LITERAL.test(value)
  const parametersOf = (name: string) => {
    const header = lines.find((line) => new RegExp(`^\\s*def\\s+${escape(name)}\\s*\\(`).test(line))
    return header ? (/\(([^)]*)\)/.exec(header)?.[1] ?? '').split(',').map((entry) => entry.split(/[=:]/)[0].trim().replace(/^\*+/, '')).filter(Boolean) : []
  }
  const at = (line: number, from: number, value: string): Origin => ({ line, from, to: from + value.length, text: value })

  /** Where `expression` (read on `line`, inside frame `depth`) got its bad value; `element` means one item of it. */
  function resolve(expression: string, line: number, depth: number, element: boolean, seen: Set<string>): Origin | null {
    const value = expression.trim()
    const key = `${value}@${line}`
    if (seen.has(key) || seen.size > 24) return null
    seen.add(key)
    if (!element && matches(value)) return at(line, textOf(line).indexOf(value), value)
    if (/^\[.*\]$/.test(value)) {
      const items = callArguments(`f(${value.slice(1, -1)})`, 'f')?.args ?? []
      const bad = items.find(matches)
      return bad ? at(line, textOf(line).indexOf(bad, textOf(line).indexOf(value)), bad) : null
    }
    const keyed = /^([A-Za-z_]\w*)\[\s*(["'])(.+?)\2\s*\]$/.exec(value)
    if (keyed) {
      for (let index = line - 1; index >= 1; index -= 1) {
        const entry = new RegExp(`^\\s*${keyed[1]}\\s*=\\s*\\{.*?(["'])${escape(keyed[3])}\\1\\s*:\\s*([^,}]+)`).exec(textOf(index))
        if (entry) { const found = entry[2].trim(); return matches(found) ? at(index, textOf(index).indexOf(found, entry.index + entry[0].length - entry[2].length), found) : null }
      }
      return null
    }
    if (!word(value) || KEYWORDS.includes(value)) return null
    const frame = frames[depth]
    const loop = new RegExp(`\\bfor\\s+${value}\\s+in\\s+([^:\\]\\)]+?)\\s*(?:\\]|\\)|:|\\bif\\b|$)`).exec(textOf(line))
    if (loop) return resolve(loop[1], line, depth, true, seen)
    const header = (() => {
      for (let index = line - 1; index >= 1; index -= 1) {
        const loopHeader = new RegExp(`^\\s*for\\s+${value}\\s+in\\s+(.+?)\\s*:`).exec(textOf(index))
        if (loopHeader && indentOf(textOf(index)) < indentOf(textOf(line))) return { index, iterable: loopHeader[1] }
        if (/^\s*def\s/.test(textOf(index))) return null
      }
      return null
    })()
    if (header) return resolve(header.iterable, header.index, depth, true, seen)
    for (let index = line - 1; index >= 1; index -= 1) {
      const text = textOf(index)
      const assigned = new RegExp(`^\\s*${value}\\s*=(?!=)\\s*(.+?)\\s*(#.*)?$`).exec(text)
      if (assigned) return resolve(assigned[1], index, depth, element, seen)
      if (frame && frame.name !== '<module>' && new RegExp(`^\\s*def\\s+${escape(frame.name)}\\s*\\(`).test(text)) break
    }
    if (!frame || frame.name === '<module>' || depth === 0) return null
    const position = parametersOf(frame.name).indexOf(value)
    if (position < 0) return null
    const caller = frames[depth - 1]
    const call = callArguments(textOf(caller.line), frame.name)
    if (!call) return null
    const named = call.args.find((arg) => new RegExp(`^${value}\\s*=(?!=)`).test(arg))
    const argument = named ? named.replace(/^\w+\s*=\s*/, '') : call.args.filter((arg) => !/^\w+\s*=(?!=)/.test(arg))[position]
    return argument === undefined ? null : resolve(argument, caller.line, depth - 1, element, seen)
  }

  const innermost = frames.length - 1
  const errorLine = input.line
  const reported = textOf(errorLine)
  const names = [...new Set(tokenizeLine(reported).map((token) => token.text).filter((name) => word(name) && !KEYWORDS.includes(name) && !BUILTINS.includes(name)))]
  const parameters = parametersOf(frames[innermost].name)
  const quotedNumber = (origin: Origin) => /^-?\d+(\.\d+)?$/.test(STRING_LITERAL.exec(origin.text)?.[2] ?? '')
  const origins = names.filter((entry) => parameters.includes(entry))
    .map((name) => ({ name, origin: resolve(name, errorLine, innermost, false, new Set()) }))
    .filter((entry): entry is { name: string; origin: Origin } => entry.origin !== null && entry.origin.line !== errorLine && entry.origin.from >= 0)
    .sort((a, b) => Number(quotedNumber(b.origin)) - Number(quotedNumber(a.origin)))
  for (const { name, origin } of origins) {
    const number = want === 'text' && /^-?\d+(\.\d+)?$/.test(STRING_LITERAL.exec(origin.text)?.[2] ?? '')
    const fixedLine = number ? replaceRange(textOf(origin.line), origin.from, origin.to, STRING_LITERAL.exec(origin.text)![2]) : undefined
    const what = want === 'none' ? `${code('None')}` : `${code(origin.text)} is text`
    const message = `${want === 'none' ? `${what} starts here` : what}, and it reaches ${code(name)} in ${code(`${frames[innermost].name}()`)}, where line ${input.line} fails. ${
      want === 'none' ? 'Give it a real value here, or check for None before using it.' : number ? 'Remove the quotes to make it a number.' : 'Pass a value of the right type.'}`
    return { line: origin.line, from: origin.from, to: origin.to, mistake: 'wrong_type', message, confidence: 1, ...(fixedLine !== undefined ? { fixedLine } : {}) }
  }
  return null
}

function diagnoseLine(input: DiagnoseInput): Pinpoint | null {
  const lines = input.code.split(/\r\n|\n|\r/)
  const last = input.message.trim().split(/\r?\n/).at(-1) ?? ''
  const parsed = /^([A-Za-z_][\w.]*)(?::\s*(.*))?$/s.exec(last)
  const type = parsed?.[1].split('.').at(-1) ?? ''
  const detail = (parsed?.[2] ?? '').replace(/\s*\(<[^>]+>, line \d+\)\s*$/, '')
  const reported = input.line && input.line >= 1 && input.line <= lines.length ? input.line : undefined
  const textOf = (line: number) => lines[line - 1] ?? ''
  const tokensOf = (line: number) => tokenizeLine(textOf(line))

  const pin = (line: number, from: number, to: number, mistake: Mistake, message: string, fixedLine?: string, fixLine?: number): Pinpoint => {
    const target = fixLine ?? line
    return {
      line, from, to, mistake, message, confidence: 1,
      ...(fixedLine !== undefined && fixedLine !== textOf(target) ? { fixedLine } : {}),
      ...(fixLine !== undefined && fixLine !== line ? { fixLine } : {}),
    }
  }
  const explain = (line: number, token: Token | null, kind: Candidate['kind'], mistake: Mistake) => {
    const text = textOf(line)
    const position = kind === 'eol' ? lineEnd(text) : 0
    const candidate: Candidate = token
      ? { id: 'local', line, ...token, kind }
      : { id: 'local', line, from: kind === 'indent' ? 0 : position, to: kind === 'indent' ? indentOf(text) : position, text: kind === 'indent' ? text.slice(0, indentOf(text)) : '', kind }
    return { ...explainPinpoint(input.code, candidate, mistake, 1, reported), confidence: 1 }
  }
  /** The token Python pointed at with its column, if it lies on the reported line. */
  const atColumn = (): Token | null => {
    if (!reported || input.column == null) return null
    const tokens = tokensOf(reported)
    const end = input.endColumn ?? input.column + 1
    return tokens.find((token) => token.from <= input.column! && token.to > input.column!) ??
      tokens.find((token) => token.from >= input.column! && token.from < end) ?? null
  }
  /** The span Python reported (a whole expression such as `items[3]`), clipped to the line. */
  const reportedSpan = (): { from: number; to: number } | null => {
    if (!reported || input.column == null || input.endColumn == null) return null
    const text = textOf(reported)
    return input.column < input.endColumn && input.endColumn <= text.length ? { from: input.column, to: input.endColumn } : null
  }
  const find = (line: number, value: string, within?: { from: number; to: number } | null): Token | null => {
    const tokens = tokensOf(line).filter((token) => token.text === value)
    return (within && tokens.find((token) => token.from >= within.from && token.to <= within.to)) ?? tokens[0] ?? null
  }
  const quoted = (pattern: RegExp) => pattern.exec(detail)?.[1]

  if (!reported) return null
  const text = textOf(reported)
  const span = reportedSpan()

  switch (type) {
    case 'SyntaxError':
      return syntax()
    case 'IndentationError':
      return indentation()
    case 'TabError': {
      const fixedCode = respace(lines).join('\n')
      return { ...pin(reported, 0, indentOf(text), 'wrong_indentation', `Line ${reported} mixes tabs and spaces. Use 4 spaces for each level; the fix re-indents every line that way.`),
        fixedLine: fixedCode.split('\n')[reported - 1], fixedCode }
    }
    case 'NameError':
      return nameError()
    case 'UnboundLocalError':
      return unboundLocal()
    case 'AttributeError':
      return attributeError()
    case 'TypeError':
      return typeError()
    case 'IndexError':
      return indexError()
    case 'KeyError':
      return keyError()
    case 'ZeroDivisionError':
      return zeroDivision()
    case 'ValueError':
      return valueError()
    case 'ModuleNotFoundError':
    case 'ImportError':
      return importError()
    case 'RecursionError':
      return recursion()
    case 'TimeoutError':
      return loop()
    case 'AssertionError': {
      const token = find(reported, 'assert')
      return token ? pin(reported, token.from, text.trimEnd().length, 'other',
        `This ${code('assert')} is false when the code runs${detail ? `: ${detail}` : ''}. Print the values it compares to see which one is different.`) : null
    }
    default:
      return null
  }

  function syntax(): Pinpoint | null {
    const elseIf = /\belse\s+if\b/.exec(text)
    if (elseIf) return explain(reported!, { from: elseIf.index, to: elseIf.index + 4, text: 'else' }, 'token', 'foreign_syntax')
    if (/^expected ':'/.test(detail)) return explain(reported!, null, 'eol', 'missing_colon')
    if (/^'\{' was never closed/.test(detail) && tokensOf(reported!).at(-1)?.text === '{' && /^\s*(if|elif|else|while|for|def|class|try|except|finally|with)\b/.test(text)) {
      return explain(reported!, tokensOf(reported!).at(-1)!, 'token', 'foreign_syntax')
    }
    if (/was never closed/.test(detail) || /^unterminated string literal/.test(detail)) {
      const result = explain(reported!, null, 'eol', 'missing_closing')
      if (result.fixedLine !== undefined) return result
      const opener = quoted(/^'(.)' was never closed/)
      const token = opener ? [...tokensOf(reported!)].reverse().find((entry) => entry.text === opener) : null
      return token ? pin(reported!, token.from, token.to, 'missing_closing', `This ${code(opener!)} is never closed. Add ${code(own(CLOSERS, opener!) ?? opener!)} where the expression ends.`) : result
    }
    if (/^unterminated triple-quoted string/.test(detail)) {
      return pin(reported!, indentOf(text), text.trimEnd().length, 'missing_closing', 'This triple-quoted string is never closed. Add the same three quotes where the text ends.')
    }
    const unmatched = quoted(/^unmatched '(.)'/)
    if (unmatched) {
      const extra = strayCloser(text)
      if (extra) return pin(reported!, extra.from, extra.to, 'extra_token', `${code(extra.text)} has no matching opening bracket. Remove it.`, deleteToken(text, extra.from, extra.to))
    }
    const mismatch = /^closing parenthesis '(.)' does not match opening parenthesis '(.)'/.exec(detail)
    if (mismatch) {
      const wanted = own(CLOSERS, mismatch[2])
      const token = [...tokensOf(reported!)].find((entry, index, all) => entry.text === mismatch[1] && all.slice(0, index).some((item) => item.text === mismatch[2]))
        ?? find(reported!, mismatch[1])
      if (token && wanted) return pin(reported!, token.from, token.to, 'wrong_operator', `${code(mismatch[2])} must be closed with ${code(wanted)}, not ${code(mismatch[1])}.`, replaceRange(text, token.from, token.to, wanted))
    }
    if (/Perhaps you forgot a comma/.test(detail)) {
      const gap = missingSeparator(text, input.column ?? 0)
      if (gap) return pin(reported!, gap.at, gap.at + gap.token.length, 'missing_separator', `A comma is missing before ${code(gap.token)}.`, replaceRange(text, gap.end, gap.at, ', '))
    }
    const condition = /^\s*(if|elif|while)\b/.test(text)
    if (/Maybe you meant '==' or ':=' instead of '='/.test(detail) || (condition && /Maybe you meant '==' instead of '='/.test(detail))) {
      const token = atColumn()?.text === '=' ? atColumn() : find(reported!, '=')
      if (token) return pin(reported!, token.from, token.to, 'wrong_operator', `A single ${code('=')} stores a value. To compare, use ${code('==')}.`, replaceRange(text, token.from, token.to, '=='))
    }
    if (/^Missing parentheses in call to '(print|exec)'/.test(detail)) {
      const match = /^(\s*)(print|exec)\s+(.*?)\s*$/.exec(text)
      if (match) return pin(reported!, match[1].length, match[1].length + match[2].length, 'foreign_syntax', `In Python 3, ${code(match[2])} is a function. Put what it prints in parentheses.`, `${match[1]}${match[2]}(${match[3]})`)
    }
    const character = quoted(/^invalid character '(.)'/)
    if (character) {
      const column = text.indexOf(character)
      const fixed = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, '-').replace(/ /g, ' ')
      return pin(reported!, Math.max(0, column), Math.max(0, column) + 1, 'foreign_syntax',
        `${code(character)} is a typographic character, often pasted from a document. Type it again on the keyboard.`, fixed !== text ? fixed : undefined)
    }
    if (/^invalid (decimal|hexadecimal|octal|binary) literal/.test(detail)) {
      const token = atColumn() ?? tokensOf(reported!).find((entry) => /^\d/.test(entry.text))
      if (token) {
        const next = tokensOf(reported!).find((entry) => entry.from === token.to)
        const whole = next && word(next.text) ? { from: token.from, to: next.to, text: token.text + next.text } : token
        const ordinal = Object.hasOwn(ORDINALS, whole.text.toLowerCase()) ? ORDINALS[whole.text.toLowerCase()] : null
        const renamed = ordinal ?? `${whole.text.replace(/^\d+/, '')}_${/^\d+/.exec(whole.text)?.[0] ?? ''}`.replace(/^_+/, 'n_')
        const fixedCode = word(whole.text) ? null : input.code.replace(new RegExp(`(?<![\\w.])${escape(whole.text)}(?!\\w)`, 'g'), renamed)
        return { ...pin(reported!, whole.from, whole.to, 'misspelled_name', `${code(whole.text)} starts with a digit. Python names must start with a letter or underscore, for example ${code(renamed)}.`,
          replaceRange(text, whole.from, whole.to, renamed)), ...(fixedCode ? { fixedCode } : {}) }
      }
    }
    if (/^cannot assign to (function call|literal|expression|comparison|subscript)/.test(detail)) {
      const token = find(reported!, '=')
      if (token) {
        const call = /^\s*([A-Za-z_][\w.]*)\s*\(.*\)\s*$/.exec(text.slice(0, token.from))
        const fix = condition && /Maybe you meant '==' instead of '='/.test(detail) ? replaceRange(text, token.from, token.to, '==')
          : call ? `${text.slice(0, indentOf(text))}${call[1].split('.').at(-1)}_result = ${text.slice(indentOf(text), token.from).trim()}` : undefined
        return pin(reported!, indentOf(text), text.slice(0, token.from).trimEnd().length, 'wrong_operator',
          `The left side of ${code('=')} must be a name to store into, such as ${code('total')}, not a value or a call.`, fix)
      }
    }
    const outside = /^'(return|yield)' outside function|^'(break|continue)' (?:not properly in|outside) loop/.exec(detail)
    if (outside) {
      const keyword = outside[1] ?? outside[2]
      const token = find(reported!, keyword)
      const owner = findBack(reported! - 1, keyword === 'return' || keyword === 'yield' ? /^\s*def\s/ : /^\s*(for|while)\s/)
      const value = text.slice(indentOf(text) + keyword.length).trim()
      const fix = owner ? ' '.repeat(indentOf(textOf(owner)) + 4) + text.trimStart()
        : keyword === 'return' ? (value ? `${text.slice(0, indentOf(text))}print(${value})` : `${text.slice(0, indentOf(text))}pass`)
          : keyword === 'yield' ? undefined : `${text.slice(0, indentOf(text))}pass`
      if (token) return pin(reported!, token.from, token.to, 'wrong_indentation', keyword === 'return' || keyword === 'yield'
        ? `${code(keyword)} only works inside a function. ${owner ? `Indent it under the ${code('def')} on line ${owner}.` : value ? `To show the value, use ${code(`print(${value})`)}.` : 'Remove it.'}`
        : `${code(keyword)} only works inside a loop. ${owner ? `Indent it under the loop on line ${owner}.` : 'Remove it.'}`, fix)
    }
    if (/^expected 'except' or 'finally' block/.test(detail)) {
      const tryLine = findBack(reported!, /^\s*try\s*:/)
      if (tryLine) {
        const pad = ' '.repeat(indentOf(textOf(tryLine)))
        return pin(tryLine, indentOf(textOf(tryLine)), indentOf(textOf(tryLine)) + 3, 'missing_separator', `A ${code('try')} block needs an ${code('except')} or ${code('finally')} block after it, at the same indentation.`,
          `${pad}except Exception as error:\n${pad}    print(error)\n${text}`, reported)
      }
    }
    if (/^positional argument follows keyword argument/.test(detail)) {
      return pin(reported!, indentOf(text), text.trimEnd().length, 'other', 'Arguments without a name must come before named ones like `x=1`.')
    }
    if (/^non-default argument follows default argument|^parameter without a default follows parameter with a default/.test(detail)) {
      const header = /^(\s*def\s+\w+\()([^()]*)(\)\s*(?:->[^:]*)?:.*)$/.exec(text)
      const parameters = header?.[2].split(',').map((entry) => entry.trim()).filter(Boolean)
      const fixed = header && parameters ? `${header[1]}${[...parameters.filter((entry) => !entry.includes('=') && !entry.startsWith('*')), ...parameters.filter((entry) => entry.includes('=') || entry.startsWith('*'))].join(', ')}${header[3]}` : undefined
      return pin(reported!, indentOf(text), text.trimEnd().length, 'other', `Parameters with a default value (like ${code('n=1')}) must come after the ones without.${fixed ? ' Calls that pass these by position must follow the new order.' : ''}`,
        parameters?.some((entry) => entry.startsWith('*')) ? undefined : fixed)
    }
    if (/^f-string/.test(detail)) {
      return pin(reported!, indentOf(text), text.trimEnd().length, 'missing_closing', `This f-string is malformed: ${detail.replace(/^f-string:\s*/, '')}. Each ${code('{')} needs a matching ${code('}')} with an expression inside.`)
    }
    if (/^invalid syntax/.test(detail)) return invalidSyntax()
    return null
  }

  function invalidSyntax(): Pinpoint | null {
    const line = reported!
    const tokens = tokensOf(line)
    const elseIf = /\belse\s+if\b/.exec(text)
    if (elseIf) return explain(line, { from: elseIf.index, to: elseIf.index + 4, text: 'else' }, 'token', 'foreign_syntax')
    const foreign = tokens.find((token) => Object.hasOwn(FOREIGN, token.text) && token.text !== '}' && token.text !== ';' ||
      ((token.text === '++' || token.text === '--') && !/^\s*$/.test(text.slice(token.to))))
      ?? tokens.find((token) => token.text === '++' || token.text === '--')
      ?? (tokens.at(-1)?.text === '{' ? tokens.at(-1) : undefined)
      ?? (tokens.at(-1)?.text === ';' ? tokens.at(-1) : undefined)
      ?? (tokens.length === 1 && tokens[0].text === '}' ? tokens[0] : undefined)
    if (foreign) return explain(line, foreign, 'token', 'foreign_syntax')
    const names = definedNames(input.code)
    const first = tokens[0]
    if (first && word(first.text) && !KEYWORDS.includes(first.text) && !names.has(first.text) && nearest(first.text, KEYWORDS)) {
      return explain(line, first, 'token', 'misspelled_keyword')
    }
    const pointed = atColumn()
    if (pointed && word(pointed.text) && !KEYWORDS.includes(pointed.text) && !names.has(pointed.text) && nearest(pointed.text, KEYWORDS)) {
      return explain(line, pointed, 'token', 'misspelled_keyword')
    }
    const header = /^\s*(if|elif|while|for|def|class|with|else|try|except|finally)\b/.test(text)
    if (header && !text.slice(0, lineEnd(text)).endsWith(':')) return explain(line, null, 'eol', 'missing_colon')
    const previous = findBack(line - 1, /\S/)
    if (previous && /^\s*(if|elif|while|for|def|class|with|else|try|except|finally)\b/.test(textOf(previous)) &&
      !textOf(previous).slice(0, lineEnd(textOf(previous))).endsWith(':')) return explain(previous, null, 'eol', 'missing_colon')
    if (previous && unclosedOn(textOf(previous))) return explain(previous, null, 'eol', 'missing_closing')
    return null
  }

  function indentation(): Pinpoint | null {
    if (/^unindent does not match any outer indentation level/.test(detail)) {
      const have = indentOf(text)
      const levels = new Set<number>()
      for (let index = reported! - 2; index >= 0; index -= 1) {
        const line = lines[index]
        if (!line.trim() || line.trimStart().startsWith('#')) continue
        levels.add(indentOf(line))
        if (indentOf(line) === 0) break
      }
      const want = [...levels].filter((level) => level < have).sort((a, b) => b - a)[0] ?? 0
      return pin(reported!, 0, have, 'wrong_indentation', `Line ${reported} is indented ${have} spaces, which matches no block above. Line it up with a block at ${want} spaces.`, ' '.repeat(want) + text.trimStart())
    }
    if (/^expected an indented block/.test(detail) || /^unexpected indent/.test(detail)) return explain(reported!, null, 'indent', 'wrong_indentation')
    return explain(reported!, null, 'indent', 'wrong_indentation')
  }

  function nameError(): Pinpoint | null {
    const name = quoted(/name '([^']+)' is not defined/)
    if (!name) return null
    const token = find(reported!, name, span)
    if (!token) return null
    if (Object.hasOwn(FOREIGN, name)) return explain(reported!, token, 'token', 'foreign_syntax')
    const suggestion = quoted(/Did you mean: '([^']+)'/)
    const names = definedNames(input.code)
    const match = suggestion && !suggestion.includes('.') ? suggestion : nearest(name, [...names, ...KEYWORDS.filter((keyword) => /^[A-Z]/.test(keyword))])
    if (match) return pin(reported!, token.from, token.to, 'misspelled_name', `${code(name)} is not defined. Did you mean ${code(match)}?`, replaceRange(text, token.from, token.to, match))
    const later = lines.findIndex((line, index) => index >= reported! && new RegExp(`^\\s*${name}\\s*(?:[-+*/%]|//|\\*\\*)?=(?!=)|^\\s*def\\s+${name}\\b|^\\s*import\\s+${name}\\b`).test(line))
    if (later >= 0) {
      const definition = lines[later]
      const movable = !/^\s*def\s/.test(definition) && indentOf(definition) === indentOf(text)
      const moved = [...lines]
      moved.splice(later, 1)
      moved.splice(reported! - 1, 0, definition)
      const result = pin(reported!, token.from, token.to, 'undefined_name', `${code(name)} is created on line ${later + 1}, after this line uses it. Move that line above line ${reported}.`,
        movable ? `${definition}\n${text}` : undefined)
      return movable ? { ...result, fixedCode: moved.join('\n') } : result
    }
    if (/^[a-z]+$/.test(name) && STDLIB.includes(name)) {
      return pin(reported!, token.from, token.to, 'undefined_name', `${code(name)} is a module. Add ${code(`import ${name}`)} at the top of the file.`, `import ${name}\n${textOf(1)}`, 1)
    }
    const quotedText = /^[A-Za-z]\w*$/.test(name) && /\bprint\s*\(/.test(text) && text.slice(token.from - 1, token.from) !== '"'
    const usedOnce = (input.code.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length === 1
    return pin(reported!, token.from, token.to, 'undefined_name', `${code(name)} is used before it is created. Assign it first${quotedText ? `, or put it in quotes if you meant the text ${code(`"${name}"`)}` : ''}.`,
      quotedText && usedOnce ? replaceRange(text, token.from, token.to, `"${name}"`) : undefined)
  }

  function unboundLocal(): Pinpoint | null {
    const name = quoted(/local variable '([^']+)'/)
    if (!name) return null
    const token = find(reported!, name, span)
    const defLine = findBack(reported!, /^\s*def\s+\w+/)
    if (!token) return null
    if (defLine) {
      const header = textOf(defLine)
      const fix = `${header}\n${' '.repeat(indentOf(header) + 4)}global ${name}`
      return pin(reported!, token.from, token.to, 'undefined_name',
        `${code(name)} is assigned inside this function, so Python treats it as a new local variable that has no value yet here. Pass it in as a parameter, or declare ${code(`global ${name}`)} at the top of the function.`, fix, defLine)
    }
    return pin(reported!, token.from, token.to, 'undefined_name', `${code(name)} has no value yet at this point.`)
  }

  function attributeError(): Pinpoint | null {
    const match = /'([^']+)' object has no attribute '([^']+)'/.exec(detail) ?? /module '([^']+)' has no attribute '([^']+)'/.exec(detail)
    if (!match) return null
    const [, owner, attribute] = match
    const token = tokensOf(reported!).find((entry, index, all) => entry.text === attribute && all[index - 1]?.text === '.' && (!span || (entry.from >= span.from && entry.to <= span.to)))
      ?? tokensOf(reported!).find((entry, index, all) => entry.text === attribute && all[index - 1]?.text === '.')
    if (!token) return null
    if (owner === 'NoneType') return noneValue(token.from - 1)
    const known = own(TYPE_METHODS as unknown as Record<string, string>, owner) ? TYPE_METHODS[owner] : MODULE_MEMBERS[owner.replace(/^module '|'$/g, '')] ?? null
    const suggestion = quoted(/Did you mean: '([^']+)'/) ?? (known ? nearest(attribute, known) : null)
    const method = own(METHODS, attribute)
    if (method === '__len__') return explain(reported!, token, 'token', 'wrong_method')
    const replacement = method ?? suggestion ?? null
    if (replacement) {
      return pin(reported!, token.from, token.to, 'wrong_method', `${code(owner)} has no ${code(attribute)}. Use ${code(replacement)}.`, replaceRange(text, token.from, token.to, replacement))
    }
    return pin(reported!, token.from, token.to, 'wrong_method', `${code(owner)} values have no ${code(attribute)}. Check the spelling, or use ${code(`dir(value)`)} to list what exists.`)
  }

  function typeError(): Pinpoint | null {
    if (/NoneType/.test(detail)) return noneValue(span?.from, 'within')
    const concat = /can only concatenate str \(not "(\w+)"\) to str/.exec(detail)
    if (concat) return concatenation()
    const operands = /unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/.exec(detail)
    if (operands) {
      const operator = find(reported!, operands[1].trim(), span)
      if (operator) {
        const tokens = tokensOf(reported!)
        const index = tokens.indexOf(operator)
        const [left, right] = [tokens[index - 1], tokens[index + 1]]
        const strSide = operands[2] === 'str' ? left : operands[3] === 'str' ? right : null
        if (strSide && word(strSide.text)) {
          const source = lines.slice(0, reported! - 1).find((line) => new RegExp(`^\\s*${strSide.text}\\s*=\\s*input\\(`).test(line))
          if (source || operands[2] === 'int' || operands[3] === 'int' || operands[2] === 'float' || operands[3] === 'float') {
            const convert = operands[2] === 'float' || operands[3] === 'float' ? 'float' : 'int'
            return pin(reported!, strSide.from, strSide.to, 'wrong_type', `${code(strSide.text)} is text${source ? ` (${code('input()')} always returns text)` : ''}. Convert it with ${code(`${convert}(${strSide.text})`)} before doing math.`,
              replaceRange(text, strSide.from, strSide.to, `${convert}(${strSide.text})`))
          }
        }
        return pin(reported!, operator.from, operator.to, 'wrong_type', `${code(operands[1].trim())} cannot combine ${code(operands[2])} and ${code(operands[3])}. Convert one side so both have the same type.`)
      }
    }
    const missing = /^(\w+(?:\.\w+)?)\(\) missing (\d+) required (?:positional|keyword-only) arguments?: (.+)$/.exec(detail)
    if (missing) {
      const name = missing[1].split('.').at(-1)!
      const call = callToken(name)
      const parts = callArguments(text, name)
      const names = missing[3].replace(/'/g, '').split(/,\s*|\s+and\s+/).filter(Boolean)
      const fix = parts && /positional/.test(detail) ? replaceRange(text, parts.open + 1, parts.close, [...parts.args, ...names.map(() => '0')].join(', ')) : undefined
      if (call) return pin(reported!, call.from, call.to, 'wrong_arguments', `${code(`${name}()`)} also needs ${missing[3].replace(/'/g, '`')}. Pass ${missing[2] === '1' ? 'that value' : 'those values'} in the call${fix ? `; the fix adds ${code('0')} as a placeholder to replace` : ''}.`, fix)
    }
    const count = /^(\w+(?:\.\w+)?)\(\) takes (\d+) positional arguments? but (\d+) (?:were|was) given/.exec(detail)
    if (count) {
      const name = count[1].split('.').at(-1)!
      const defLine = lines.findIndex((line) => new RegExp(`^\\s*def\\s+${name}\\s*\\(`).test(line))
      const header = defLine >= 0 ? lines[defLine] : ''
      if (count[1].includes('.') && Number(count[3]) === Number(count[2]) + 1 && defLine >= 0 && !/\(\s*self\b/.test(header)) {
        const open = header.indexOf('(')
        const fixed = header.slice(0, open + 1) + (header.slice(open + 1).trimStart().startsWith(')') ? 'self' : 'self, ') + header.slice(open + 1)
        return pin(defLine + 1, open + 1, open + 1, 'wrong_arguments', `Methods receive the object as their first parameter. Add ${code('self')} to ${code(`${name}()`)}.`, fixed)
      }
      const call = callToken(name)
      const parts = callArguments(text, name)
      const keep = Number(count[2])
      const fix = parts && parts.args.length === Number(count[3]) && parts.args.every((arg) => !arg.includes('=') && !arg.startsWith('*'))
        ? replaceRange(text, parts.open + 1, parts.close, parts.args.slice(0, keep).join(', ')) : undefined
      if (call) return pin(reported!, call.from, call.to, 'wrong_arguments', `${code(`${name}()`)} accepts ${count[2]} argument${count[2] === '1' ? '' : 's'}, but this call passes ${count[3]}. Match the call to the ${code('def')} line.`, fix)
    }
    const unexpectedKeyword = /^(\w+)\(\) got an unexpected keyword argument '(\w+)'/.exec(detail)
    if (unexpectedKeyword) {
      const token = find(reported!, unexpectedKeyword[2])
      const definition = lines.find((line) => new RegExp(`^\\s*def\\s+${unexpectedKeyword[1]}\\s*\\(`).test(line))
      const parameters = definition ? (/\(([^)]*)\)/.exec(definition)?.[1] ?? '').split(',').map((entry) => entry.split(/[=:]/)[0].trim().replace(/^\*+/, '')).filter(word) : []
      const match = nearest(unexpectedKeyword[2], parameters)
      if (token) return pin(reported!, token.from, token.to, 'wrong_arguments', match
        ? `${code(`${unexpectedKeyword[1]}()`)} has no parameter named ${code(unexpectedKeyword[2])}. Did you mean ${code(match)}?`
        : `${code(`${unexpectedKeyword[1]}()`)} has no parameter named ${code(unexpectedKeyword[2])}. Check the ${code('def')} line for the right name.`,
      match ? replaceRange(text, token.from, token.to, match) : undefined)
    }
    const callable = quoted(/^'(\w+)' object is not callable/)
    if (callable) {
      const call = tokensOf(reported!).find((entry, index, all) => word(entry.text) && all[index + 1]?.text === '(' && (!span || entry.from >= span.from))
      if (call) {
        const shadow = lines.findIndex((line) => new RegExp(`^\\s*${call.text}\\s*=(?!=)`).test(line))
        const shadowed = BUILTINS.includes(call.text) && shadow >= 0
        const fixedCode = shadowed ? renameVariable(input.code, call.text, `${call.text}_value`, true) : null
        const result = pin(reported!, call.from, call.to, 'wrong_type', shadowed
          ? `Line ${shadow + 1} replaced the built-in ${code(call.text)} with a value, so it can no longer be called. Rename that variable, for example ${code(`${call.text}_value`)}.`
          : `${code(call.text)} holds a ${code(callable)} value, not a function, so it cannot be called with ${code('()')}.`,
        fixedCode ? fixedCode.split('\n')[shadow] : undefined, fixedCode ? shadow + 1 : undefined)
        return fixedCode ? { ...result, fixedCode } : result
      }
    }
    const subscript = quoted(/^'(\w+)' object is not subscriptable/)
    if (subscript) {
      const base = subscriptBase()
      const digits = subscript === 'int' || subscript === 'float'
      if (base) return pin(reported!, base.from, base.to, 'wrong_type', `${code(base.text)} is a ${code(subscript)}, so ${code('[...]')} cannot be used on it.${digits ? ` To read its digits, use ${code(`str(${base.text})`)}.` : ''}`,
        digits && word(base.text) ? replaceRange(text, base.from, base.to, `str(${base.text})`) : undefined)
    }
    if (/object does not support item assignment/.test(detail)) {
      const base = subscriptBase()
      const assignment = /^(\s*)([A-Za-z_]\w*)\[\s*(-?\d+)\s*\]\s*=(?!=)\s*(.+?)\s*$/.exec(text)
      const position = assignment ? Number(assignment[3]) : NaN
      const fix = assignment && position >= 0 ? `${assignment[1]}${assignment[2]} = ${position === 0 ? '' : `${assignment[2]}[:${position}] + `}${assignment[4]} + ${assignment[2]}[${position + 1}:]` : undefined
      if (base) return pin(reported!, base.from, base.to, 'wrong_type', `${code(base.text)} cannot be changed in place (strings and tuples are immutable). Build a new value instead.`, fix)
    }
    const noLen = quoted(/^object of type '(\w+)' has no len\(\)/)
    if (noLen) {
      const call = find(reported!, 'len')
      const parts = callArguments(text, 'len')
      const digits = (noLen === 'int' || noLen === 'float') && parts?.args.length === 1
      if (call) return pin(reported!, call.from, call.to, 'wrong_type', `${code('len()')} works on text, lists and dicts, not on a ${code(noLen)}.${digits ? ` To count its digits, use ${code(`len(str(${parts!.args[0]}))`)}.` : ''}`,
        digits ? replaceRange(text, parts!.open + 1, parts!.close, `str(${parts!.args[0]})`) : undefined)
    }
    const notIterable = quoted(/^'(\w+)' object is not iterable/)
    if (notIterable) {
      const inToken = find(reported!, 'in')
      const after = inToken ? tokensOf(reported!).find((entry) => entry.from > inToken.to) : null
      if (after) {
        const fix = notIterable === 'int' && /^\s*for\b/.test(text) ? replaceRange(text, after.from, lineEnd(text) - (text.slice(0, lineEnd(text)).endsWith(':') ? 1 : 0), `range(${text.slice(after.from, lineEnd(text) - (text.slice(0, lineEnd(text)).endsWith(':') ? 1 : 0)).trim()})`) : undefined
        return pin(reported!, after.from, after.to, 'wrong_type', notIterable === 'int'
          ? `${code(after.text)} is a number. To loop that many times, use ${code(`range(${after.text})`)}.`
          : `A ${code(notIterable)} cannot be looped over.`, fix)
      }
    }
    if (/^unhashable type: '(\w+)'/.test(detail)) {
      const key = /\[([^[\]]*)\](?=\s*:)|(?<=\.add\(\s*)\[([^[\]]*)\](?=\s*\))/.exec(text)
      const fix = key ? replaceRange(text, key.index, key.index + key[0].length, `(${key[1] ?? key[2]}${(key[1] ?? key[2]).includes(',') || !(key[1] ?? key[2]).trim() ? '' : ','})`) : undefined
      return pin(reported!, key?.index ?? span?.from ?? indentOf(text), key ? key.index + key[0].length : span?.to ?? text.trimEnd().length, 'wrong_type', 'Lists and dicts cannot be dictionary keys or set items. Use a tuple or a string instead.', fix)
    }
    const conversion = /^(int|float)\(\) argument must be a string or a (?:real )?number, not '(\w+)'/.exec(detail)
    if (conversion) {
      const call = find(reported!, conversion[1], span)
      if (call) return pin(reported!, call.from, call.to, 'wrong_type', `${code(`${conversion[1]}()`)} cannot convert a ${code(conversion[2])}.`)
    }
    return null
  }

  function concatenation(): Pinpoint | null {
    const tokens = tokensOf(reported!)
    const isText = (token?: Token) => Boolean(token && /^[rRbBfFuU]{0,2}["']/.test(token.text))
    const textValued = (token?: Token) => Boolean(token && word(token.text) && lines.slice(0, reported! - 1).some((line) =>
      new RegExp(`^\\s*${token.text}\\s*=\\s*(?:input\\(|["']-?\\d+(?:\\.\\d+)?["'])`).test(line)))
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index].text !== '+' || (span && (tokens[index].from < span.from || tokens[index].to > span.to))) continue
      const [left, right] = [tokens[index - 1], tokens[index + 1]]
      const textSide = textValued(left) ? left : textValued(right) ? right : null
      const numberSide = textSide === left ? right : left
      if (textSide && numberSide && !isText(numberSide)) {
        const digits = lines.slice(0, reported! - 1).some((line) => new RegExp(`^\\s*${textSide.text}\\s*=\\s*["']-?\\d+\\.\\d+["']`).test(line)) ? 'float' : 'int'
        return pin(reported!, textSide.from, textSide.to, 'wrong_type', `${code(textSide.text)} holds text that looks like a number. Convert it with ${code(`${digits}(${textSide.text})`)} to do math.`,
          replaceRange(text, textSide.from, textSide.to, `${digits}(${textSide.text})`))
      }
    }
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index].text !== '+' || (span && (tokens[index].from < span.from || tokens[index].to > span.to))) continue
      for (const side of [tokens[index + 1], tokens[index - 1]]) {
        if (side && (word(side.text) && !KEYWORDS.includes(side.text) || /^\d/.test(side.text)) && tokens[tokens.indexOf(side) + 1]?.text !== '(') {
          return explain(reported!, side, 'token', 'wrong_type')
        }
      }
    }
    const plus = find(reported!, '+', span)
    return plus ? pin(reported!, plus.from, plus.to, 'wrong_type', `Text can only be joined to text with ${code('+')}. Wrap the number in ${code('str(...)')}, or use an f-string.`) : null
  }

  function indexError(): Pinpoint | null {
    const subscripts = subscriptsOn(reported!).filter((entry) => !span || (entry.open >= span.from && entry.close <= span.to))
    const target = subscripts[0] ?? subscriptsOn(reported!)[0]
    if (!target) return null
    const inner = text.slice(target.open + 1, target.close)
    const lenCall = /^\s*len\((\w+)\)\s*$/.exec(inner)
    if (lenCall) {
      return pin(reported!, target.open + 1, target.close, 'wrong_type', `${code(`len(${lenCall[1]})`)} is one past the last position. The last item is at ${code(`len(${lenCall[1]}) - 1`)}, or use ${code('-1')}.`,
        replaceRange(text, target.open + 1, target.close, `${inner.trim()} - 1`))
    }
    const loopVar = /^\s*([A-Za-z_]\w*)\s*$/.exec(inner)?.[1]
    if (loopVar) {
      const header = findBack(reported!, new RegExp(`^\\s*for\\s+${loopVar}\\s+in\\s+range\\(`))
      if (header) {
        const headerText = textOf(header)
        const plusOne = /range\(\s*(?:(\d+)\s*,\s*)?(len\(\w+\))\s*\+\s*1\s*\)/.exec(headerText)
        if (plusOne) {
          const start = plusOne[1]
          const fixed = headerText.replace(plusOne[0], start && start !== '0' ? `range(${start}, ${plusOne[2]})` : `range(${plusOne[2]})`)
          return pin(header, plusOne.index, plusOne.index + plusOne[0].length, 'wrong_type',
            `${code(plusOne[0])} goes one past the end, so ${code(`${target.base}[${loopVar}]`)} fails on the last step. Positions run from 0 to ${code(`${plusOne[2]} - 1`)}.`, fixed)
        }
        const oneBased = /range\(\s*1\s*,\s*len\((\w+)\)\s*\+\s*1\s*\)/.exec(headerText)
        if (oneBased) return pin(reported!, target.open + 1, target.close, 'wrong_type', 'Positions start at 0. Use `' + `${target.base}[${loopVar} - 1]` + '`.', replaceRange(text, target.open + 1, target.close, `${loopVar} - 1`))
      }
    }
    const empty = lines.slice(0, reported! - 1).some((line) => new RegExp(`^\\s*${target.base}\\s*=\\s*\\[\\s*\\]`).test(line)) &&
      !new RegExp(`${target.base}\\.(append|extend|insert)\\(|${target.base}\\s*\\+=`).test(lines.slice(0, reported! - 1).join('\n'))
    const position = /^\s*(\d+)\s*$/.exec(inner)?.[1]
    const guard = word(target.base) ? guarded(text, empty || position === '0' ? target.base : position ? `len(${target.base}) > ${position}` : `${inner.trim()} < len(${target.base})`) : undefined
    return pin(reported!, target.open + 1, target.close, 'wrong_type', empty
      ? `${code(target.base)} is still empty here, so it has no position ${code(inner.trim())}. Add items before reading them, or check first.`
      : `Position ${code(inner.trim())} is past the end of ${code(target.base)}. Valid positions are 0 to ${code(`len(${target.base}) - 1`)}.`, guard)
  }

  function keyError(): Pinpoint | null {
    const key = /^(['"])(.*)\1$/.exec(detail.trim())?.[2] ?? detail.trim()
    const subscripts = subscriptsOn(reported!)
    const target = subscripts.find((entry) => text.slice(entry.open + 1, entry.close).includes(key)) ?? subscripts.find((entry) => !span || entry.open >= span.from) ?? subscripts[0]
    if (!target) return null
    const inner = text.slice(target.open + 1, target.close)
    const keys = new Set<string>()
    for (const match of input.code.matchAll(/['"]([^'"\n]+)['"]\s*:/g)) keys.add(match[1])
    for (const match of input.code.matchAll(/\[\s*['"]([^'"\n]+)['"]\s*\]\s*=(?!=)/g)) keys.add(match[1])
    const literal = /^\s*(['"])(.*)\1\s*$/.exec(inner)
    const spelled = literal ? nearest(literal[2], keys) : null
    if (spelled && literal) {
      const at = target.open + 1 + inner.indexOf(literal[0].trim())
      return pin(reported!, target.open + 1, target.close, 'misspelled_name', `There is no key ${code(literal[0].trim())}. Did you mean ${code(`${literal[1]}${spelled}${literal[1]}`)}?`,
        replaceRange(text, at, at + literal[0].trim().length, `${literal[1]}${spelled}${literal[1]}`))
    }
    const assignment = new RegExp(`^(\\s*)(\\w+)\\s*=\\s*${escape(target.base)}\\[`).test(text)
    return pin(reported!, target.open + 1, target.close, 'undefined_name', `${code(target.base)} has no key ${code(inner.trim())}. Check the spelling, or use ${code(`${target.base}.get(${inner.trim()})`)} to get None instead of an error.`,
      assignment || !/=(?!=)/.test(text.slice(target.close)) ? replaceRange(text, target.open, target.close + 1, `.get(${inner.trim()})`) : undefined)
  }

  function zeroDivision(): Pinpoint | null {
    const tokens = tokensOf(reported!)
    const operator = tokens.find((token) => ['/', '//', '%', '/=', '//=', '%='].includes(token.text) && (!span || (token.from >= span.from && token.to <= span.to)))
      ?? tokens.find((token) => ['/', '//', '%', '/=', '//=', '%='].includes(token.text))
    if (!operator) return null
    const index = tokens.indexOf(operator)
    const right = tokens[index + 1]
    const divisor = right?.text === 'len' && tokens[index + 3] ? `len(${tokens[index + 3].text})` : right?.text ?? '0'
    const end = right?.text === 'len' ? (tokens[index + 4]?.to ?? right.to) : right?.to ?? operator.to
    const empty = right?.text === 'len' ? ` — ${code(tokens[index + 3]?.text ?? '')} is empty` : ''
    const assigned = /^\s*[A-Za-z_]\w*\s*=(?!=)/.test(text) && !text.trimEnd().endsWith(':') && !/\bif\b/.test(text)
    const condition = right?.text === 'len' ? (tokens[index + 3]?.text ?? divisor) : `${divisor} != 0`
    const fix = !right || right.text === '(' ? undefined : assigned ? `${text.trimEnd()} if ${condition} else 0` : guarded(text, condition)
    return pin(reported!, right?.from ?? operator.from, end, 'wrong_type',
      `${code(divisor)} is 0 here${empty}, and dividing by zero is undefined. Check for zero first, for example ${code(`if ${condition}:`)}.`, fix)
  }

  function valueError(): Pinpoint | null {
    const literal = /^invalid literal for (int|float)\(\)(?: with base \d+)?: (.+)$/.exec(detail) ?? /^could not convert string to (float): (.+)$/.exec(detail)
    if (literal) {
      const call = find(reported!, literal[1], span)
      const value = literal[2].replace(/^['"]|['"]$/g, '')
      if (call) {
        const argument = tokensOf(reported!).find((entry) => entry.from > call.to && entry.text !== '(')
        const at = argument ?? call
        if (literal[1] === 'int' && /^\s*-?\d+\.\d*\s*$/.test(value)) {
          return pin(reported!, call.from, call.to, 'wrong_type', `${code(`"${value}"`)} has a decimal point, so ${code('int()')} cannot read it. Use ${code('float()')}.`, replaceRange(text, call.from, call.to, 'float'))
        }
        const parts = callArguments(text, literal[1])
        const source = parts?.args.length === 1 ? parts.args[0] : null
        const check = source ? (literal[1] === 'int' ? `${source}.strip().lstrip("-").isdigit()` : `${source}.strip().lstrip("-").replace(".", "", 1).isdigit()`) : null
        const fix = parts && check ? replaceRange(text, call.from, parts.close + 1, `(${literal[1]}(${source}) if ${check} else ${literal[1] === 'int' ? '0' : '0.0'})`) : undefined
        return pin(reported!, at.from, at.to, 'wrong_type', value.trim() === ''
          ? `The text is empty, so it cannot become a number. Check that a value was entered first.`
          : `${code(`"${value}"`)} is not a number, so ${code(`${literal[1]}()`)} cannot convert it. Use digits only, or check the text before converting.`, fix)
      }
    }
    const unpack = /^(not enough|too many) values to unpack \(expected (\d+)(?:, got (\d+))?\)/.exec(detail)
    if (unpack) {
      const equals = find(reported!, '=')
      const left = equals ? { from: indentOf(text), to: text.slice(0, equals.from).trimEnd().length } : null
      const names = left ? text.slice(left.from, left.to).split(',').map((entry) => entry.trim()) : []
      const simple = names.length > 0 && names.every(word) && equals
      const got = unpack[3] ? Number(unpack[3]) : null
      const fixedNames = unpack[1] === 'too many' ? [...names, '*rest'] : got !== null && got > 0 ? names.slice(0, got) : null
      const fix = simple && fixedNames ? `${text.slice(0, left!.from)}${fixedNames.join(', ')}${fixedNames.length === 1 ? ',' : ''} ${text.slice(equals!.from).trimStart()}` : undefined
      if (left) return pin(reported!, left.from, left.to, 'wrong_arguments', `The left side names ${unpack[2]} variable${unpack[2] === '1' ? '' : 's'}, but the right side has ${unpack[3] ?? (unpack[1] === 'too many' ? 'more' : 'fewer')} value${unpack[3] === '1' ? '' : 's'}. Make the counts match${unpack[1] === 'too many' ? `, or collect the rest with ${code('*rest')}` : ''}.`, fix)
    }
    if (/^math domain error/.test(detail)) {
      const call = tokensOf(reported!).find((_entry, index, all) => all[index - 1]?.text === '.' && all[index - 2]?.text === 'math')
      const parts = call ? callArguments(text, `math.${call.text}`) : null
      const argument = parts?.args.length === 1 ? parts.args[0] : null
      const fix = call && parts && argument ? (call.text === 'sqrt' ? replaceRange(text, parts.open + 1, parts.close, `abs(${argument})`) : guarded(text, `${argument} > 0`)) : undefined
      if (call) return pin(reported!, call.from, call.to, 'wrong_type', `${code(`math.${call.text}()`)} got a value outside what it accepts, such as a negative number for ${code('sqrt')}.${call.text === 'sqrt' ? ` Use ${code('abs()')} if the sign does not matter.` : ''}`, fix)
    }
    const removed = /^list\.(remove|index)\(x\): x not in list/.exec(detail)
    if (removed) {
      const call = find(reported!, removed[1])
      const usage = new RegExp(`([A-Za-z_][\\w.]*)\\.${removed[1]}\\(([^()]*)\\)`).exec(text)
      const check = usage ? `${usage[2].trim()} in ${usage[1]}` : 'value in items'
      if (call) return pin(reported!, call.from, call.to, 'undefined_name', `The value is not in the list. Check with ${code(`if ${check}:`)} first.`,
        usage && removed[1] === 'remove' ? guarded(text, check) : undefined)
    }
    return null
  }

  function importError(): Pinpoint | null {
    const module = quoted(/^No module named '([^']+)'/)
    if (module) {
      const root = module.split('.')[0]
      const token = find(reported!, root)
      if (!token) return null
      const match = nearest(root, STDLIB)
      return match
        ? pin(reported!, token.from, token.to, 'misspelled_name', `There is no module ${code(root)}. Did you mean ${code(match)}?`, replaceRange(text, token.from, token.to, match))
        : pin(reported!, token.from, token.to, 'undefined_name', `${code(root)} is not installed in this browser Python. Only the standard library and preloaded packages are available here.`)
    }
    const name = /^cannot import name '([^']+)' from '([^']+)'/.exec(detail)
    if (name) {
      const token = find(reported!, name[1])
      const members = Object.hasOwn(MODULE_MEMBERS, name[2]) ? MODULE_MEMBERS[name[2]] : null
      const match = members ? nearest(name[1], members) : null
      if (token && match) return pin(reported!, token.from, token.to, 'misspelled_name', `${code(name[2])} has no ${code(name[1])}. Did you mean ${code(match)}?`, replaceRange(text, token.from, token.to, match))
      if (token) return pin(reported!, token.from, token.to, 'misspelled_name', `${code(name[2])} has no ${code(name[1])}. Check the spelling and capitalization.`)
    }
    return null
  }

  function recursion(): Pinpoint | null {
    const frames = input.frames ?? []
    const counts = new Map<string, number>()
    for (const frame of frames) counts.set(frame.name, (counts.get(frame.name) ?? 0) + 1)
    const name = [...counts.entries()].filter(([entry]) => entry !== '<module>').sort((a, b) => b[1] - a[1])[0]?.[0] ??
      lines.map((line) => /^\s*def\s+(\w+)/.exec(line)?.[1]).find((candidate) => candidate && new RegExp(`\\b${candidate}\\(`).test(input.code.replace(new RegExp(`def\\s+${candidate}`), '')))
    if (!name) return null
    const defIndex = lines.findIndex((line) => new RegExp(`^\\s*def\\s+${name}\\s*\\(`).test(line))
    if (defIndex < 0) return null
    const parameters = /\(([^)]*)\)/.exec(lines[defIndex])?.[1].split(',').map((entry) => entry.trim().split(/[=:]/)[0].trim()).filter(Boolean) ?? []
    const bodyIndent = indentOf(lines[defIndex])
    for (let index = defIndex + 1; index < lines.length && (!lines[index].trim() || indentOf(lines[index]) > bodyIndent); index += 1) {
      const call = new RegExp(`\\b${name}\\(([^()]*)\\)`).exec(lines[index])
      if (!call) continue
      const args = call[1].split(',').map((entry) => entry.trim())
      const same = args.length === parameters.length && args.every((arg, position) => arg === parameters[position])
      const from = call.index
      const message = same
        ? `${code(`${name}(${call[1]})`)} calls itself with the same value, so it never gets closer to stopping. Pass a smaller value, such as ${code(`${parameters[0]} - 1`)}.`
        : `${code(name)} keeps calling itself and never reaches a stopping case. Add an ${code('if')} that returns without calling ${code(name)}, and make each call move toward it.`
      if (same && parameters.length === 1) return pin(index + 1, from, from + call[0].length, 'other', message, replaceRange(lines[index], from + name.length + 1, from + name.length + 1 + call[1].length, `${parameters[0]} - 1`))
      const hasBase = lines.slice(defIndex + 1, index).some((line) => /^\s*if\b/.test(line))
      const numeric = parameters.length >= 1 && new RegExp(`\\b${parameters[0]}\\s*-\\s*\\d`).test(call[1])
      const pad = ' '.repeat(indentOf(lines[defIndex]) + 4)
      const fix = !hasBase && numeric ? `${lines[defIndex]}\n${pad}if ${parameters[0]} <= 0:\n${pad}    return ${parameters[0]}` : undefined
      return pin(index + 1, from, from + call[0].length, 'other', fix ? `${message} For example, stop when ${code(`${parameters[0]} <= 0`)}.` : message, fix, fix ? defIndex + 1 : undefined)
    }
    return pin(defIndex + 1, indentOf(lines[defIndex]), lines[defIndex].trimEnd().length, 'other', `${code(name)} keeps calling itself without stopping. Add a base case that returns without calling ${code(name)} again.`)
  }

  function loop(): Pinpoint | null {
    const header = /^\s*(while|for)\b/.test(text) ? reported! : findBack(reported!, /^\s*(while|for)\b/, indentOf(text))
    return header ? loopFix(lines, header, pin) : null
  }

  function noneValue(position?: number, mode: 'before' | 'within' = 'before'): Pinpoint | null {
    const tokens = tokensOf(reported!)
    const usable = (token: Token) => word(token.text) && !KEYWORDS.includes(token.text) && !BUILTINS.includes(token.text)
    const base = position === undefined ? null : mode === 'within'
      ? tokens.find((token) => usable(token) && token.from >= position) ?? null
      : [...tokens].reverse().find((token) => token.to <= position && usable(token)) ?? null
    const names = base ? [base] : tokens.filter((token) => word(token.text) && !KEYWORDS.includes(token.text) && !BUILTINS.includes(token.text))
    for (const candidate of names) {
      const name = candidate.text
      for (let index = reported! - 1; index >= 0; index -= 1) {
        const line = lines[index]
        const mutator = new RegExp(`^(\\s*)${name}\\s*=\\s*${name}\\.(${MUTATORS.join('|')})\\((.*)\\)\\s*$`).exec(line)
        if (mutator) {
          return pin(index + 1, mutator[1].length, mutator[1].length + name.length, 'wrong_type',
            `${code(`.${mutator[2]}()`)} changes ${code(name)} in place and returns None, so this line sets ${code(name)} to None. Drop ${code(`${name} =`)}.`, `${mutator[1]}${name}.${mutator[2]}(${mutator[3]})`)
        }
        const call = new RegExp(`^\\s*${name}\\s*=\\s*(\\w+)\\(`).exec(line)
        if (call) {
          const result = missingReturn(call[1], name)
          if (result) return result
          break
        }
      }
      const direct = new RegExp(`\\b${name}\\(`).test(text) ? missingReturn(name, `${name}()`) : null
      if (direct) return direct
    }
    const span = reportedSpan()
    return base ? pin(reported!, base.from, base.to, 'wrong_type', `${code(base.text)} is None here, so it has no value to use. Check where it is set.`)
      : span ? pin(reported!, span.from, span.to, 'wrong_type', 'A value here is None. Check that each function you call returns a value.') : null
  }

  function missingReturn(functionName: string, valueName: string): Pinpoint | null {
    const defIndex = lines.findIndex((line) => new RegExp(`^\\s*def\\s+${functionName}\\s*\\(`).test(line))
    if (defIndex < 0) return null
    const bodyIndent = indentOf(lines[defIndex])
    let lastPrint = -1
    for (let index = defIndex + 1; index < lines.length && (!lines[index].trim() || indentOf(lines[index]) > bodyIndent); index += 1) {
      if (/^\s*return\b\s*\S/.test(lines[index])) return null
      if (/^\s*print\(/.test(lines[index])) lastPrint = index
    }
    if (lastPrint >= 0) {
      const printed = /^(\s*)print\((.*)\)\s*$/.exec(lines[lastPrint])
      return pin(lastPrint + 1, indentOf(lines[lastPrint]), indentOf(lines[lastPrint]) + 5, 'wrong_type',
        `${code(`${functionName}()`)} prints its result but does not return it, so ${code(valueName)} is None. Use ${code('return')} instead of ${code('print')}.`,
        printed ? `${printed[1]}return ${printed[2]}` : undefined)
    }
    return pin(defIndex + 1, indentOf(lines[defIndex]), lines[defIndex].trimEnd().length, 'wrong_type',
      `${code(`${functionName}()`)} has no ${code('return')}, so it gives back None. Return the value at the end of the function.`)
  }

  function callToken(name: string): Token | null {
    const tokens = tokensOf(reported!)
    return tokens.find((entry, index) => entry.text === name && tokens[index + 1]?.text === '(' && (!span || entry.from >= span.from)) ??
      tokens.find((entry, index) => entry.text === name && tokens[index + 1]?.text === '(') ?? null
  }

  function subscriptBase(): Token | null {
    const target = subscriptsOn(reported!).find((entry) => !span || entry.open >= span.from) ?? subscriptsOn(reported!)[0]
    return target ? tokensOf(reported!).find((token) => token.to === target.baseEnd) ?? null : null
  }

  function subscriptsOn(line: number): { base: string; baseEnd: number; open: number; close: number }[] {
    const tokens = tokenizeLine(textOf(line))
    const found: { base: string; baseEnd: number; open: number; close: number }[] = []
    tokens.forEach((token, index) => {
      if (token.text !== '[' || index === 0) return
      const before = tokens[index - 1]
      if (!word(before.text) && before.text !== ')' && before.text !== ']') return
      let depth = 0
      for (let next = index; next < tokens.length; next += 1) {
        if (tokens[next].text === '[') depth += 1
        else if (tokens[next].text === ']' && --depth === 0) {
          found.push({ base: before.text, baseEnd: before.to, open: token.from, close: tokens[next].from })
          return
        }
      }
    })
    return found
  }

  function findBack(start: number, pattern: RegExp, belowIndent?: number): number | null {
    for (let line = start; line >= 1; line -= 1) {
      const value = textOf(line)
      if (pattern.test(value) && (belowIndent === undefined || indentOf(value) < belowIndent || line === start)) return line
    }
    return null
  }
}

/** Wrap a simple statement in `if condition:`; header lines and lines continuing a statement are left alone. */
function guarded(text: string, condition: string): string | undefined {
  const body = text.trim()
  if (!body || body.endsWith(':') || /^(return|yield|break|continue|elif|else|except|finally)\b/.test(body)) return undefined
  const pad = text.slice(0, indentOf(text))
  return `${pad}if ${condition}:\n${pad}    ${body}`
}

/**
 * Re-indent mixed tab/space code by block depth: widths follow Python's rule (a tab moves to the next multiple of 8),
 * a deeper line without a `:` above it stays at the current depth, and each depth becomes 4 spaces.
 */
function respace(lines: readonly string[]): string[] {
  const width = (lead: string) => [...lead].reduce((column, char) => char === '\t' ? column + 8 - (column % 8) : column + 1, 0)
  const stack = [0]
  let opens = false
  return lines.map((line) => {
    const lead = /^[\t ]*/.exec(line)![0]
    const body = line.slice(lead.length)
    if (!body.trim()) return line.trim() ? line : ''
    const comment = body.startsWith('#')
    let column = width(lead)
    if (column > stack.at(-1)!) {
      if (opens && !comment) stack.push(column)
      else column = stack.at(-1)!
    } else {
      while (stack.length > 1 && stack.at(-1)! > column) stack.pop()
    }
    if (!comment) opens = /:\s*(#.*)?$/.test(body)
    return ' '.repeat((stack.length - 1) * 4) + body
  })
}

/** Parenthesised call `name(...)` on a line, with its top-level arguments. */
function callArguments(text: string, name: string): { open: number; close: number; args: string[] } | null {
  const start = new RegExp(`\\b${escape(name)}\\s*\\(`).exec(text)
  if (!start) return null
  const open = start.index + start[0].length - 1
  let depth = 0
  let quote = ''
  const args: string[] = []
  let from = open + 1
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (quote) { if (char === quote && text[index - 1] !== '\\') quote = ''; continue }
    if (char === '"' || char === "'") quote = char
    else if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) {
      depth -= 1
      if (depth === 0) {
        if (text.slice(from, index).trim()) args.push(text.slice(from, index).trim())
        return { open, close: index, args }
      }
    } else if (char === ',' && depth === 1) { args.push(text.slice(from, index).trim()); from = index + 1 }
  }
  return null
}

/** Rename a variable everywhere it is used as a plain name, leaving calls such as `name(` untouched when `keepCalls` is set. */
function renameVariable(code: string, from: string, to: string, keepCalls = false): string {
  return code.split('\n').map((line) => {
    let result = ''
    let last = 0
    for (const token of tokenizeLine(line)) {
      if (token.text !== from) continue
      if (keepCalls && /^\s*\(/.test(line.slice(token.to))) continue
      if (line[token.from - 1] === '.') continue
      result += line.slice(last, token.from) + to
      last = token.to
    }
    return result + line.slice(last)
  }).join('\n')
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function unclosedOn(text: string): boolean {
  let depth = 0
  for (const token of tokenizeLine(text)) {
    if (own(CLOSERS, token.text)) depth += 1
    else if (Object.values(CLOSERS).includes(token.text)) depth -= 1
  }
  return depth > 0
}

function strayCloser(text: string): Token | null {
  const stack: string[] = []
  for (const token of tokenizeLine(text)) {
    const closer = own(CLOSERS, token.text)
    if (closer) stack.push(closer)
    else if (Object.values(CLOSERS).includes(token.text)) {
      if (stack.at(-1) === token.text) stack.pop()
      else return token
    }
  }
  return null
}

type Pin = (line: number, from: number, to: number, mistake: Mistake, message: string, fixedLine?: string, fixLine?: number) => Pinpoint

/** Why a loop never ends: the condition's variables never change inside it, or the loop grows what it walks over. */
export function loopFix(lines: readonly string[], header: number, pin: Pin): Pinpoint {
  const text = lines[header - 1]
  const indent = indentOf(text)
  const body: number[] = []
  for (let index = header; index < lines.length && (!lines[index].trim() || indentOf(lines[index]) > indent); index += 1) {
    if (lines[index].trim()) body.push(index + 1)
  }
  const bodyText = body.map((line) => lines[line - 1]).join('\n')
  const keyword = /^\s*(while|for)\b/.exec(text)?.[1]
  if (keyword === 'for') {
    const iterable = /^\s*for\s+.+?\s+in\s+([A-Za-z_]\w*)\s*:/.exec(text)?.[1]
    if (iterable && new RegExp(`\\b${iterable}\\.(append|extend|insert)\\(|\\b${iterable}\\s*\\+=`).test(bodyText)) {
      return pin(header, text.indexOf(iterable), text.indexOf(iterable) + iterable.length, 'other',
        `This loop adds to ${code(iterable)} while walking over it, so it never reaches the end. Loop over a copy: ${code(`${iterable}[:]`)}, or collect new items in another list.`,
        text.replace(new RegExp(`\\bin\\s+${iterable}\\s*:`), `in ${iterable}[:]:`))
    }
    return pin(header, indent, text.trimEnd().length, 'other', 'This loop runs too long. Check what it walks over and what changes inside it.')
  }
  const condition = /^\s*while\s+(.*?)\s*:\s*(#.*)?$/.exec(text)?.[1] ?? ''
  if (/^(True|1)$/.test(condition)) {
    if (/\bbreak\b|\breturn\b/.test(bodyText)) {
      return pin(header, indent, text.trimEnd().length, 'other', `${code('while True')} only stops at a ${code('break')}, and the ${code('break')} here is never reached. Check the ${code('if')} that guards it.`)
    }
    const lastLine = body.at(-1)
    return pin(header, indent, text.trimEnd().length, 'other', `${code('while True')} never stops on its own. The fix adds a ${code('break')} so it runs once; move it under an ${code('if')} to stop at the right time, or use a real condition.`,
      lastLine ? `${lines[lastLine - 1]}\n${' '.repeat(indentOf(lines[lastLine - 1]))}break` : undefined, lastLine)
  }
  const names = [...new Set(tokenizeLine(condition).map((token) => token.text).filter((value) => /^[A-Za-z_]\w*$/.test(value) && !KEYWORDS.includes(value) && !BUILTINS.includes(value)))]
  const changed = names.filter((name) => new RegExp(`^\\s*${name}\\s*(?:[-+*/%]|//|\\*\\*)?=(?!=)|\\b${name}\\.(pop|append|remove|clear|extend|insert|popleft)\\(|^\\s*(?:\\w+\\s*,\\s*)*${name}\\s*(?:,\\s*\\w+\\s*)*=(?!=)`, 'm').test(bodyText))
  const stuck = names.find((name) => !changed.includes(name))
  if (stuck && body.length) {
    const bodyIndent = ' '.repeat(indentOf(lines[body[0] - 1]))
    const compare = new RegExp(`\\b${stuck}\\s*(<=?|>=?|!=)\\s*`).exec(condition)
    const truthy = condition.trim() === stuck || condition.trim() === `len(${stuck})` || new RegExp(`^len\\(${stuck}\\)\\s*(>|!=)\\s*0$`).test(condition.trim())
    const step = compare ? (compare[1].startsWith('<') ? `${stuck} += 1` : compare[1].startsWith('>') ? `${stuck} -= 1` : null) : truthy ? `${stuck}.pop(0)` : null
    const lastLine = body.at(-1)!
    const at = text.indexOf(stuck, text.indexOf('while') + 5)
    return pin(header, at, at + stuck.length, 'other',
      `Nothing inside this loop changes ${code(stuck)}, so ${code(condition)} stays true forever.${step ? ` Add ${code(step)} at the end of the loop body.` : ` Change ${code(stuck)} inside the loop so the condition can become false.`}`,
      step ? `${lines[lastLine - 1]}\n${bodyIndent}${step}` : undefined, step ? lastLine : undefined)
  }
  const direction = /\b(\w+)\s*(<=?)\s*.+/.exec(condition)
  if (direction && new RegExp(`^\\s*${direction[1]}\\s*-=`, 'm').test(bodyText)) {
    const line = body.find((entry) => new RegExp(`^\\s*${direction[1]}\\s*-=`).test(lines[entry - 1]))!
    const value = lines[line - 1]
    return pin(line, indentOf(value), value.trimEnd().length, 'other', `${code(direction[1])} moves away from the limit: the loop runs while it is small, but this line makes it smaller. Use ${code('+=')}.`, value.replace('-=', '+='))
  }
  const greater = /\b(\w+)\s*(>=?)\s*.+/.exec(condition)
  if (greater && new RegExp(`^\\s*${greater[1]}\\s*\\+=`, 'm').test(bodyText)) {
    const line = body.find((entry) => new RegExp(`^\\s*${greater[1]}\\s*\\+=`).test(lines[entry - 1]))!
    const value = lines[line - 1]
    return pin(line, indentOf(value), value.trimEnd().length, 'other', `${code(greater[1])} moves away from the limit: the loop runs while it is large, but this line makes it larger. Use ${code('-=')}.`, value.replace('+=', '-='))
  }
  return pin(header, indent, text.trimEnd().length, 'other', `This loop's condition ${code(condition)} never becomes false. Check how its values change inside the loop.`)
}

/** After a timeout without a line (the worker was force-stopped), check each loop for a condition that cannot change. */
/**
 * Last resort when neither the local rules nor Jev can explain an error: mark the expression Python reported (or the
 * whole line) with a short reason for the exception type, so every error with a line still points somewhere.
 */
export function markReported(input: DiagnoseInput): Pinpoint | null {
  const lines = input.code.split(/\r\n|\n|\r/)
  const text = input.line && input.line >= 1 && input.line <= lines.length ? lines[input.line - 1] : null
  const parsed = /^([A-Za-z_][\w.]*)(?::\s*(.*))?$/s.exec(input.message.trim().split(/\r?\n/).at(-1) ?? '')
  if (!text?.trim() || !parsed || parsed[1] === 'SystemExit' || parsed[1] === 'KeyboardInterrupt') return null
  const type = parsed[1].split('.').at(-1)!
  const detail = (parsed[2] ?? '').replace(/\s*\(<[^>]+>, line \d+\)\s*$/, '')
  const exact = input.column != null && input.endColumn != null && input.column < input.endColumn && input.endColumn <= text.length
  const from = exact ? input.column! : indentOf(text)
  const to = exact ? input.endColumn! : text.trimEnd().length
  const reason = Object.hasOwn(OTHER_ERRORS, type) ? OTHER_ERRORS[type] : `Python stopped here with ${code(type)}${detail ? `: ${detail}` : ''}.`
  return { line: input.line!, from, to, mistake: 'other', message: reason, confidence: 0.5 }
}

export function diagnoseTimeout(code: string): Pinpoint | null {
  const lines = code.split(/\r\n|\n|\r/)
  const pin: Pin = (line, from, to, mistake, message, fixedLine, fixLine) => ({
    line, from, to, mistake, message, confidence: 0.8,
    ...(fixedLine !== undefined ? { fixedLine } : {}), ...(fixLine !== undefined && fixLine !== line ? { fixLine } : {}),
  })
  const results = lines.flatMap((line, index) => /^\s*(while|for)\b/.test(line) ? [loopFix(lines, index + 1, pin)] : [])
  return results.find((result) => result.fixedLine !== undefined) ?? results.find((result) => !/never becomes false|runs too long/.test(result.message)) ?? results[0] ?? null
}

const SUSPECT_HEADER = /^\s*(if|elif|else|while|for|def|class|try|except|finally|with)\b/

/** Other lines with the same easy-to-spot mistakes, since Python stops at the first error. */
export function otherSuspects(code: string, except: number): number[] {
  const lines = code.split(/\r\n|\n|\r/)
  const names = definedNames(code)
  const found: number[] = []
  lines.forEach((text, index) => {
    const number = index + 1
    if (number === except || !text.trim() || text.trimStart().startsWith('#')) return
    const tokens = tokenizeLine(text)
    const end = text.slice(0, lineEnd(text))
    const first = tokens[0]
    if (SUSPECT_HEADER.test(text) && !end.endsWith(':') && !end.endsWith('\\') && !unclosedOn(text)) found.push(number)
    else if (tokens.some((token) => ['&&', '||', '===', '!==', '++', '--'].includes(token.text) || ['function', 'true', 'false', 'null'].includes(token.text))) found.push(number)
    else if (first && word(first.text) && !KEYWORDS.includes(first.text) && !names.has(first.text) && tokens[1] && word(tokens[1].text) && nearest(first.text, KEYWORDS)) found.push(number)
  })
  return found.slice(0, 5)
}
