/**
 * Plain-language explanations for a word in the editor: Python keywords, built-ins, special methods, common methods
 * and modules, plus where a name in the learner's own code comes from (parameter, loop variable, assignment, import…).
 * Text rules only; nothing is executed.
 */

export type TokenInfo = { name: string; kind: string; text: string; origin?: string }

const KEYWORDS: Record<string, string> = {
  def: 'Starts a function definition: a name, its parameters in brackets, then an indented body that runs when the function is called.',
  class: 'Starts a class: a blueprint for objects. Methods defined inside it describe what each object can do.',
  return: 'Ends the function and hands the value after it back to whoever called the function.',
  yield: 'Pauses a generator and hands out one value; the function continues from here when the next value is asked for.',
  if: 'Runs the indented block only when the condition is True.',
  elif: '“else if”: checked only when the conditions above were False.',
  else: 'Runs when none of the conditions above were True (or, after a loop, when the loop was not broken).',
  for: 'Repeats the indented block once for every item, giving the loop variable the next item each time.',
  while: 'Repeats the indented block as long as the condition stays True.',
  in: 'In a for loop: “take each item from”. Elsewhere: tests membership, e.g. `x in items` is True when x is one of the items.',
  not: 'Flips True to False and False to True.',
  and: 'True only when both sides are True. Stops early if the left side is False.',
  or: 'True when either side is True. Stops early if the left side is True.',
  is: 'Checks for the very same object. Mostly used as `x is None`.',
  None: 'Python’s “no value”. Functions without a return give back None.',
  True: 'The boolean yes value.',
  False: 'The boolean no value.',
  import: 'Loads a module so this file can use what it defines.',
  from: 'With import: brings specific names out of a module, e.g. `from math import sqrt`.',
  as: 'Gives something a local name: `import numpy as np`, `with open(p) as f`, `except ValueError as e`.',
  with: 'Opens a context (a file, a lock, a session) and closes it automatically when the block ends, even on errors.',
  try: 'Runs the block and lets an except block catch errors from it.',
  except: 'Handles a specific kind of error raised in the try block above.',
  finally: 'Always runs after try/except, error or not — good for clean-up.',
  raise: 'Stops normal flow with an error that callers can catch.',
  lambda: 'A tiny unnamed function: `lambda x: x * 2` takes x and returns x * 2.',
  pass: 'Does nothing. A placeholder where Python needs a statement.',
  break: 'Leaves the nearest loop immediately.',
  continue: 'Skips the rest of this loop round and starts the next one.',
  assert: 'Checks a condition and stops with an error if it is False — a tiny built-in test.',
  global: 'Lets a function assign to a variable defined at the top level of the file.',
  nonlocal: 'Lets an inner function assign to a variable of the function around it.',
  del: 'Deletes a name, a list item or a dict key.',
  async: 'Marks a function as a coroutine that can pause at await without blocking others.',
  await: 'Waits for a coroutine or task to finish without blocking other async work.',
}

