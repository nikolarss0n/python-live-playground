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

/**
 * Detect C/Java/JS-style for headers that Python rejects.
 * Examples: for(i = 0; i < 10; i++):  ·  for (i=0; i<10; i++)
 */
export function looksLikeCStyleFor(source: string | undefined): boolean {
  if (!source) return false
  const s = source.replace(/\s+/g, ' ')
  if (!/\bfor\s*\(/.test(s)) return false
  // Classic three-part header, or ++ / -- increments
  if (/for\s*\([^)]*;[^)]*;[^)]*\)/.test(s)) return true
  if (/\+\+|--/.test(s) && /\bfor\s*\(/.test(s)) return true
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

  const sourceHint = [context?.sourceLine, context?.sourceSnippet]
    .filter(Boolean)
    .join('\n')

  // Pattern-specific coaching before the generic SyntaxError copy.
  if (
    (name === 'SyntaxError' || name === 'IndentationError') &&
    looksLikeCStyleFor(sourceHint || detail)
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
          'Python could not parse this program. Something is missing or in the wrong place (brackets, quotes, colons, or commas). If you meant a loop from another language, Python uses `for x in range(n):` instead of `for (i = 0; i < n; i++)`.',
        tip: 'Look at the marked line: match every (, [, {, and quote, and put a colon after if/for/def/while.',
        example: 'for i in range(10):\n    print(i)',
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
