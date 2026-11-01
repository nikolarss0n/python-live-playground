/**
 * Beginner-facing explanations for common Python errors.
 * Pure TypeScript so the UI and tests do not need Pyodide.
 */

export type ErrorExplanation = {
  /** Short headline, e.g. "Division by zero" */
  title: string
  /** Exception type, e.g. ZeroDivisionError */
  name: string
  /** Original short message after the type */
  detail: string
  /** Plain-language what happened */
  summary: string
  /** Concrete next step */
  tip: string
  /** Optional tiny example snippet */
  example?: string
}

const DEFAULT_SUMMARY = 'Something went wrong while running this code.'
const DEFAULT_TIP = 'Read the message above, change the code, and run again.'

function interpolationEnd(source: string, start: number): number {
  let braces = 1
  let quote = ''
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === '\\') index += 1
      else if (source.startsWith(quote, index)) { index += quote.length - 1; quote = '' }
    } else if (character === '"' || character === "'") {
      quote = source.startsWith(character.repeat(3), index) ? character.repeat(3) : character
      index += quote.length - 1
    } else if (character === '{') braces += 1
    else if (character === '}' && --braces === 0) return index
  }
  return source.length
}

function hasStarterBlank(source: string, depth = 0): boolean {
  if (depth > 16) return false
  let quote = ''
  let formatted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (formatted && character === '{') {
        if (source[index + 1] === '{') index += 1
        else {
          const end = interpolationEnd(source, index + 1)
          if (hasStarterBlank(source.slice(index + 1, end), depth + 1)) return true
          index = end
        }
      } else if (character === '\\') index += 1
      else if (source.startsWith(quote, index)) {
        index += quote.length - 1
        quote = ''
        formatted = false
      }
    } else if (character === '#') {
      const end = source.indexOf('\n', index)
      if (end === -1) break
      index = end
    } else if (character === '"' || character === "'") {
      formatted = /(?:^|[^A-Za-z0-9_])(?:f|fr|rf)$/i.test(source.slice(0, index))
      quote = source.startsWith(character.repeat(3), index) ? character.repeat(3) : character
      index += quote.length - 1
    } else if (source.startsWith('???', index)) return true
  }
  return false
}

function extractNameMessage(raw: string): { name: string; detail: string } {
  const cleaned = raw.replace(/^Error:\s*/i, '').trim()
  const match = /^([A-Za-z_][A-Za-z0-9_]*(?:Error|Warning|Exception)?)\s*:\s*(.*)$/s.exec(
    cleaned,
  )
  if (match) {
    return { name: match[1], detail: match[2].trim() || match[1] }
  }
  const bare = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(cleaned)
  return {
    name: bare?.[1] ?? 'Error',
    detail: cleaned || 'Unknown error',
  }
}

function nameFromNameError(detail: string): string | null {
  const m =
    /name ['"]([^'"]+)['"] is not defined/i.exec(detail) ??
    /name ['"]([^'"]+)['"]/i.exec(detail)
  return m?.[1] ?? null
}

function attrFromAttributeError(detail: string): {
  obj?: string
  attr?: string
} {
  const m =
    /'([^']+)' object has no attribute '([^']+)'/i.exec(detail) ??
    /module '([^']+)' has no attribute '([^']+)'/i.exec(detail)
  if (m) return { obj: m[1], attr: m[2] }
  return {}
}

export type ExplainContext = {
  /** Text of the failing source line (1-based line content), when known */
  sourceLine?: string
  /** Nearby source lines for multi-line mistakes */
  sourceSnippet?: string
}

type SyntaxAdvice = Pick<ErrorExplanation, 'title' | 'summary' | 'tip' | 'example'>

function codeOutsideStrings(source: string): string {
  const characters = source.split('')
  let quote = ''
  let formatted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      characters[index] = character === '\n' ? '\n' : ' '
      if (formatted && character === '{') {
        if (source[index + 1] === '{') characters[++index] = ' '
        else {
          const end = interpolationEnd(source, index + 1)
          for (let offset = index + 1; offset <= end && offset < source.length; offset += 1) {
            characters[offset] = source[offset] === '\n' ? '\n' : ' '
          }
          index = end
        }
      } else if (character === '\\') {
        index += 1
        if (index < source.length) characters[index] = source[index] === '\n' ? '\n' : ' '
      } else if (source.startsWith(quote, index)) {
        for (let offset = 0; offset < quote.length; offset += 1) characters[index + offset] = source[index + offset]
        index += quote.length - 1
        quote = ''
        formatted = false
      }
    } else if (character === '#') {
      while (index < source.length && source[index] !== '\n') characters[index++] = ' '
      index -= 1
    } else if (character === '"' || character === "'") {
      formatted = /(?:^|[^A-Za-z0-9_])(?:f|fr|rf)$/i.test(source.slice(0, index))
      quote = source.startsWith(character.repeat(3), index) ? character.repeat(3) : character
      index += quote.length - 1
    }
  }
  return characters.join('')
}