const BUILTINS: Record<string, string> = {
  print: 'Shows values as text. In this playground the output appears in Results next to the line.',
  len: 'Counts the items in a list, string, dict, set or tuple.',
  range: 'Produces numbers: `range(5)` is 0–4, `range(1, 5)` is 1–4, `range(0, 10, 2)` counts by twos.',
  list: 'Creates a list, or turns another collection into one.',
  dict: 'Creates a dictionary: key → value pairs.',
  set: 'Creates a set: unordered, no duplicates, very fast `in` checks.',
  tuple: 'Creates a tuple: a fixed-size, unchangeable sequence.',
  str: 'Text. `str(x)` turns a value into text.',
  int: 'Whole numbers. `int("42")` turns text into a number.',
  float: 'Numbers with a decimal point.',
  bool: 'True or False. `bool(x)` tells whether x counts as “truthy”.',
  sorted: 'Returns a new sorted list; `key=` picks what to sort by, `reverse=True` flips the order.',
  reversed: 'Walks a sequence from the end to the start.',
  sum: 'Adds up all the numbers in a collection.',
  min: 'The smallest item (or the smallest of several arguments).',
  max: 'The largest item (or the largest of several arguments).',
  abs: 'The distance from zero: `abs(-3)` is 3.',
  round: 'Rounds a number, optionally to some decimal places.',
  enumerate: 'Gives (index, item) pairs while looping, counting from 0 or from `start=`.',
  zip: 'Pairs items from several collections by position.',
  map: 'Applies a function to every item.',
  filter: 'Keeps the items for which a function returns True.',
  any: 'True if at least one item is truthy.',
  all: 'True if every item is truthy.',
  isinstance: 'Checks whether a value is of a given type.',
  type: 'Tells you the type of a value.',
  input: 'Reads a line typed by the user (not available in this browser playground).',
  open: 'Opens a file for reading or writing; use it with `with`.',
  next: 'Takes the next item from an iterator or generator.',
  iter: 'Gets an iterator from a collection.',
  super: 'Calls the parent class’s version of a method, e.g. `super().__init__(...)`.',
  repr: 'A developer-friendly text form of a value, with quotes on strings.',
  ValueError: 'The error raised when a value has the right type but a wrong content, e.g. `int("oops")`.',
  KeyError: 'The error raised when a dict has no such key.',
  IndexError: 'The error raised when a list index is past the end.',
  TypeError: 'The error raised when an operation gets the wrong type, e.g. adding text and a number.',
  ZeroDivisionError: 'The error raised when dividing by zero.',
  Exception: 'The base class for most errors; catching it catches nearly everything.',
}

const DUNDERS: Record<string, string> = {
  __init__: 'The initialiser. Python calls it automatically right after creating an object, e.g. `Counter()` runs `__init__`. It sets up the object’s starting attributes on `self`.',
  __repr__: 'Returns the text Python shows for the object in Results and the console.',
  __str__: 'Returns the text `print()` and `str()` use for the object.',
  __len__: 'Lets `len(obj)` work on the object.',
  __eq__: 'Defines what `==` means for two objects.',
  __enter__: 'Runs at the start of a `with` block; what it returns is bound to the name after `as`.',
  __exit__: 'Runs when a `with` block ends, even if an error happened inside it.',
  __iter__: 'Makes the object loopable with for.',
  __next__: 'Returns the next item when the object is used as an iterator.',
  __name__: 'The module’s name; it is "__main__" when the file is run directly.',
  __call__: 'Lets the object be called like a function.',
  __getitem__: 'Lets `obj[key]` work on the object.',
}

const METHODS: Record<string, string> = {
  append: 'Adds one item to the end of the list.',
  extend: 'Adds every item of another collection to the end of the list.',
  pop: 'Removes and returns an item — the last one for a list, or the given key for a dict.',
  insert: 'Puts an item at a position in the list.',
  remove: 'Deletes the first matching item from a list (or an item from a set).',
  sort: 'Sorts the list in place and returns None.',
  add: 'Puts an item into a set (nothing happens if it is already there).',
  get: 'Reads a dict key, returning a default (None unless given) when it is missing.',
  items: 'Gives (key, value) pairs of a dict, ready for a for loop.',
  keys: 'Gives the keys of a dict.',
  values: 'Gives the values of a dict.',
  update: 'Merges another dict (or items) into this one.',
  setdefault: 'Reads a key, first inserting a default if it is missing.',
  split: 'Breaks a string into a list of parts, on whitespace by default.',
  join: 'Glues a list of strings together with this string between them.',
  strip: 'Removes whitespace (or given characters) from both ends of a string.',
  lower: 'Returns the string in lowercase.',
  upper: 'Returns the string in uppercase.',
  replace: 'Returns a copy of the string with one piece swapped for another.',
  startswith: 'True if the string begins with the given text.',
  endswith: 'True if the string ends with the given text.',
  format: 'Fills {} placeholders in a string.',
  count: 'Counts how often a value appears.',
  index: 'Finds the position of the first matching item.',
  most_common: 'Counter method: the n most frequent items with their counts.',
  copy: 'Makes a shallow copy.',
  read_text: 'Reads a whole file as a string (pathlib).',
  write_text: 'Writes a string to a file, replacing its contents (pathlib).',
  heappush: 'Adds an item to a heap list, keeping the smallest item at index 0.',
  heappop: 'Removes and returns the smallest item of a heap list.',
  heapify: 'Rearranges a list in place into a heap.',
  sqrt: 'Square root.',
  dumps: 'Turns a Python value into JSON text.',
  loads: 'Turns JSON text into a Python value.',
  popleft: 'Removes and returns the item at the left end of a deque — fast, unlike list.pop(0).',
}

