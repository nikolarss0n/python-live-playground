/**
 * Explains a ??? from where it sits in the code: what kind of thing belongs there, why the line needs it,
 * and which names nearby could fill it. Pure text rules, no execution.
 */

export type SlotHint = { what: string; why: string; clues: string[] }

const CALL_WHY: Record<string, string> = {
  print: '`print` shows whatever you pass it in Results.',
  len: '`len` counts the items in what you pass it.',
  range: '`range(a, b)` counts from a up to, but not including, b.',
  int: '`int` turns text such as `"42"` into a whole number.',
  str: '`str` turns a value into text so it can be joined with other text.',
  sorted: '`sorted` returns a new list in order; it needs the items to sort.',
  zip: '`zip` pairs items from the lists you pass, position by position.',
  enumerate: '`enumerate` numbers each item of what you pass it.',
  Counter: '`Counter` counts how often each item appears in what you pass it.',
  dumps: '`json.dumps` turns a Python value into JSON text.',
  loads: '`json.loads` turns JSON text back into a Python value.',
  heappop: '`heapq.heappop` removes the smallest item from the heap you pass it.',
  append: '`append` adds the value you pass to the end of the list.',
  get: '`.get(key, default)` reads a key without crashing when it is missing.',
  sqrt: '`math.sqrt` returns the square root of the number you pass it.',
  join: '`"sep".join(items)` glues a list of strings into one string.',
  isinstance: '`isinstance(value, Type)` checks whether a value is that type.',
}

const KEYWORD_ARG: Record<string, { what: string; why: string }> = {
  key: {
    what: 'a function that picks what to sort or compare by',
    why: 'Python calls it on every item and orders the items by what it returns, e.g. `lambda item: item["year"]`.',
  },
  start: { what: 'the number to start counting from', why: '`enumerate` counts from 0 unless you give it a `start`.' },
  reverse: { what: '`True` or `False`', why: '`reverse=True` sorts from largest to smallest.' },
  frozen: { what: '`True` or `False`', why: 'A frozen dataclass cannot change after creation, so it can be used as a dict key.' },
  default: { what: 'the value to use when nothing else is given', why: 'Defaults let callers skip this argument.' },
}

const BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple', 'sorted', 'sum', 'min', 'max', 'abs', 'zip',
  'enumerate', 'isinstance', 'repr', 'round', 'any', 'all', 'map', 'filter', 'open', 'next', 'iter', 'type', 'super', 'self',
  'True', 'False', 'None',
])

function quote(name: string) {
  return `\`${name}\``
}

function openCall(before: string): { name: string; depth: number } | null {
  let depth = 0
  for (let index = before.length - 1; index >= 0; index--) {
    const char = before[index]
    if (char === ')' || char === ']' || char === '}') depth++
    else if (char === '(' || char === '[' || char === '{') {
      if (depth === 0) {
        if (char !== '(') return { name: char, depth }
        const name = /([\w.]+)\s*$/.exec(before.slice(0, index))?.[1] ?? ''
        return { name, depth }
      }
      depth--
    }
  }
  return null
}

function indentOf(line: string) {
  return line.length - line.trimStart().length
}

function enclosingDef(lines: readonly string[], row: number): { name: string; params: string[] } | null {
  const indent = indentOf(lines[row])
  for (let index = row - 1; index >= 0; index--) {
    const line = lines[index]
    if (!line.trim() || indentOf(line) >= indent) continue
    const match = /^\s*def\s+(\w+)\s*\((.*)\)\s*(?:->.*)?:/.exec(line)
    if (match) {
      const params = match[2].split(',').map((part) => part.trim().split(/[=:]/)[0].replace(/^\*+/, '').trim()).filter(Boolean)
      return { name: match[1], params }
    }
    if (indentOf(line) === 0) return null
  }
  return null
}

/** Names called or read with a dot below the blank that the code never defines. */
function undefinedNamesBelow(lines: readonly string[], row: number, pattern: RegExp): string[] {
  const code = lines.join('\n')
  const below = lines.slice(row + 1).join('\n')
  const names = new Set<string>()
  for (const match of below.matchAll(pattern)) {
    const name = match[1]
    if (BUILTINS.has(name)) continue
    const defined = new RegExp(`(^|\\n)\\s*(def|class)\\s+${name}\\b|\\b${name}\\s*=[^=]|\\bfor\\s+[^\\n]*\\b${name}\\b[^\\n]*\\bin\\b|\\bas\\s+${name}\\b|\\bimport\\s+[^\\n]*\\b${name}\\b|\\(\\s*[^)]*\\b${name}\\b[^)]*\\)\\s*:`)
    if (!defined.test(code)) names.add(name)
  }
  return [...names].slice(0, 3)
}