function matchingParenthesis(code: string, start: number): number | null {
  let depth = 0
  for (let index = start; index < code.length; index += 1) {
    if (code[index] === '(') depth += 1
    else if (code[index] === ')' && --depth === 0) return index
  }
  return null
}

function exampleBody(sourceLine: string, context?: ExplainContext): string {
  const lines = context?.sourceSnippet?.split(/\r?\n/) ?? []
  const position = lines.findIndex((line) => line.trim() === sourceLine.trim())
  if (position >= 0) {
    const indentation = /^[\t ]*/.exec(sourceLine)?.[0].length ?? 0
    for (const line of lines.slice(position + 1)) {
      if (!line.trim()) continue
      const bodyIndent = /^[\t ]*/.exec(line)?.[0].length ?? 0
      if (bodyIndent <= indentation) break
      const trimmed = line.trim()
      const code = codeOutsideStrings(trimmed).trim()
      if (!code) continue
      if (/^(?:print\s*\(|return\b|[A-Za-z_]\w*\s*=)/.test(code) && !code.endsWith(':') && !hasStarterBlank(trimmed)) {
        return trimmed
      }
      break
    }
  }
  return 'pass  # Add your function or block body here.'
}

function blockExample(header: string, sourceLine: string, context?: ExplainContext): string {
  return `${header.trim()}\n    ${exampleBody(sourceLine, context)}`
}

function functionAdvice(sourceLine: string, context?: ExplainContext): SyntaxAdvice | null {
  const code = codeOutsideStrings(sourceLine)
  const header = /^\s*(async\s+)?function\s+([A-Za-z_]\w*)\s*\(/.exec(code)
  if (!header) return null
  const opening = header[0].lastIndexOf('(')
  const closing = matchingParenthesis(code, opening)
  if (closing === null) return null
  const after = code.slice(closing + 1).trimStart()
  if (after && !after.startsWith(':') && !after.startsWith('{')) return null
  const pythonHeader = `${header[1] ? 'async ' : ''}def ${header[2]}${sourceLine.slice(opening, closing + 1)}:`
  const colon = code.indexOf(':', closing + 1)
  const inlineBody = after.startsWith(':') && colon >= 0 ? sourceLine.slice(colon + 1).trim() : ''
  const body = inlineBody && codeOutsideStrings(inlineBody).trim()
    ? inlineBody
    : exampleBody(sourceLine, context)
  return {
    title: 'Use def to define a Python function',
    summary: '`function` is JavaScript syntax. A Python function starts with `def`, followed by its name, arguments, and a colon.',
    tip: `Replace \`function\` with \`def\` in \`${header[2]}(...)\`, then keep the body indented one level.`,
    example: `${pythonHeader}\n    ${body}`,
  }
}

function declarationAdvice(sourceLine: string): SyntaxAdvice | null {
  const code = codeOutsideStrings(sourceLine)
  const declaration = /^(\s*)(let|const|var)\s+([A-Za-z_]\w*)\s*=(?!=)/.exec(code)
  if (!declaration) return null
  const keywordStart = declaration[1].length
  const valueStart = keywordStart + declaration[2].length
  return {
    title: 'Assign the variable without a declaration keyword',
    summary: `Python does not put \`${declaration[2]}\` before a variable assignment.`,
    tip: `Remove \`${declaration[2]}\` and start this assignment with \`${declaration[3]} =\`.`,
    example: sourceLine.slice(valueStart).trim(),
  }
}

function operatorAdvice(sourceLine: string, context?: ExplainContext): SyntaxAdvice | null {
  const code = codeOutsideStrings(sourceLine)
  const tokens = [...code.matchAll(/(?<!=)(?:!==|===)(?!=)|(?<!&)&&(?!&)|(?<!\|)\|\|(?!\|)/g)]
  if (!tokens.length) return null
  const replacements: Record<string, string> = { '===': '==', '!==': '!=', '&&': 'and', '||': 'or' }
  let rewritten = ''
  let previous = 0
  for (const token of tokens) {
    const replacement = replacements[token[0]]
    const index = token.index
    const end = index + token[0].length
    const logical = token[0] === '&&' || token[0] === '||'
    const before = logical && index > 0 && !/\s/.test(sourceLine[index - 1]) ? ' ' : ''
    const after = logical && end < sourceLine.length && !/\s/.test(sourceLine[end]) ? ' ' : ''
    rewritten += sourceLine.slice(previous, index) + before + replacement + after
    previous = end
  }
  rewritten += sourceLine.slice(previous)
  const substitutions = [...new Set(tokens.map((token) => `\`${token[0]}\` → \`${replacements[token[0]]}\``))].join(', ')
  const hasBlock = /^(?:if|elif|while)\b/.test(code.trimStart()) && code.trimEnd().endsWith(':')
  return {
    title: 'Use Python comparison and logical operators',
    summary: 'These JavaScript operator spellings are not Python syntax. Python compares values with == or != and combines conditions with `and` and `or`.',
    tip: `On this line, use ${substitutions}.`,
    example: hasBlock ? blockExample(rewritten, sourceLine, context) : rewritten.trim(),
  }
}

function colonAdvice(sourceLine: string, detail: string, context?: ExplainContext): SyntaxAdvice | null {
  if (!/expected\s+['"]:['"]/i.test(detail)) return null
  const code = codeOutsideStrings(sourceLine).trimEnd()
  if (code.endsWith(':') || !/^\s*(?:(?:async\s+)?(?:def|for|with)|class|if|elif|else|while|try|except|finally|match|case)\b/.test(code)) return null
  let nesting = 0
  for (let index = 0; index < code.length; index += 1) {
    if ('([{'.includes(code[index])) nesting += 1
    else if (')]}'.includes(code[index])) nesting -= 1
    else if (code[index] === ':' && code[index + 1] !== '=' && nesting === 0) return null
  }
  const header = `${sourceLine.slice(0, code.length)}:${sourceLine.slice(code.length)}`
  return {
    title: 'Add a colon after the block header',
    summary: 'Python reported that this block header is missing its ending colon.',
    tip: 'Add `:` at the end of the header, before any comment, and indent the following body.',
    example: blockExample(header, sourceLine, context),
  }
}

function indentationAdvice(name: string, detail: string, sourceLine: string): SyntaxAdvice | null {
  if (name === 'TabError') return {
    title: 'Use one indentation style',
    summary: 'Tabs and spaces are mixed in a way that makes this block ambiguous.',
    tip: 'Replace indentation tabs with spaces and align statements in the same block. Four spaces per level is the usual convention.',
  }
  if (name !== 'IndentationError') return null
  if (/expected an indented block/i.test(detail)) return {
    title: 'Indent the body after the header',
    summary: 'A function, condition, or loop header needs an indented body beneath it.',
    tip: 'Indent the body one level under the preceding header, usually four spaces. Keep later statements in that body aligned.',
    ...(sourceLine.trim() ? { example: `    ${sourceLine.trim()}` } : {}),
  }
  if (/unexpected indent/i.test(detail)) return {
    title: 'This line is indented too far',
    summary: 'Python did not expect a new indentation level at this line.',
    tip: 'Align this line with the surrounding statements in the same block. Add an indentation level only after a block header.',
  }
  return null
}

/**
 * Detect C/Java/JS-style for headers that Python rejects.
 * Examples: for(i = 0; i < 10; i++):  ·  for (i=0; i<10; i++)
 */
export function looksLikeCStyleFor(source: string | undefined): boolean {
  if (!source) return false
  const s = codeOutsideStrings(source)
  if (!/^\s*for\s*\(/m.test(s)) return false
  // Classic three-part header, or ++ / -- increments
  if (/for\s*\([^)]*;[^)]*;[^)]*\)/.test(s)) return true
  if (/for\s*\([^)]*(?:\+\+|--)[^)]*\)/.test(s)) return true
  return false
}