const MODULES: Record<string, string> = {
  math: 'The standard maths module: sqrt, floor, pi, inf…',
  random: 'Random numbers and choices.',
  json: 'Reads and writes JSON text.',
  heapq: 'Priority queues built on plain lists (smallest item first).',
  collections: 'Extra containers: Counter, defaultdict, deque, namedtuple.',
  functools: 'Tools for functions, such as lru_cache and partial.',
  itertools: 'Building blocks for loops: combinations, permutations, chain…',
  dataclasses: 'The @dataclass decorator that writes __init__ and __repr__ for you.',
  pathlib: 'Object-oriented file paths: Path("data.csv").read_text().',
  sys: 'Interpreter details such as sys.path and sys.modules.',
  re: 'Regular expressions for searching text.',
  asyncio: 'Runs async functions and tasks.',
  typing: 'Type hints such as Optional and Protocol.',
  csv: 'Reads and writes CSV files.',
  Counter: 'A dict that counts how often each item appears.',
  defaultdict: 'A dict that creates a default value for missing keys.',
  deque: 'A double-ended queue: fast appends and pops at both ends.',
  dataclass: 'Decorator that writes __init__, __repr__ and __eq__ from the class fields.',
  lru_cache: 'Decorator that remembers results so repeated calls with the same arguments are instant.',
  Path: 'A file-system path you can read, write and join with /.',
}

function wordAt(code: string, offset: number): { from: number; to: number; word: string } | null {
  const isWord = (char: string | undefined) => char !== undefined && /\w/.test(char)
  let from = offset
  let to = offset
  while (from > 0 && isWord(code[from - 1])) from--
  while (to < code.length && isWord(code[to])) to++
  if (from === to || /^\d/.test(code.slice(from, to))) return null
  return { from, to, word: code.slice(from, to) }
}

function escape(name: string) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineNumberAt(code: string, offset: number) {
  return code.slice(0, offset).split('\n').length
}

function indentOf(line: string) {
  return line.length - line.trimStart().length
}

/** The def that encloses `row` (0-based), with its line number and the class it belongs to. */
function enclosingDef(lines: readonly string[], row: number) {
  let indent = indentOf(lines[row])
  for (let index = row; index >= 0; index--) {
    const line = lines[index]
    if (index < row && (!line.trim() || indentOf(line) >= indent)) continue
    const def = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\((.*)\)/.exec(line)
    if (def) {
      let owner: string | undefined
      for (let up = index - 1; up >= 0; up--) {
        const classLine = /^(\s*)class\s+(\w+)/.exec(lines[up])
        if (classLine && classLine[1].length < def[1].length) {
          owner = classLine[2]
          break
        }
        if (lines[up].trim() && indentOf(lines[up]) === 0 && !classLine) break
      }
      return { name: def[2], params: def[3], line: index + 1, owner }
    }
    indent = indentOf(line)
    if (indent === 0) return null
  }
  return null
}