/** Variables assigned or looped over above the blank, most recent first. */
function namesAbove(lines: readonly string[], row: number, skip: string): string[] {
  const names: string[] = []
  for (let index = row; index >= 0; index--) {
    const code = lines[index].replace(/#.*$/, '')
    const found = [
      ...(/^\s*([A-Za-z_]\w*)\s*=[^=]/.exec(index === row ? '' : code)?.slice(1, 2) ?? []),
      ...(/\bfor\s+(.+?)\s+in\b/.exec(code)?.[1].split(',').map((name) => name.trim()) ?? []),
    ]
    for (const name of found) if (/^[A-Za-z_]\w*$/.test(name) && name !== skip && !names.includes(name)) names.push(name)
  }
  return names.slice(0, 4)
}

function firstUseBelow(lines: readonly string[], row: number, target: string): number | null {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[^\\w.])${escaped}(?!\\w)`)
  for (let index = row + 1; index < lines.length; index++) {
    const code = lines[index].replace(/#.*$/, '')
    if (pattern.test(code) && !new RegExp(`^\\s*${escaped}\\s*=[^=]`).test(code)) return index + 1
  }
  return null
}

export function explainSlot(code: string, offset: number): SlotHint {
  const lines = code.split('\n')
  let row = 0
  let lineStart = 0
  while (row < lines.length - 1 && lineStart + lines[row].length < offset) {
    lineStart += lines[row].length + 1
    row++
  }
  const line = lines[row] ?? ''
  const column = offset - lineStart
  const before = line.slice(0, column)
  const after = line.slice(column + 3)
  const statement = before.trim()
  const clues: string[] = []
  const owner = enclosingDef(lines, row)
  if (owner) {
    const params = owner.params.filter((param) => param !== 'self')
    if (params.length) clues.push(`Inside ${quote(owner.name)} you can use its parameter${params.length > 1 ? 's' : ''} ${params.map(quote).join(', ')}.`)
  }

  if (/^#/.test(statement)) {
    return { what: 'A short comment in plain words.', why: 'Comments explain the code to people; Python skips everything after `#`.', clues: [] }
  }
  if (/^import$/.test(statement) || /^import\s+[\w.]+\s*,$/.test(statement)) {
    const modules = undefinedNamesBelow(lines, row, /\b([A-Za-z_]\w*)\.\w+/g)
    if (modules.length) clues.unshift(`Lines below use ${modules.map((name) => quote(`${name}.`)).join(' and ')} — that is the module name.`)
    if (/^\s*as\s+(\w+)/.test(after)) clues.unshift('Check which file the code writes or which module it uses through the alias.')
    return { what: 'The name of a module to import.', why: '`import` loads another module so the code below can use what is inside it.', clues }
  }
  if (/^from\s+[\w.]+\s+import$/.test(statement)) {
    const names = undefinedNamesBelow(lines, row, /\b([A-Za-z_]\w*)\s*\(/g)
    if (names.length) clues.unshift(`The code below calls ${names.map(quote).join(', ')} without defining it.`)
    return { what: 'A name to bring in from that module.', why: '`from module import name` lets you call `name` directly, without the module prefix.', clues }
  }
  if (statement === 'return') {
    return { what: `The value ${owner ? quote(owner.name) : 'this function'} should hand back.`, why: 'Whatever follows `return` is what the caller receives and what Results shows for the call.', clues }
  }
  if (statement === 'yield') {
    return { what: 'The next value this generator produces.', why: 'Each `yield` pauses the function and hands one value to `next()` or a for loop.', clues }
  }
  const nearby = namesAbove(lines, row, '')
  const nearbyClue = nearby.length ? [`Names defined above: ${nearby.map(quote).join(', ')}.`] : []
  if (/^(if|elif)$/.test(statement)) {
    clues.push(...nearbyClue)
    return { what: 'A condition that is `True` or `False`.', why: 'Python runs the indented block below only when the condition is `True`.', clues }
  }
  if (statement === 'while' || /^while\s.*[<>=]=?$/.test(statement)) {
    return { what: statement === 'while' ? 'A condition that is `True` or `False`.' : 'The value to compare against.', why: 'The loop repeats while the condition stays `True`, so it must turn `False` at some point or it never stops.', clues }
  }
  if (statement === 'assert') {
    clues.push(...nearbyClue)
    return { what: 'A condition that should be `True`.', why: '`assert` does nothing when the condition is `True` and stops the program with an error when it is `False`.', clues }
  }
  if (statement === 'except') {
    return { what: 'The type of error to catch, such as `ValueError` or `KeyError`.', why: 'Only that error type jumps into the except block. `int("oops")` raises `ValueError`.', clues }
  }
  if (/\bfor\s+.+\s+in$/.test(statement)) {
    return { what: 'Something to loop over: a list, a `range(...)`, a dict…', why: 'A for loop takes one item at a time from it.', clues }
  }
  if (/\bif$/.test(statement) && /\bfor\b/.test(statement)) {
    return { what: 'A condition that keeps an item.', why: 'In a comprehension, only items where the condition is `True` end up in the result.', clues }
  }

  const comparison = /\s(is not|is|==|!=|>=|<=|<|>)$/.exec(statement)
  if (comparison && /^(if|elif|while|assert|return)\b|=\s/.test(statement)) {
    clues.push(...nearbyClue)
    return {
      what: 'The value to compare against.',
      why: comparison[1].startsWith('is')
        ? '`is` checks for one exact object; in Python it is mostly used as `x is None` to test for “no value”.'
        : `${quote(comparison[1])} compares the left side with the value you put here and gives \`True\` or \`False\`.`,
      clues,
    }
  }

  const call = openCall(before)
  const keyword = /(\w+)\s*=$/.exec(statement)
  if (call && call.name !== '[' && call.name !== '{' && keyword) {
    const known = KEYWORD_ARG[keyword[1]]
    return {
      what: known ? `${known.what[0].toUpperCase()}${known.what.slice(1)}, for ${quote(`${keyword[1]}=`)}.` : `The value for the ${quote(keyword[1])} argument.`,
      why: known?.why ?? `${quote(`${keyword[1]}=`)} names which parameter of ${quote(`${call.name}()`)} you are setting.`,
      clues,
    }
  }

  const assignment = /^([\w.[\]"']+)\s*(=|\+=|-=)$/.exec(statement)
  if (assignment && !call) {
    const target = assignment[1]
    if (assignment[2] !== '=') {
      const verb = assignment[2] === '+=' ? 'add to' : 'subtract from'
      return {
        what: `How much to ${verb} ${quote(target)}.`,
        why: `${quote(`${target} ${assignment[2]} n`)} is short for ${quote(`${target} = ${target} ${assignment[2][0]} n`)}.`,
        clues,
      }
    }
    const use = firstUseBelow(lines, row, target)
    if (target.startsWith('self.')) {
      const inInit = owner?.name === '__init__'
      return {
        what: `The value to keep in ${quote(target)}.`,
        why: inInit
          ? `\`__init__\` runs when the object is created, and saving the value on \`self\` lets other methods read ${quote(target)} later.`
          : `This updates ${quote(target)} on the object; the right-hand side can use its current value.`,
        clues,
      }
    }
    const known = namesAbove(lines, row, '').includes(target)
    if (known) {
      return {
        what: `The new value for ${quote(target)}.`,
        why: `${quote(target)} already has a value, so the new one can be built from it, e.g. ${quote(`${target} + 1`)}.`,
        clues,
      }
    }
    return {
      what: `The value to store in ${quote(target)}.`,
      why: use ? `Line ${use} reads ${quote(target)}, so its value decides what that line does.` : `${quote(target)} holds this value for the lines that follow.`,
      clues,
    }
  }

  if (/[\w)\]"']$/.test(before.trimEnd()) && /^\s*[\w("[]/.test(after) && !call) {
    return {
      what: 'An operator.',
      why: 'Pick the one the task describes: `//` whole division, `%` remainder, `**` power, `+=` add to the current value, `==` compare.',
      clues,
    }
  }

  const dictKey = /^["'](\w+)["']\s*:$/.exec(statement)
  if (dictKey) {
    return { what: `The value for the ${quote(dictKey[1])} key.`, why: 'A dict pairs each key with a value; code reads it back with `data["key"]`.', clues }
  }
  if (call && call.name === '[') return { what: 'An item for this list or index.', why: 'Square brackets build a list, or pick an item or slice from one.', clues }
  if (call && call.name === '{') {
    const key = /["'](\w+)["']\s*:\s*$/.exec(statement)
    return key
      ? { what: `The value for the ${quote(key[1])} key.`, why: 'A dict pairs each key with a value; code reads it back with `data["key"]`.', clues }
      : { what: 'An item for this set or dict.', why: 'Curly braces build a set (`{1, 2}`) or a dict (`{"key": value}`).', clues }
  }
  if (call && !call.name) {
    return { what: 'An item for this tuple.', why: 'Parentheses with commas group values into a tuple, read in order.', clues }
  }
  if (call) {
    const fn = call.name.split('.').pop() || call.name
    return {
      what: `What to pass to ${quote(`${call.name}()`)}.`,
      why: CALL_WHY[fn] ?? `${quote(`${call.name}()`)} needs this input to do its job.`,
      clues,
    }
  }
  const method = /^\.(\w+)\(/.exec(after)
  if (statement === '' && method) {
    return {
      what: method[1] === 'append' ? 'The list to add to.' : `The object whose ${quote(`.${method[1]}()`)} runs here.`,
      why: method[1] === 'append' ? '`some_list.append(x)` adds x to the end of the list written before the dot.' : 'The name before the dot is the object the method works on.',
      clues: [...nearbyClue, ...clues],
    }
  }
  if (statement === '') return { what: 'A complete line of Python.', why: 'This whole line is yours to write.', clues }
  return { what: 'The missing part of this line.', why: 'Read the whole line aloud with a guess in place of `???` and check it makes sense.', clues }
}