/**
 * Suggest a Python range-based rewrite from a C-style for header when possible.
 */
export function suggestPythonForFromCStyle(sourceLine: string): string {
  // for (i = 0; i < 10; i++)  or  for(i=0; i<10; i++):
  const normalized = sourceLine.replace(/\s+/g, ' ').trim()
  const less =
    /for\s*\(\s*([A-Za-z_]\w*)\s*=\s*(\d+)\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\s*\+\+\s*\)/.exec(
      normalized,
    )
  const lessEq =
    /for\s*\(\s*([A-Za-z_]\w*)\s*=\s*(\d+)\s*;\s*\1\s*<=\s*(\d+)\s*;\s*\1\s*\+\+\s*\)/.exec(
      normalized,
    )
  const m = less ?? lessEq

  if (m) {
    const [, name, start, endRaw] = m
    const end = lessEq ? String(Number(endRaw) + 1) : endRaw
    if (start === '0') {
      return `for ${name} in range(${end}):\n    print(${name})`
    }
    return `for ${name} in range(${start}, ${end}):\n    print(${name})`
  }

  return `for i in range(10):\n    print(i)`
}

/**
 * Build a structured, teachable explanation from an exception name + message.
 */
export function explainError(
  nameOrMessage: string,
  message?: string,
  context?: ExplainContext,
): ErrorExplanation {
  let name: string
  let detail: string

  if (message !== undefined) {
    name = nameOrMessage
    detail = message
  } else {
    const parsed = extractNameMessage(nameOrMessage)
    name = parsed.name
    detail = parsed.detail
  }

  // Normalize names that arrived as full "Type: msg"
  if (name.includes(':')) {
    const parsed = extractNameMessage(name)
    name = parsed.name
    if (!message) detail = parsed.detail
  }

  const sourceHint = context?.sourceLine ?? context?.sourceSnippet ?? ''

  if (name === 'SyntaxError' && hasStarterBlank(sourceHint)) {
    return {
      title: 'Finish the starter blank',
      name,
      detail,
      summary: 'The ??? marks a part of this exercise for you to complete. It is not Python syntax.',
      tip: 'Replace ??? with Python for the current task. Open the lesson instructions for a hint, then run again.',
    }
  }

  if (name === 'SyntaxError') {
    const advice = functionAdvice(sourceHint, context) ?? declarationAdvice(sourceHint) ??
      (looksLikeCStyleFor(sourceHint) ? null : operatorAdvice(sourceHint, context) ?? colonAdvice(sourceHint, detail, context))
    if (advice) return { ...advice, name, detail }
  }

  const indentation = indentationAdvice(name, detail, context?.sourceLine ?? '')
  if (indentation) return { ...indentation, name, detail }

  // Pattern-specific coaching before the generic SyntaxError copy.
  if (
    (name === 'SyntaxError' || name === 'IndentationError') &&
    looksLikeCStyleFor(sourceHint)
  ) {
    const line = context?.sourceLine?.trim() || 'for(i = 0; i < 10; i++):'
    return {
      title: 'That for-loop is not Python',
      name,
      detail,
      summary:
        'Python does not use C/JavaScript-style for loops with parentheses, semicolons, and `++`. A for-loop walks a sequence (often from `range`).',
      tip: 'Write `for name in range(...):` and indent the body. There is no `i++` — range already advances the counter.',
      example: suggestPythonForFromCStyle(line),
    }
  }

  switch (name) {
    case 'ZeroDivisionError':
      return {
        title: 'Division by zero',
        name,
        detail,
        summary:
          'Python tried to divide by 0. Division needs a non-zero number on the right-hand side.',
        tip: 'Change the divisor so it is not zero before you divide.',
        example: 'a = 10\nb = 2\na / b  # 5.0',
      }

    case 'NameError': {
      const missing = nameFromNameError(detail)
      return {
        title: missing ? `Unknown name: ${missing}` : 'Unknown name',
        name,
        detail,
        summary: missing
          ? `Python does not know what \`${missing}\` means yet. Names only work after you create them (or if they are built in).`
          : 'Python hit a name it has never seen in this program.',
        tip: missing
          ? `Create it first with \`${missing} = ...\`, or check the spelling of \`${missing}\`.`
          : 'Create the name with an assignment before you use it, and double-check spelling.',
        example: missing
          ? `${missing} = 1\nprint(${missing})`
          : 'count = 1\nprint(count)',
      }
    }

    case 'SyntaxError':
      return {
        title: 'Code could not be read',
        name,
        detail,
        summary:
          'Python could not parse this program. Something is missing or in the wrong place, such as a bracket, quote, colon, or comma.',
        tip: 'Look at the marked line: match every (, [, {, and quote, and put a colon after if/for/def/while.',
      }

    case 'IndentationError':
    case 'TabError':
      return {
        title: 'Indentation problem',
        name,
        detail,
        summary:
          'Python uses spaces at the start of a line to group code. This line does not line up with the block it belongs to.',
        tip: 'Use the same indentation for the whole block (4 spaces is the usual choice). Avoid mixing tabs and spaces.',
        example: 'for n in range(3):\n    print(n)',
      }

    case 'TypeError':
      return {
        title: 'Wrong kind of value',
        name,
        detail,
        summary:
          'An operation was given a value of a type it cannot use—like adding a number to a string, or calling something that is not a function.',
        tip: 'Check the types of the values involved. Convert with int(), str(), or list() when you mean to change type.',
        example: 'age = 12\nprint("Age: " + str(age))',
      }

    case 'ValueError':
      return {
        title: 'Value does not work here',
        name,
        detail,
        summary:
          'The type may be fine, but this particular value is not acceptable for the operation.',
        tip: 'Print the value just before the failing line and compare it with what the function expects.',
        example: 'number = int("42")  # ok\n# int("hello")  # ValueError',
      }

    case 'IndexError':
      return {
        title: 'Index out of range',
        name,
        detail,
        summary:
          'You asked for a position in a sequence that does not exist. Indexes start at 0 and stop at length − 1.',
        tip: 'Check len(sequence) and make sure your index is between 0 and len(sequence) - 1.',
        example: 'colors = ["red", "green"]\nprint(colors[0])  # red',
      }

    case 'KeyError': {
      const key =
        /^['"]([^'"]+)['"]$/.exec(detail)?.[1] ??
        (/^['"]/.test(detail) ? detail.replace(/^['"]|['"]$/g, '') : null)
      return {
        title: key ? `Missing key: ${key}` : 'Missing dictionary key',
        name,
        detail,
        summary: key
          ? `That dictionary has no entry for \`${key}\`.`
          : 'You looked up a key that is not in the dictionary.',
        tip: 'Use .get(key) if the key might be missing, or check with `key in dict` first.',
        example: 'person = {"name": "Ada"}\nprint(person.get("age", "unknown"))',
      }
    }

    case 'AttributeError': {
      const { obj, attr } = attrFromAttributeError(detail)
      return {
        title: attr ? `No attribute: ${attr}` : 'Missing attribute',
        name,
        detail,
        summary:
          obj && attr
            ? `A value of type \`${obj}\` has no attribute or method called \`${attr}\`.`
            : 'You used a dot to reach something that does not exist on this value.',
        tip: 'Print the value and its type (type(x)). Check the spelling of the attribute or method.',
        example: 'text = "hello"\nprint(text.upper())',
      }
    }

    case 'SimFastAPIError':
      return {
        title: 'Simulated FastAPI limit',
        name,
        detail,
        summary:
          'This playground runs a FastAPI-shaped simulator in the browser. It is not uvicorn and does not implement every FastAPI API.',
        tip: 'Use GET/POST/PUT/PATCH/DELETE, path params, query params, Header(), BaseModel bodies, and HTTPException. Probe with TestClient in the editor or Call in Results — not uvicorn.run.',
        example:
          'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/hello")\ndef hello():\n    return {"message": "hi"}',
      }

    case 'ModuleNotFoundError':
    case 'ImportError':
      return {
        title: 'Import did not work',
        name,
        detail,
        summary:
          'This playground only has the Python standard library available in the browser—not every package from a full desktop install.',
        tip: 'Try a standard-library module (math, json, random, …), or rewrite the idea without that package.',
        example: 'import math\nprint(math.sqrt(16))',
      }

    case 'RecursionError':
      return {
        title: 'Too many recursive calls',
        name,
        detail,
        summary:
          'A function kept calling itself without reaching a stopping point, so Python hit its recursion limit.',
        tip: 'Add a clear base case that returns without calling the function again.',
        example:
          'def countdown(n):\n    if n <= 0:\n        return\n    print(n)\n    countdown(n - 1)',
      }

    case 'TimeoutError': {
      const infinite =
        /infinite loop/i.test(detail) || /time limit/i.test(detail)
      return {
        title: infinite ? 'Possible infinite loop' : 'Took too long',
        name,
        detail,
        summary: infinite
          ? 'This program looked stuck in a loop that never finished. It was stopped so it could not freeze or overload the browser.'
          : 'This program ran longer than the playground allows and was stopped to protect the browser.',
        tip: 'Add a clear end condition (for example, change while True to while n < 10 and increase n each time). Use range(...) for counted loops.',
        example: 'n = 0\nwhile n < 3:\n    print(n)\n    n += 1',
      }
    }

    default:
      return {
        title: name.replace(/([a-z])([A-Z])/g, '$1 $2'),
        name,
        detail,
        summary: DEFAULT_SUMMARY,
        tip: DEFAULT_TIP,
      }
  }
}