function originOf(lines: readonly string[], row: number, name: string): string | undefined {
  const word = escape(name)
  const def = enclosingDef(lines, row)
  if (def) {
    const param = new RegExp(`(?:^|,)\\s*\\*{0,2}${word}\\s*(?::[^,=]+)?(?:=\\s*([^,]+))?\\s*(?:,|$)`).exec(def.params)
    if (param) {
      const fallback = param[1] ? ` If the caller leaves it out it is ${param[1].trim()}.` : ''
      return `Parameter of \`${def.name}\` (line ${def.line}). Its value comes from each call, e.g. \`${def.name}(…)\`.${fallback}`
    }
  }
  let best: string | undefined
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/#.*$/, '')
    const number = index + 1
    let found: string | undefined
    if (new RegExp(`^\\s*(?:async\\s+)?def\\s+${word}\\s*\\(`).test(line)) found = `Function defined on line ${number}.`
    else if (new RegExp(`^\\s*class\\s+${word}\\b`).test(line)) found = `Class defined on line ${number}. Calling \`${name}(…)\` creates an object and runs its \`__init__\`.`
    else if (new RegExp(`^\\s*import\\s+.*\\b(?:as\\s+)?${word}\\b`).test(line)) found = `Imported on line ${number}.`
    else if (new RegExp(`^\\s*from\\s+([\\w.]+)\\s+import\\s+.*\\b${word}\\b`).test(line)) {
      found = `Imported from \`${/from\s+([\w.]+)/.exec(line)?.[1]}\` on line ${number}.`
    } else {
      const loop =
        new RegExp(`^\\s*(?:async\\s+)?for\\s+([^:]*?\\b${word}\\b[^:]*?)\\s+in\\s+(.+):\\s*$`).exec(line) ??
        new RegExp(`\\bfor\\s+([^:]*?\\b${word}\\b[^:]*?)\\s+in\\s+(.+?)(?:\\s+if\\b|\\s*[\\]}]|\\)\\s*$|$)`).exec(line)
      if (loop && new RegExp(`\\b${word}\\b`).test(loop[1])) {
        found = `Loop variable from line ${number}: it takes each item of \`${loop[2].trim()}\` in turn.`
      } else if (new RegExp(`\\bas\\s+${word}\\b`).test(line)) {
        found = `Named with \`as\` on line ${number}.`
      } else {
        const assign = new RegExp(`^\\s*(?:[\\w.]+\\s*,\\s*)*${word}(?:\\s*,\\s*[\\w.]+)*\\s*(?::[^=]+)?=(?!=)\\s*(.*)$`).exec(line)
        if (assign) found = `Variable set on line ${number}: \`${line.trim().slice(0, 60)}\`.`
      }
    }
    if (found && (index <= row || !best)) best = found
    if (found && index <= row && /^(Function|Class|Imported)/.test(found)) return found
  }
  return best
}

export function explainToken(code: string, offset: number): (TokenInfo & { from: number; to: number }) | null {
  const at = wordAt(code, offset)
  if (!at) return null
  const { word, from, to } = at
  const lines = code.split('\n')
  const row = lineNumberAt(code, from) - 1
  const before = code.slice(Math.max(0, from - 1), from)
  const result = (kind: string, text: string, origin?: string) => ({ name: word, kind, text, from, to, ...(origin ? { origin } : {}) })

  if (before === '.') {
    const base = /(\w+)\.$/.exec(code.slice(Math.max(0, from - 40), from))?.[1]
    if (base === 'self') {
      const set = lines.findIndex((line) => new RegExp(`self\\.${escape(word)}\\s*=(?!=)`).test(line))
      const method = lines.findIndex((line) => new RegExp(`^\\s*def\\s+${escape(word)}\\s*\\(`).test(line))
      if (method >= 0) return result('method', `A method of this object, defined on line ${method + 1}.`)
      return result('attribute', 'Data stored on this object. Every method of the class can read and change it through `self`.', set >= 0 ? `First set on line ${set + 1}.` : undefined)
    }
    if (METHODS[word]) return result('method', METHODS[word], base ? `Called on \`${base}\`.` : undefined)
    if (MODULES[word]) return result('name', MODULES[word])
    if (base && MODULES[base]) return result('function', `\`${word}\` from the \`${base}\` module.`)
    return result('attribute', `An attribute or method of \`${base ?? 'the object'}\`.`)
  }
  if (word === 'self') {
    const def = enclosingDef(lines, row)
    return result(
      'parameter',
      'The object this method is working on. Python passes it in automatically: `c.bump()` really runs `bump(c)`, so inside the method `self` is `c`.',
      def?.owner ? `First parameter of \`${def.name}\` in class \`${def.owner}\`.` : undefined,
    )
  }
  if (KEYWORDS[word]) return result('keyword', KEYWORDS[word])
  if (DUNDERS[word]) return result('special method', DUNDERS[word])
  const origin = originOf(lines, row, word)
  if (BUILTINS[word] && !origin) return result('built-in', BUILTINS[word])
  if (MODULES[word]) return result('module', MODULES[word], origin)
  if (origin) {
    const kind = origin.startsWith('Function') ? 'function' : origin.startsWith('Class') ? 'class' : origin.startsWith('Parameter') ? 'parameter' : origin.startsWith('Imported') ? 'import' : 'variable'
    return result(kind, origin)
  }
  return null
}
