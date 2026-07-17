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

/**
 * Build a structured, teachable explanation from an exception name + message.
 */
export function explainError(
  nameOrMessage: string,
  message?: string,
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
          'Python could not parse this program. Something is missing or in the wrong place (brackets, quotes, colons, or commas).',
        tip: 'Look at the marked line: match every (, [, {, and quote, and put a colon after if/for/def/while.',
        example: 'if True:\n    print("ok")',
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

    case 'TimeoutError':
      return {
        title: 'Took too long',
        name,
        detail,
        summary:
          'This program ran longer than the time limit. Often that means an infinite loop or a very heavy calculation.',
        tip: 'Press Stop if it is still running, then check loop conditions (for example, while True needs a break).',
        example: 'n = 0\nwhile n < 3:\n    print(n)\n    n += 1',
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
export function friendlyErrorMessage(name: string, message: string): string {
  const e = explainError(name, message)
  return `${e.name}: ${e.detail}\n\n${e.summary}\n\n${e.tip}`
}

export function parseErrorName(message: string): string {
  return extractNameMessage(message).name
}

/** Attach a structured explanation to a raw error event. */
export function enrichErrorEvent(event: {
  kind: 'error'
  message: string
  friendly: string
  traceback: string
  line?: number
  explanation?: ErrorExplanation
}): {
  kind: 'error'
  message: string
  friendly: string
  traceback: string
  line?: number
  explanation: ErrorExplanation
} {
  const explanation = event.explanation ?? explainError(event.message)
  return {
    ...event,
    explanation,
    friendly: friendlyErrorMessage(explanation.name, explanation.detail),
  }
}