/** Single string form for places that still need a flat message. */
export function friendlyErrorMessage(
  name: string,
  message: string,
  context?: ExplainContext,
): string {
  const e = explainError(name, message, context)
  return `${e.name}: ${e.detail}\n\n${e.summary}\n\n${e.tip}`
}

export function parseErrorName(message: string): string {
  return extractNameMessage(message).name
}

/**
 * Strip interpreter file/line noise already shown by the Line badge
 * (e.g. `… (<unknown>, line 1)`).
 */
export function cleanErrorDetail(detail: string): string {
  return detail
    .replace(/\s*\((?:<unknown>|[^()\n]+),\s*line\s+\d+\)\s*$/i, '')
    .replace(/\s+on line \d+\s*$/i, '')
    .trim()
}

/** 1-based line text from full source (empty if out of range). */
export function lineFromSource(source: string, lineNumber?: number): string {
  if (lineNumber == null || lineNumber < 1) return ''
  const lines = source.split(/\r?\n/)
  return lines[lineNumber - 1] ?? ''
}

/** Attach a structured explanation to a raw error event. */
export function enrichErrorEvent(
  event: {
    kind: 'error'
    message: string
    friendly: string
    traceback: string
    line?: number
    explanation?: ErrorExplanation
  },
  context?: ExplainContext,
): {
  kind: 'error'
  message: string
  friendly: string
  traceback: string
  line?: number
  explanation: ErrorExplanation
} {
  const explanation =
    event.explanation ?? explainError(event.message, undefined, context)
  return {
    ...event,
    explanation,
    friendly: `${explanation.name}: ${explanation.detail}\n\n${explanation.summary}\n\n${explanation.tip}`,
  }
}
