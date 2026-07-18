/**
 * Lessons by difficulty. Each lesson leaves something to finish —
 * small, guided edits, not full demos or hard puzzles.
 */

import type { GoalCheck } from './goalCheck'
export type { GoalCheck, GoalProgress } from './goalCheck'
export { BLANK, evaluateGoal as checkLessonGoal } from './goalCheck'

export type Difficulty = 'beginner' | 'intermediate' | 'ai' | 'api'

export const DIFFICULTIES: Difficulty[] = [
  'beginner',
  'intermediate',
  'ai',
  'api',
]

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as string[]).includes(value)
}

/** Optional “predict then run” micro-quiz before the first run. */
export type LessonPredict = {
  prompt: string
  choices: string[]
  /** Index into choices */
  correctIndex: number
}

/** Side-by-side wrong vs fixed snippet (collapsed by default). */
export type LessonCompare = {
  wrong: string
  fixed: string
  note?: string
}

export type Lesson = {
  id: string
  difficulty: Difficulty
  number: number
  topic: string
  /** Book-style section for the lesson menu */
  chapter: string
  goal: string
  /** Short interactive steps shown under the goal */
  tasks: string[]
  code: string
  goalCheck?: GoalCheck
  /** Extra stuck hints beyond goal-check missing steps */
  hints?: string[]
  /** Quiet predict-then-run prompt (shown once per lesson visit) */
  predict?: LessonPredict
  /** Optional stretch after the main goal */
  stretch?: string
  /** Collapsible wrong vs fix teaching pair */
  compare?: LessonCompare
  /** Soft pipeline stages for AI / multi-step labs */
  pipeline?: string[]
  /**
   * Show “Run with model” using Settings API key + last printed prompt.
   * No chat sidebar — one-shot completion only.
   */
  runWithModel?: boolean
  /** Used when Results has no long print yet */
  modelPromptFallback?: string
}

type LessonDraft = Omit<Lesson, 'chapter' | 'stretch'> & {
  chapter?: string
  stretch?: string
}

function chapterFor(lesson: Pick<LessonDraft, 'difficulty' | 'number'>): string {
  if (lesson.difficulty === 'beginner') {
    if (lesson.number <= 4) return 'Basics'
    if (lesson.number <= 7) return 'Text & decisions'
    if (lesson.number <= 11) return 'Collections & loops'
    return 'Functions & pitfalls'
  }
  if (lesson.difficulty === 'intermediate') {
    if (lesson.number <= 4) return 'Sequences'
    if (lesson.number <= 8) return 'Structure'
    return 'Patterns & libraries'
  }
  if (lesson.difficulty === 'ai') {
    if (lesson.number <= 3) return 'Tokens & text'
    if (lesson.number <= 6) return 'Vectors & similarity'
    return 'Contracts & pipelines'
  }
  // Web APIs — FastAPI-shaped thinking, still in-browser (no real server)
  if (lesson.number <= 3) return 'HTTP basics'
  if (lesson.number <= 6) return 'Routing & bodies'
  return 'Middleware & apps'
}

function stretchFor(lesson: Pick<LessonDraft, 'topic' | 'stretch'>): string {
  return (
    lesson.stretch ??
    `Stretch: try one more small variation on “${lesson.topic}” once the goal works.`
  )
}

function finalizeLesson(draft: LessonDraft): Lesson {
  return {
    ...draft,
    chapter: draft.chapter ?? chapterFor(draft),
    stretch: stretchFor(draft),
  }
}

/** @deprecated use Lesson */
export type Example = Lesson

export const DEFAULT_DIFFICULTY: Difficulty = 'beginner'
export const DEFAULT_LESSON_ID = 'printing'
/** @deprecated use DEFAULT_LESSON_ID */
export const DEFAULT_EXAMPLE_ID = DEFAULT_LESSON_ID

export const DIFFICULTY_OPTIONS: { id: Difficulty; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'ai', label: 'AI foundations' },
  { id: 'api', label: 'Web APIs' },
]

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_OPTIONS.find((o) => o.id === d)?.label ?? d
}

export function lessonLabel(lesson: Lesson): string {
  return `Lesson ${lesson.number} · ${lesson.topic}`
}

export function lessonHeading(lesson: Lesson): string {
  return `${difficultyLabel(lesson.difficulty)} · ${lessonLabel(lesson)}`
}

const LESSON_DRAFTS: LessonDraft[] = [
  // ── Beginner ──────────────────────────────────────────
  {
    id: 'printing',
    difficulty: 'beginner',
    number: 1,
    topic: 'Printing',
    goal: 'Make Python show two messages that you chose yourself.',
    tasks: [
      'Change the first print so it greets you by name',
      'Fill in the second print (replace ???)',
    ],
    code: `# Lesson 1 — Printing
# Goal: Make Python show two messages that you chose yourself.
# Your turn: edit the prints below.

print("Hello, world!")
print(???)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 2,
    },
    hints: [
      'Replace ??? with a string in quotes, like "I am learning Python".',
    ],
    predict: {
      prompt: 'What will the first line print before you change it?',
      choices: ['Hello, world!', '???', 'Nothing'],
      correctIndex: 0,
    },
    stretch: 'Stretch: print a third line with today’s mood in quotes.',
    compare: {
      note: 'print needs parentheses and quotes around text.',
      wrong: 'print Hello',
      fixed: 'print("Hello")',
    },
  },
  {
    id: 'variables',
    difficulty: 'beginner',
    number: 2,
    topic: 'Variables',
    goal: 'Store your name and print a greeting that uses it.',
    tasks: [
      'Set name to your name (replace ???)',
      'Run and check the greeting on the right',
    ],
    code: `# Lesson 2 — Variables
# Goal: Store your name and print a greeting that uses it.
# Your turn: put your name in the variable.

name = ???
print(f"Hello, {name}!")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 1,
      codePatterns: ['name\\s*=\\s*["\'][^"\']+["\']'],
      printPatterns: ['Hello'],
    },
    predict: {
      prompt: 'If name = "Ada", what does f"Hello, {name}!" print?',
      choices: ['Hello, {name}!', 'Hello, Ada!', 'Ada'],
      correctIndex: 1,
    },
    compare: {
      note: 'Put text in quotes when you store a name.',
      wrong: 'name = Ada',
      fixed: 'name = "Ada"',
    },
  },
  {
    id: 'types',
    difficulty: 'beginner',
    number: 3,
    topic: 'Types',
    goal: 'Create one value of each type and convert a string to an int.',
    tasks: [
      'Fill age (int), price (float), label (str), ready (bool)',
      'Make number = int("42") work (fix ???)',
    ],
    code: `# Lesson 3 — Types
# Goal: Create one value of each type and convert a string to an int.
# Your turn: finish each assignment.

age = ???          # a whole number
price = ???        # a number with a decimal
label = ???        # text in quotes
ready = ???        # True or False

type(age)
type(price)
type(label)
type(ready)

number = int(???)  # try "42"
number
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minExprs: 1,
      codePatterns: ['int\\s*\\('],
    },
    predict: {
      prompt: 'int("42") produces which type of value?',
      choices: ['str', 'int', 'float'],
      correctIndex: 1,
    },
    compare: {
      note: 'Convert text that looks like a number with int().',
      wrong: 'number = "42" + 1',
      fixed: 'number = int("42")',
    },
  },
  {
    id: 'expressions',
    difficulty: 'beginner',
    number: 4,
    topic: 'Expressions',
    goal: 'Write two expressions that show values without using print.',
    tasks: [
      'Change 2 + 2 into a different calculation',
      'Add one more expression on its own line (no print)',
    ],
    code: `# Lesson 4 — Expressions
# Goal: Write two expressions that show values without using print.
# Your turn: edit these lines and watch the orange values on the right.

2 + 2
"Python" * 3

# Add your own expression below (example: 10 - 3)
???
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minExprs: 2,
    },
    predict: {
      prompt: 'In this playground, a bare line like 2 + 2…',
      choices: ['does nothing', 'shows a value on the right', 'crashes'],
      correctIndex: 1,
    },
    compare: {
      note: 'Top-level expressions show their value without print.',
      wrong: 'print = 2 + 2',
      fixed: '2 + 2',
    },
  },
  {
    id: 'strings',
    difficulty: 'beginner',
    number: 5,
    topic: 'Strings',
    goal: 'Slice a word and print an f-string with your own name.',
    tasks: [
      'Set word to any word of 4+ letters',
      'Change the slice and the f-string name',
    ],
    code: `# Lesson 5 — Strings
# Goal: Slice a word and print an f-string with your own name.
# Your turn: explore one word of text.

word = "Python"
len(word)
word[0]
word[0:3]       # try a different slice
word.upper()

name = ???
print(f"{name} loves {word}")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 1,
      codeIncludes: ['print(f"'],
    },
    predict: {
      prompt: '"Python"[0:3] is…',
      choices: ['"Pyt"', '"Pyth"', '"hon"'],
      correctIndex: 0,
    },
    compare: {
      note: 'f-strings put expressions inside braces.',
      wrong: 'print("name loves word")',
      fixed: 'print(f"{name} loves {word}")',
    },
  },
  {
    id: 'booleans',
    difficulty: 'beginner',
    number: 6,
    topic: 'Booleans',
    goal: 'Get both True and False to appear by changing score and comparisons.',
    tasks: [
      'Change score so score >= 60 is True',
      'Add one more comparison line that is False',
    ],
    code: `# Lesson 6 — Booleans
# Goal: Get both True and False to appear by changing score and comparisons.
# Your turn: tweak score and the comparisons.

score = 40
score >= 60
score == 100

# Write one more comparison that is False for your score:
???
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minExprs: 2,
    },
    predict: {
      prompt: 'If score = 40, is score >= 60 …',
      choices: ['True', 'False'],
      correctIndex: 1,
    },
    compare: {
      note: 'Comparisons use == for equality, not =.',
      wrong: 'score = 100',
      fixed: 'score == 100',
    },
  },
  {
    id: 'conditionals',
    difficulty: 'beginner',
    number: 7,
    topic: 'If decisions',
    goal: 'Make the program print "Passed" for your score.',
    tasks: [
      'Set score so the Passed branch runs (60–89)',
      'Then try a score that prints Excellent',
    ],
    code: `# Lesson 7 — If decisions
# Goal: Make the program print "Passed" for your score.
# Your turn: choose a score that prints "Passed".

score = ???

if score >= 90:
    print("Excellent")
elif score >= 60:
    print("Passed")
else:
    print("Try again")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      printsInclude: ['Passed'],
      codePatterns: ['score\\s*='],
    },
    predict: {
      prompt: 'score = 75 prints which message?',
      choices: ['Excellent', 'Passed', 'Try again'],
      correctIndex: 1,
    },
    compare: {
      note: 'elif runs only when earlier ifs were false.',
      wrong: 'if score >= 60:\n    print("Passed")\nif score >= 90:\n    print("Excellent")',
      fixed: 'if score >= 90:\n    print("Excellent")\nelif score >= 60:\n    print("Passed")',
    },
  },
  {
    id: 'lists',
    difficulty: 'beginner',
    number: 8,
    topic: 'Lists',
    goal: 'Put four numbers in a list and show their average.',
    tasks: [
      'Fill scores with four numbers of your choice',
      'Run and check the average on the right',
    ],
    code: `# Lesson 8 — Lists
# Goal: Put four numbers in a list and show their average.
# Your turn: use your own four scores.

scores = [???, ???, ???, ???]
scores[0]
len(scores)
average = sum(scores) / len(scores)
average
print(f"Average score: {average}")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['average ='],
      minExprs: 1,
    },
    predict: {
      prompt: 'For scores = [10, 20, 30, 40], len(scores) is…',
      choices: ['3', '4', '100'],
      correctIndex: 1,
    },
    compare: {
      note: 'Average is total divided by count.',
      wrong: 'average = sum(scores)',
      fixed: 'average = sum(scores) / len(scores)',
    },
  },
  {
    id: 'for-loops',
    difficulty: 'beginner',
    number: 9,
    topic: 'For loops',
    goal: 'Loop with range and print each number from 1 through 5.',
    tasks: [
      'Fix range so n goes 1, 2, 3, 4, 5',
      'Print each n (the print line is ready)',
    ],
    code: `# Lesson 9 — For loops
# Goal: Loop with range and print each number from 1 through 5.
# Your turn: finish the range so you see 1 through 5.

for n in range(???):
    print(n)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 5,
      printsInclude: ['1', '5'],
    },
    predict: {
      prompt: 'range(1, 6) yields…',
      choices: ['1..5', '1..6', '0..5'],
      correctIndex: 0,
    },
    compare: {
      note: 'range(stop) starts at 0; range(1, 6) is 1 through 5.',
      wrong: 'for n in range(5):\n    print(n)  # 0..4',
      fixed: 'for n in range(1, 6):\n    print(n)',
    },
  },
  {
    id: 'while-loops',
    difficulty: 'beginner',
    number: 10,
    topic: 'While loops',
    goal: 'Count with while and stop at the right time (print 0, 1, 2).',
    tasks: [
      'Complete the condition so the loop stops',
      'Increase n each time (replace ???)',
    ],
    code: `# Lesson 10 — While loops
# Goal: Count with while and stop at the right time (print 0, 1, 2).
# Your turn: print 0, 1, 2 then stop.

n = 0
while n < ???:
    print(n)
    n = ???
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 3,
      printsInclude: ['0', '1', '2'],
      codePatterns: ['n\\s*=\\s*n\\s*\\+\\s*1|n\\s*\\+=\\s*1'],
    },
    predict: {
      prompt: 'A while loop must eventually…',
      choices: ['print forever', 'make the condition false', 'use range'],
      correctIndex: 1,
    },
    compare: {
      note: 'Increase the counter or the loop never ends.',
      wrong: 'while n < 3:\n    print(n)',
      fixed: 'while n < 3:\n    print(n)\n    n = n + 1',
    },
  },
  {
    id: 'dicts',
    difficulty: 'beginner',
    number: 11,
    topic: 'Dictionaries',
    goal: 'Build a person dict and print their city with .get().',
    tasks: [
      'Fill name and year in the dict',
      'Print the city using .get("city", "unknown")',
    ],
    code: `# Lesson 11 — Dictionaries
# Goal: Build a person dict and print their city with .get().
# Your turn: finish the dict and the print.

person = {
    "name": ???,
    "year": ???,
}

person["city"] = "London"
print(person.get(???))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.get('],
      minNonEmptyPrints: 1,
    },
    predict: {
      prompt: 'person.get("city") after setting city to London…',
      choices: ['crashes', 'prints London', 'prints None always'],
      correctIndex: 1,
    },
    compare: {
      note: '.get avoids KeyError for missing keys.',
      wrong: 'print(person["country"])',
      fixed: 'print(person.get("country", "unknown"))',
    },
  },
  {
    id: 'functions',
    difficulty: 'beginner',
    number: 12,
    topic: 'Functions',
    goal: 'Write square(n) that returns n * n and call it.',
    tasks: [
      'Complete the return line inside square',
      'Call square with a number you choose',
    ],
    code: `# Lesson 12 — Functions
# Goal: Write square(n) that returns n * n and call it.
# Your turn: finish square and call it.

def greet(name):
    return f"Hello, {name}!"

print(greet("Ada"))

def square(n):
    return ???

square(???)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codePatterns: ['def\\s+square\\s*\\(', 'return\\s+n\\s*\\*\\s*n'],
      minExprs: 1,
    },
    predict: {
      prompt: 'square(4) should return…',
      choices: ['8', '16', '4'],
      correctIndex: 1,
    },
    compare: {
      note: 'return gives a value back to the caller.',
      wrong: 'def square(n):\n    print(n * n)',
      fixed: 'def square(n):\n    return n * n',
    },
  },
  {
    id: 'errors',
    difficulty: 'beginner',
    number: 13,
    topic: 'Reading errors',
    goal: 'Read the error, open “What does this mean?”, then make the code run.',
    tasks: [
      'Open “What does this mean?” on the error',
      'Change b so a / b works, then run cleanly',
    ],
    code: `# Lesson 13 — Reading errors
# Goal: Read the error, open “What does this mean?”, then make the code run.
# Your turn: fix the bug after reading the explanation.

a = 10
b = 0
a / b
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: false,
      codePatterns: ['b\\s*=\\s*(?!0\\b)\\d+'],
      minExprs: 1,
    },
    compare: {
      note: 'Division by zero is illegal — change the divisor.',
      wrong: 'a = 10\nb = 0\na / b',
      fixed: 'a = 10\nb = 2\na / b',
    },
    stretch: 'Stretch: also print a clear message when the math works.',
    predict: {
      prompt: 'What happens with a / b when b is 0?',
      choices: ['prints 0', 'raises an error', 'prints infinity'],
      correctIndex: 1,
    },
  },
  {
    id: 'python-for',
    difficulty: 'beginner',
    number: 14,
    topic: 'Python for-loops',
    goal: 'Rewrite the C-style loop as for i in range(10): and print i.',
    tasks: [
      'Open “What does this mean?” if you are stuck',
      'Replace the header with Python’s for + range',
    ],
    code: `# Lesson 14 — Python for-loops (repair lab)
# Goal: Rewrite the C-style loop as for i in range(10): and print i.
# Your turn: rewrite this in real Python.

for(i = 0; i < 10; i++):
    print(i)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: false,
      codeIncludes: ['for i in range', 'print(i)'],
      codeForbiddenPatterns: ['for\\s*\\(', 'i\\+\\+'],
      minNonEmptyPrints: 5,
    },
    compare: {
      note: 'Python uses for name in range(...): — not C-style headers.',
      wrong: 'for(i = 0; i < 10; i++):\n    print(i)',
      fixed: 'for i in range(10):\n    print(i)',
    },
    predict: {
      prompt: 'Python for-loops over numbers usually use…',
      choices: ['for(i=0; i<n; i++)', 'for i in range(n):', 'loop i to n'],
      correctIndex: 1,
    },
  },
  {
    id: 'infinite',
    difficulty: 'beginner',
    number: 15,
    topic: 'Infinite loops',
    goal: 'Stop the infinite loop by giving while a real end condition.',
    tasks: [
      'Run once and see the safety timeout',
      'Change it so it prints 0, 1, 2 and finishes',
    ],
    code: `# Lesson 15 — Infinite loops (safety lab)
# Goal: Stop the infinite loop by giving while a real end condition.
# Your turn: after you see the stop, fix the loop.

while True:
    pass
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: false,
      codeForbiddenPatterns: ['while\\s+True'],
      codeIncludes: ['while'],
      minNonEmptyPrints: 1,
    },
    compare: {
      note: 'A loop needs a condition that eventually becomes false.',
      wrong: 'while True:\n    pass',
      fixed: 'n = 0\nwhile n < 3:\n    print(n)\n    n = n + 1',
    },
    predict: {
      prompt: 'while True: with no break will…',
      choices: ['run once', 'run forever until stopped', 'never start'],
      correctIndex: 1,
    },
  },
  {
    id: 'capstone',
    difficulty: 'beginner',
    number: 16,
    topic: 'Capstone',
    goal: 'For each score, print pass or retry; then print the average.',
    tasks: [
      'Complete the if condition (pass if score >= passing)',
      'Keep the average print at the end',
    ],
    code: `# Lesson 16 — Capstone
# Goal: For each score, print pass or retry; then print the average.
# Your turn: finish the decision inside the loop.

scores = [92, 55, 78, 61, 40]
passing = 60

for score in scores:
    if ???:
        print(f"{score}: pass")
    else:
        print(f"{score}: retry")

average = sum(scores) / len(scores)
print(f"Average: {average}")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      printsInclude: ['pass', 'retry', 'Average'],
      minNonEmptyPrints: 5,
    },
    predict: {
      prompt: 'With passing = 60, score 55 should print…',
      choices: ['pass', 'retry', 'Average'],
      correctIndex: 1,
    },
    compare: {
      note: 'Compare each score to the passing mark.',
      wrong: 'if score:\n    print("pass")',
      fixed: 'if score >= passing:\n    print(f"{score}: pass")',
    },
  },

  // ── Intermediate ──────────────────────────────────────
  {
    id: 'mid-enumerate-zip',
    difficulty: 'intermediate',
    number: 1,
    topic: 'Enumerate & zip',
    goal: 'Number a list with enumerate and pair two lists with zip.',
    tasks: [
      'Finish enumerate so numbering starts at 1',
      'Zip names with years in the second loop',
    ],
    code: `# Intermediate 1 — Enumerate & zip
# Goal: Number a list with enumerate and pair two lists with zip.
# Your turn: complete enumerate and zip.

fruits = ["apple", "banana", "cherry"]
for i, fruit in enumerate(fruits, start=???):
    print(f"{i}. {fruit}")

names = ["Ada", "Grace"]
years = [1815, 1906]
for name, year in zip(???, ???):
    print(f"{name} ({year})")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['enumerate', 'zip'],
      minNonEmptyPrints: 3,
    },
    predict: {
      prompt: 'enumerate(fruits, start=1) numbers the first fruit as…',
      choices: ['0', '1', '2'],
      correctIndex: 1,
    },
    compare: {
      note: 'zip pairs items from two lists by position.',
      wrong: 'for name, year in names, years:',
      fixed: 'for name, year in zip(names, years):',
    },
  },
  {
    id: 'mid-nested-loops',
    difficulty: 'intermediate',
    number: 2,
    topic: 'Nested loops',
    goal: 'Print a 1..4 multiplication table using nested loops.',
    tasks: [
      'Fix both range(...) bounds to cover 1..4',
      'Append row * col into line',
    ],
    code: `# Intermediate 2 — Nested loops
# Goal: Print a 1..4 multiplication table using nested loops.
# Your turn: finish the ranges and the product.

for row in range(1, ???):
    line = []
    for col in range(1, ???):
        line.append(str(???))
    print(" ".join(line))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minNonEmptyPrints: 4,
    },
    predict: {
      prompt: 'range(1, 5) yields which numbers?',
      choices: ['1..5', '1..4', '0..4'],
      correctIndex: 1,
    },
    compare: {
      note: 'range(stop) stops before stop — use range(1, 5) for 1..4.',
      wrong: 'for row in range(4):  # 0..3',
      fixed: 'for row in range(1, 5):',
    },
  },
  {
    id: 'mid-list-methods',
    difficulty: 'intermediate',
    number: 3,
    topic: 'List methods',
    goal: 'Build a list with append and check membership with in.',
    tasks: [
      'Append n * 10 inside the loop',
      'Write an expression that checks if 30 is in nums',
    ],
    code: `# Intermediate 3 — List methods
# Goal: Build a list with append and check membership with in.
# Your turn: grow nums, then test membership.

nums = []
for n in range(1, 6):
    nums.append(???)

nums
??? in nums
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.append('],
      codePatterns: ['\\bin\\b'],
      minExprs: 1,
    },
    predict: {
      prompt: 'After appending n*10 for n in 1..5, is 30 in nums?',
      choices: ['Yes', 'No'],
      correctIndex: 0,
    },
    compare: {
      note: 'append grows a list in place.',
      wrong: 'nums = n * 10',
      fixed: 'nums.append(n * 10)',
    },
  },
  {
    id: 'mid-comprehensions',
    difficulty: 'intermediate',
    number: 4,
    topic: 'Comprehensions',
    goal: 'Build squares with a list comprehension, then only the evens.',
    tasks: [
      'Complete squares = [n * n for n in ...]',
      'Complete evens with an if n % 2 == 0 filter',
    ],
    code: `# Intermediate 4 — Comprehensions
# Goal: Build squares with a list comprehension, then only the evens.
# Your turn: finish both comprehensions.

squares = [n * n for n in ???]
squares

evens = [n for n in range(10) if ???]
evens
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codePatterns: ['for n in', '%'],
      minExprs: 2,
    },
    predict: {
      prompt: '[n*n for n in range(3)] equals…',
      choices: ['[0, 1, 4]', '[1, 4, 9]', '[0, 1, 2]'],
      correctIndex: 0,
    },
    compare: {
      note: 'A filter goes after the for clause.',
      wrong: '[n for if n % 2 == 0 in range(10)]',
      fixed: '[n for n in range(10) if n % 2 == 0]',
    },
  },
  {
    id: 'mid-dict-loops',
    difficulty: 'intermediate',
    number: 5,
    topic: 'Dict loops',
    goal: 'Loop .items() and build a new dict that adds 5 to each score.',
    tasks: [
      'Print each name and score from .items()',
      'Finish the comprehension for boosted scores',
    ],
    code: `# Intermediate 5 — Dict loops
# Goal: Loop .items() and build a new dict that adds 5 to each score.
# Your turn: iterate and transform.

scores = {"Ada": 92, "Grace": 88, "Alan": 75}

for name, score in scores.items():
    print(f"{name}: {score}")

boosted = {name: ??? for name, score in scores.items()}
boosted
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.items()'],
      minNonEmptyPrints: 1,
      minExprs: 1,
    },
    predict: {
      prompt: 'scores.items() yields…',
      choices: ['only keys', 'only values', 'key–value pairs'],
      correctIndex: 2,
    },
    compare: {
      note: 'Dict comprehensions map name → new value.',
      wrong: 'boosted = score + 5',
      fixed: 'boosted = {name: score + 5 for name, score in scores.items()}',
    },
  },
  {
    id: 'mid-sets',
    difficulty: 'intermediate',
    number: 6,
    topic: 'Sets',
    goal: 'Create two sets and show their union and intersection.',
    tasks: [
      'Fill skills_b with a few skill strings',
      'Compute union | and intersection &',
    ],
    code: `# Intermediate 6 — Sets
# Goal: Create two sets and show their union and intersection.
# Your turn: finish skills_b and the set operations.

skills_a = {"python", "git", "sql"}
skills_b = {???}

skills_a | skills_b
skills_a & skills_b
"python" in skills_a
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codePatterns: ['\\|', '&'],
      minExprs: 1,
    },
    predict: {
      prompt: '{1, 2} | {2, 3} is…',
      choices: ['{2}', '{1, 2, 3}', '{1, 3}'],
      correctIndex: 1,
    },
    compare: {
      note: '| is union; & is intersection.',
      wrong: 'skills_a + skills_b',
      fixed: 'skills_a | skills_b',
    },
  },
  {
    id: 'mid-tuples',
    difficulty: 'intermediate',
    number: 7,
    topic: 'Tuples',
    goal: 'Unpack a point tuple into x and y, then swap two variables.',
    tasks: [
      'Unpack point into x, y',
      'Swap a and b in one line',
    ],
    code: `# Intermediate 7 — Tuples
# Goal: Unpack a point tuple into x and y, then swap two variables.
# Your turn: unpack and swap.

point = (3, 4)
x, y = ???
x
y

a, b = 1, 2
a, b = ???
(a, b)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      minExprs: 2,
    },
    predict: {
      prompt: 'After x, y = (3, 4), what is y?',
      choices: ['3', '4', '(3, 4)'],
      correctIndex: 1,
    },
    compare: {
      note: 'Swap with parallel assignment.',
      wrong: 'a = b\nb = a',
      fixed: 'a, b = b, a',
    },
  },
  {
    id: 'mid-fn-defaults',
    difficulty: 'intermediate',
    number: 8,
    topic: 'Function defaults',
    goal: 'Add a default greeting and call the function two ways.',
    tasks: [
      'Give greeting a default value in the def line',
      'Call greet once with only a name',
    ],
    code: `# Intermediate 8 — Function defaults
# Goal: Add a default greeting and call the function two ways.
# Your turn: add a default for greeting.

def greet(name, greeting=???):
    return f"{greeting}, {name}!"

greet("Ada")
greet("Ada", "Hi")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codePatterns: ['def\\s+greet\\s*\\(', 'greeting\\s*='],
      minExprs: 1,
    },
    predict: {
      prompt: 'greet("Ada") with greeting="Hello" by default prints…',
      choices: ['Ada', 'Hello, Ada!', 'greeting, Ada!'],
      correctIndex: 1,
    },
    compare: {
      note: 'Defaults go in the parameter list.',
      wrong: 'def greet(name, greeting):\n    greeting = "Hello"',
      fixed: 'def greet(name, greeting="Hello"):',
    },
  },
  {
    id: 'mid-sorting',
    difficulty: 'intermediate',
    number: 9,
    topic: 'Sorting',
    goal: 'Sort people by year using sorted(..., key=...).',
    tasks: [
      'Pass key= so sorting uses the year field',
      'Print each person after sorting',
    ],
    code: `# Intermediate 9 — Sorting
# Goal: Sort people by year using sorted(..., key=...).
# Your turn: sort by year (oldest first).

people = [
    {"name": "Ada", "year": 1815},
    {"name": "Grace", "year": 1906},
    {"name": "Alan", "year": 1912},
]

by_year = sorted(people, key=???)
for person in by_year:
    print(f"{person['name']} ({person['year']})")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['sorted(', 'key='],
      minNonEmptyPrints: 3,
    },
    predict: {
      prompt: 'sorted(people, key=lambda p: p["year"]) orders by…',
      choices: ['name', 'year', 'dict size'],
      correctIndex: 1,
    },
    compare: {
      note: 'key= tells sorted which value to compare.',
      wrong: 'sorted(people)',
      fixed: 'sorted(people, key=lambda p: p["year"])',
    },
  },
  {
    id: 'mid-try-except',
    difficulty: 'intermediate',
    number: 10,
    topic: 'Try / except',
    goal: 'Catch ValueError when int() fails and print a friendly message.',
    tasks: [
      'Wrap int(raw) in try',
      'In except ValueError, print that raw is not a number',
    ],
    code: `# Intermediate 10 — Try / except
# Goal: Catch ValueError when int() fails and print a friendly message.
# Your turn: handle bad values without crashing.

raw_values = ["10", "oops", "3"]

for raw in raw_values:
    try:
        n = int(raw)
        print(f"{raw} -> {n}")
    except ???:
        print(f"{raw} is not a number")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['try:', 'except'],
      printsInclude: ['not a number'],
      minNonEmptyPrints: 2,
    },
    predict: {
      prompt: 'int("oops") raises which exception type?',
      choices: ['TypeError', 'ValueError', 'NameError'],
      correctIndex: 1,
    },
    compare: {
      note: 'Catch the specific error you expect.',
      wrong: 'except:\n    pass',
      fixed: 'except ValueError:\n    print("not a number")',
    },
  },
  {
    id: 'mid-classes',
    difficulty: 'intermediate',
    number: 11,
    topic: 'Classes',
    goal: 'Finish Counter so bump increases value and returns it.',
    tasks: [
      'Store start on self.value in __init__',
      'Increase self.value inside bump',
    ],
    code: `# Intermediate 11 — Classes
# Goal: Finish Counter so bump increases value and returns it.
# Your turn: complete __init__ and bump.

class Counter:
    def __init__(self, start=0):
        self.value = ???

    def bump(self, step=1):
        self.value = ???
        return self.value

c = Counter()
c.bump()
c.bump(4)
c.value
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['class Counter', 'self.value'],
      minExprs: 1,
    },
    predict: {
      prompt: 'After Counter().bump() then bump(4), value is…',
      choices: ['0', '1', '5'],
      correctIndex: 2,
    },
    compare: {
      note: 'Methods update state on self.',
      wrong: 'value = value + step',
      fixed: 'self.value = self.value + step',
    },
  },
  {
    id: 'mid-stdlib',
    difficulty: 'intermediate',
    number: 12,
    topic: 'Math & random',
    goal: 'Use math.sqrt and random.randint in working calls.',
    tasks: [
      'Import math and random',
      'Call math.sqrt on a perfect square and random.randint(1, 6)',
    ],
    code: `# Intermediate 12 — Math & random
# Goal: Use math.sqrt and random.randint in working calls.
# Your turn: import modules and call them.

import ???
import ???

math.sqrt(???)
random.randint(1, 6)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['import math', 'import random', 'math.sqrt', 'random.randint'],
      minExprs: 1,
    },
    predict: {
      prompt: 'math.sqrt(9) is…',
      choices: ['3', '81', '4.5'],
      correctIndex: 0,
    },
    compare: {
      note: 'Import the module, then call module.function.',
      wrong: 'sqrt(9)',
      fixed: 'import math\nmath.sqrt(9)',
    },
  },
  {
    id: 'mid-json',
    difficulty: 'intermediate',
    number: 13,
    topic: 'JSON',
    goal: 'json.dumps a dict and json.loads it back.',
    tasks: [
      'Create text with json.dumps(data)',
      'Parse with json.loads(text) and read a field',
    ],
    code: `# Intermediate 13 — JSON
# Goal: json.dumps a dict and json.loads it back.
# Your turn: dumps then loads.

import json

data = {"name": "Ada", "score": 92}
text = json.dumps(???)
text

parsed = json.loads(???)
parsed["name"]
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['json.dumps', 'json.loads'],
      minExprs: 1,
    },
    predict: {
      prompt: 'json.loads turns a JSON string into…',
      choices: ['a file', 'Python objects', 'HTML'],
      correctIndex: 1,
    },
    compare: {
      note: 'dumps → string; loads → Python value.',
      wrong: 'json.loads(data)  # data is already a dict',
      fixed: 'text = json.dumps(data)\nparsed = json.loads(text)',
    },
  },
  {
    id: 'mid-capstone',
    difficulty: 'intermediate',
    number: 14,
    topic: 'Capstone',
    goal: 'Return the top student names sorted by score (highest first).',
    tasks: [
      'Sort rows by score descending inside top_students',
      'Return only the name strings, limited by limit',
    ],
    code: `# Intermediate 14 — Capstone
# Goal: Return the top student names sorted by score (highest first).
# Your turn: finish top_students.

students = [
    {"name": "Ada", "score": 92},
    {"name": "Grace", "score": 88},
    {"name": "Alan", "score": 95},
    {"name": "Katherine", "score": 91},
]

def top_students(rows, limit=3):
    ranked = sorted(rows, key=???, reverse=True)
    return [r["name"] for r in ranked[:???]]

top_students(students)
top_students(students, limit=2)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def top_students', 'sorted('],
      codePatterns: ['reverse\\s*=\\s*True'],
      minExprs: 1,
    },
    stretch: 'Stretch: also return the scores next to each name as tuples.',
    predict: {
      prompt: 'With reverse=True and key=score, who is first?',
      choices: ['Ada (92)', 'Alan (95)', 'Grace (88)'],
      correctIndex: 1,
    },
    compare: {
      note: 'Sort by score field, highest first.',
      wrong: 'sorted(rows)',
      fixed: 'sorted(rows, key=lambda r: r["score"], reverse=True)',
    },
  },

  // ── AI foundations (browser-local, no API keys) ───────
  {
    id: 'ai-tokens',
    difficulty: 'ai',
    number: 1,
    topic: 'Tokens',
    goal: 'Split text into tokens and show the list of pieces.',
    tasks: [
      'Finish tokenize() so it splits on spaces',
      'Print tokens for the sample sentence',
    ],
    code: `# AI 1 — Tokens
# Goal: Split text into tokens and show the list of pieces.
# Models read text as tokens — start with simple whitespace splits.

def tokenize(text):
    # Your turn: return a list of words
    return ???

sentence = "hello world from python"
tokens = tokenize(sentence)
print(tokens)
len(tokens)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def tokenize', 'split'],
      minNonEmptyPrints: 1,
      minExprs: 1,
    },
    pipeline: ['text', 'tokenize', 'count'],
    stretch: 'Stretch: also lowercase tokens before returning them.',
    hints: ['Use text.split() to break on spaces.'],
    runWithModel: true,
    modelPromptFallback:
      'In one short sentence, explain what a token is in large language models.',
    compare: {
      note: 'split() returns a list of pieces.',
      wrong: 'return text  # still one string',
      fixed: 'return text.split()',
    },
    predict: {
      prompt: '"hello world".split() becomes…',
      choices: ['"hello world"', '["hello", "world"]', 'hello+world'],
      correctIndex: 1,
    },
  },
  {
    id: 'ai-bag-of-words',
    difficulty: 'ai',
    number: 2,
    topic: 'Bag of words',
    goal: 'Count how often each token appears.',
    tasks: [
      'Fill counts for each token in the loop',
      'Print the finished counts dict',
    ],
    code: `# AI 2 — Bag of words
# Goal: Count how often each token appears.
# This is a tiny "feature vector" models use for text.

tokens = ["cat", "sat", "on", "the", "cat", "mat"]
counts = {}

for t in tokens:
    counts[t] = counts.get(t, 0) + ???

print(counts)
counts["cat"]
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['counts.get', 'for t in'],
      printsInclude: ['cat'],
      minExprs: 1,
    },
    pipeline: ['tokens', 'count', 'vector'],
    compare: {
      note: 'Use .get(key, 0) so missing keys start at zero.',
      wrong: 'counts[t] = counts[t] + 1  # KeyError on first sight',
      fixed: 'counts[t] = counts.get(t, 0) + 1',
    },
    runWithModel: true,
    modelPromptFallback:
      'Explain bag-of-words features in two short sentences for a beginner.',
    predict: {
      prompt: 'In counts for ["cat","sat","cat"], what is counts["cat"]?',
      choices: ['1', '2', '3'],
      correctIndex: 1,
    },
  },
  {
    id: 'ai-vocab',
    difficulty: 'ai',
    number: 3,
    topic: 'Vocabulary ids',
    goal: 'Map each unique token to a small integer id.',
    tasks: [
      'Build vocab as token → index',
      'Encode the sentence as a list of ids and print it',
    ],
    code: `# AI 3 — Vocabulary ids
# Goal: Map each unique token to a small integer id.
# Real tokenizers also map pieces of words to ids.

tokens = ["the", "cat", "sat", "the", "mat"]
vocab = {}
next_id = 0
for t in tokens:
    if t not in vocab:
        vocab[t] = ???
        next_id += 1

ids = [vocab[t] for t in tokens]
print(vocab)
print(ids)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['vocab', 'ids'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['tokens', 'vocab', 'encode'],
    runWithModel: true,
    modelPromptFallback:
      'Why do NLP systems map words to integer ids? Answer in one sentence.',
    compare: {
      note: 'Assign each new token the next free id.',
      wrong: 'vocab[t] = 0  # every token becomes 0',
      fixed: 'vocab[t] = next_id',
    },
    predict: {
      prompt: 'Unique tokens in ["the","cat","the"] get how many vocab entries?',
      choices: ['1', '2', '3'],
      correctIndex: 1,
    },
  },
  {
    id: 'ai-dot-product',
    difficulty: 'ai',
    number: 4,
    topic: 'Dot product',
    goal: 'Write dot(a, b) for equal-length vectors and use it.',
    tasks: [
      'Implement the sum of a[i] * b[i]',
      'Print the dot product of the two samples',
    ],
    code: `# AI 4 — Dot product
# Goal: Write dot(a, b) for equal-length vectors and use it.
# Similarity often starts with a simple sum of products.

def dot(a, b):
    total = 0
    for i in range(len(a)):
        total += ???
    return total

v1 = [1, 2, 3]
v2 = [0, 1, 1]
print(dot(v1, v2))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def dot'],
      printPatterns: ['\\b5\\b'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['vectors', 'multiply', 'sum'],
    hints: ['Inside the loop, add a[i] * b[i] to total.'],
    runWithModel: true,
    modelPromptFallback:
      'In one sentence, what is a dot product used for in machine learning?',
    predict: {
      prompt: 'dot([1,2,3], [0,1,1]) equals…',
      choices: ['3', '5', '6'],
      correctIndex: 1,
    },
    compare: {
      note: 'Multiply matching positions, then sum.',
      wrong: 'total += a[i] + b[i]',
      fixed: 'total += a[i] * b[i]',
    },
  },
  {
    id: 'ai-cosine',
    difficulty: 'ai',
    number: 5,
    topic: 'Cosine similarity',
    goal: 'Finish cosine(a, b) using dot and vector length.',
    tasks: [
      'Complete magnitude (length) of a vector',
      'Return dot / (mag_a * mag_b) and print cosine for two vectors',
    ],
    code: `# AI 5 — Cosine similarity
# Goal: Finish cosine(a, b) using dot and vector length.
# Cosine is a common way to compare embeddings (here: tiny hand-made vectors).

import math

def dot(a, b):
    return sum(x * y for x, y in zip(a, b))

def magnitude(v):
    return math.sqrt(sum(x * x for x in v))

def cosine(a, b):
    denom = magnitude(a) * magnitude(b)
    if denom == 0:
        return 0.0
    return ???

# "cat sat" vs "cat mat" as bag-of-words over [cat, sat, mat]
a = [1, 1, 0]
b = [1, 0, 1]
print(round(cosine(a, b), 3))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def cosine', 'magnitude'],
      codePatterns: ['dot\\s*\\(\\s*a\\s*,\\s*b\\s*\\)'],
      printPatterns: ['0\\.5'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['embed', 'normalize', 'compare'],
    stretch: 'Stretch: compare a third vector and print all pairwise scores.',
    runWithModel: true,
    modelPromptFallback:
      'Explain cosine similarity between two vectors in two short sentences.',
    compare: {
      note: 'Cosine is dot product divided by the product of lengths.',
      wrong: 'return dot(a, b)  # not normalized',
      fixed: 'return dot(a, b) / (magnitude(a) * magnitude(b))',
    },
    predict: {
      prompt: 'Cosine of two identical non-zero vectors is…',
      choices: ['0', '1', '-1'],
      correctIndex: 1,
    },
  },
  {
    id: 'ai-prompt-template',
    difficulty: 'ai',
    number: 6,
    topic: 'Prompt templates',
    goal: 'Fill a prompt template with variables and print the final prompt.',
    tasks: [
      'Replace ??? in the f-string template',
      'Print the filled prompt for the sample user',
    ],
    code: `# AI 6 — Prompt templates
# Goal: Fill a prompt template with variables and print the final prompt.
# Chat apps build prompts the same way — with strings, carefully.

system = "You are a patient Python tutor."
student = ???
task = "explain lists"

prompt = f"""{system}

Student: {student}
Task: {task}

Answer in two short sentences."""
print(prompt)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['prompt', 'print(prompt)', 'student'],
      printPatterns: ['Ada|Grace|Alan', 'lists'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['system', 'user', 'prompt'],
    hints: ['Set student to a string name in quotes, e.g. "Ada".'],
    compare: {
      note: 'Template variables must already be defined as Python names.',
      wrong: 'prompt = f"Student: {???}"',
      fixed: 'student = "Ada"\nprompt = f"Student: {student}"',
    },
    runWithModel: true,
    modelPromptFallback:
      'You are a Python tutor. In two short sentences, explain lists to a beginner named Ada.',
    predict: {
      prompt: 'In an f-string, {student} is replaced by…',
      choices: ['the word student', 'the value of student', 'nothing'],
      correctIndex: 1,
    },
  },
  {
    id: 'ai-json-contract',
    difficulty: 'ai',
    number: 7,
    topic: 'JSON contracts',
    goal: 'Validate a model-style JSON object has the required keys.',
    tasks: [
      'Finish required list and the missing-key check',
      'Print ok True only when the payload is valid',
    ],
    code: `# AI 7 — JSON contracts
# Goal: Validate a model-style JSON object has the required keys.
# Structured output is a contract: check keys before you trust the answer.

import json

required = ["answer", "confidence"]

raw = '{"answer": "list", "confidence": 0.9}'
payload = json.loads(raw)

missing = [key for key in required if key not in ???]
ok = len(missing) == 0
print({"ok": ok, "missing": missing, "payload": payload})

# Optional: ask a model for structured output (use Run with model)
instruction = (
    "Reply with JSON only, keys answer (string) and confidence (0 to 1), "
    "about what a Python list is."
)
print(instruction)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['json.loads', 'required', 'missing'],
      printPatterns: ['True'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['parse', 'validate', 'use'],
    stretch: 'Stretch: also reject confidence outside 0..1.',
    runWithModel: true,
    modelPromptFallback:
      'Reply with JSON only, keys answer (string) and confidence (0 to 1), about what a Python list is.',
    compare: {
      note: 'Check membership with `key not in payload`.',
      wrong: 'if key == payload:',
      fixed: 'if key not in payload:',
    },
    predict: {
      prompt: 'If required keys are present, missing list length is…',
      choices: ['0', '1', '2'],
      correctIndex: 0,
    },
  },
  {
    id: 'ai-pipeline',
    difficulty: 'ai',
    number: 8,
    topic: 'Mini pipeline',
    goal: 'Chain tokenize → counts → top token and print each stage.',
    tasks: [
      'Wire the three functions in order',
      'Print tokens, counts, and the top token',
    ],
    code: `# AI 8 — Mini pipeline
# Goal: Chain tokenize → counts → top token and print each stage.
# AI apps are pipelines: clean text, featurize, then decide.

def tokenize(text):
    return text.lower().split()

def count_tokens(tokens):
    counts = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    return counts

def top_token(counts):
    # Your turn: return the token with the highest count
    return ???

text = "to be or not to be"
# pipeline stages
tokens = tokenize(text)
counts = count_tokens(???)
winner = top_token(counts)

print(tokens)
print(counts)
print(winner)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['tokenize(', 'count_tokens(', 'top_token('],
      minNonEmptyPrints: 3,
      printPatterns: ['to'],
    },
    pipeline: ['tokenize', 'count', 'decide'],
    hints: [
      'max(counts, key=counts.get) returns the key with the largest value.',
    ],
    runWithModel: true,
    modelPromptFallback:
      'Describe a simple NLP pipeline (tokenize → count → decide) in three short steps.',
    compare: {
      note: 'Pass the tokens list into count_tokens.',
      wrong: 'counts = count_tokens(text)',
      fixed: 'counts = count_tokens(tokens)',
    },
    predict: {
      prompt: 'In "to be or not to be", which token wins a simple count?',
      choices: ['or', 'to', 'be'],
      correctIndex: 1,
    },
  },

  // ── Web APIs (browser-local FastAPI mental model, no real server) ──
  {
    id: 'api-request',
    difficulty: 'api',
    number: 1,
    topic: 'Request dict',
    goal: 'Build a request dict and print method + path.',
    tasks: [
      'Fill method and path on the request',
      'Print both fields',
    ],
    code: `# API 1 — Request dict
# Goal: Build a request dict and print method + path.
# Frameworks like FastAPI turn HTTP into structured data you handle in Python.

request = {
    "method": ???,
    "path": "/hello",
    "headers": {"accept": "application/json"},
    "query": {},
    "body": None,
}

print(request["method"])
print(request["path"])
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['"method"', '"path"'],
      printPatterns: ['GET|POST|PUT|DELETE', '/hello'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['receive', 'parse', 'handle'],
    hints: ['Use the string "GET" for a read request.'],
    predict: {
      prompt: 'In our request dict, which field is usually "/hello"?',
      choices: ['method', 'path', 'body'],
      correctIndex: 1,
    },
    compare: {
      note: 'HTTP methods are short uppercase strings.',
      wrong: 'method = get',
      fixed: 'method = "GET"',
    },
  },
  {
    id: 'api-response',
    difficulty: 'api',
    number: 2,
    topic: 'Response dict',
    goal: 'Return a response with status and JSON body.',
    tasks: [
      'Set status to 200 and a message in body',
      'Print the whole response dict',
    ],
    code: `# API 2 — Response dict
# Goal: Return a response with status and JSON body.
# Print a dict shaped like {"status": 200, "body": {...}} to see an HTTP card.

def ok(message):
    return {
        "status": ???,
        "headers": {"content-type": "application/json"},
        "body": {"message": message},
    }

print(ok("hello from the browser"))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['"status"', '"body"'],
      printPatterns: ['200', 'hello'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['handle', 'status', 'body'],
    stretch: 'Stretch: add a 404 helper that returns status 404.',
    predict: {
      prompt: 'A successful JSON response often uses status…',
      choices: ['200', '404', '500'],
      correctIndex: 0,
    },
    compare: {
      note: 'Keep status and body as separate fields.',
      wrong: 'return "ok"',
      fixed: 'return {"status": 200, "body": {"message": "ok"}}',
    },
  },
  {
    id: 'api-status',
    difficulty: 'api',
    number: 3,
    topic: 'Status codes',
    goal: 'Choose 200 or 404 based on whether an item exists.',
    tasks: [
      'Return 200 + item when found, else 404',
      'Print both found and missing cases',
    ],
    code: `# API 3 — Status codes
# Goal: Choose 200 or 404 based on whether an item exists.
# Status codes are part of the contract with API clients.

items = {"1": {"name": "Ada"}, "2": {"name": "Grace"}}

def get_item(item_id):
    if item_id in items:
        return {"status": 200, "body": items[item_id]}
    return {"status": ???, "body": {"error": "not found"}}

print(get_item("1"))
print(get_item("99"))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      printPatterns: ['200', '404'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['lookup', 'branch', 'respond'],
    compare: {
      note: 'Missing resources usually answer 404, not 200 with empty data.',
      wrong: 'return {"status": 200, "body": None}',
      fixed: 'return {"status": 404, "body": {"error": "not found"}}',
    },
    predict: {
      prompt: 'When an id is missing from the store, clients expect…',
      choices: ['200', '201', '404'],
      correctIndex: 2,
    },
  },
  {
    id: 'api-routing',
    difficulty: 'api',
    number: 4,
    topic: 'Routing',
    goal: 'Route /health and /hello to different handlers.',
    tasks: [
      'Finish the if/elif path checks',
      'Print responses for both paths',
    ],
    code: `# API 4 — Routing
# Goal: Route /health and /hello to different handlers.
# FastAPI maps paths to functions; here we do it with plain if/elif.

def handle(request):
    path = request["path"]
    if path == "/health":
        return {"status": 200, "body": {"ok": True}}
    if path == ???:
        return {"status": 200, "body": {"message": "hi"}}
    return {"status": 404, "body": {"error": "no route"}}

print(handle({"method": "GET", "path": "/health"}))
print(handle({"method": "GET", "path": "/hello"}))
print(handle({"method": "GET", "path": "/missing"}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def handle', 'path'],
      printPatterns: ['True', 'hi', '404'],
      minNonEmptyPrints: 3,
    },
    pipeline: ['match', 'handler', 'respond'],
    predict: {
      prompt: 'Unknown paths should typically return…',
      choices: ['200', '404', '201'],
      correctIndex: 1,
    },
    compare: {
      note: 'Match the path string exactly (or with clear rules).',
      wrong: 'if path:\n    return hello()',
      fixed: 'if path == "/hello":\n    return {"status": 200, "body": {"message": "hi"}}',
    },
  },
  {
    id: 'api-query',
    difficulty: 'api',
    number: 5,
    topic: 'Query params',
    goal: 'Read a name from query params with a default.',
    tasks: [
      'Pull name from request["query"] with .get',
      'Return a greeting in the body',
    ],
    code: `# API 5 — Query params
# Goal: Read a name from query params with a default.
# /greet?name=Ada → query dict {"name": "Ada"}

def greet(request):
    name = request["query"].get(???, "world")
    return {
        "status": 200,
        "body": {"message": f"Hello, {name}!"},
    }

print(greet({"method": "GET", "path": "/greet", "query": {"name": "Ada"}}))
print(greet({"method": "GET", "path": "/greet", "query": {}}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.get(', 'query'],
      printPatterns: ['Ada', 'world'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['parse', 'query', 'respond'],
    hints: ['Use "name" as the query key.'],
    predict: {
      prompt: 'query.get("name", "world") with empty query yields…',
      choices: ['name', 'world', 'error'],
      correctIndex: 1,
    },
    compare: {
      note: '.get supplies a default when the key is missing.',
      wrong: 'name = request["query"]["name"]',
      fixed: 'name = request["query"].get("name", "world")',
    },
  },
  {
    id: 'api-json-body',
    difficulty: 'api',
    number: 6,
    topic: 'JSON body',
    goal: 'Accept a POST body and echo a created resource.',
    tasks: [
      'Reject non-POST with 405',
      'Return 201 with the posted name',
    ],
    code: `# API 6 — JSON body
# Goal: Accept a POST body and echo a created resource.
# POST bodies are often JSON objects — validate before trusting them.

def create_user(request):
    if request["method"] != "POST":
        return {"status": ???, "body": {"error": "method not allowed"}}
    body = request.get("body") or {}
    name = body.get("name")
    if not name:
        return {"status": 400, "body": {"error": "name required"}}
    return {"status": 201, "body": {"id": 1, "name": name}}

print(create_user({"method": "GET", "path": "/users", "body": None}))
print(create_user({"method": "POST", "path": "/users", "body": {"name": "Ada"}}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      printPatterns: ['405', '201', 'Ada'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['method', 'validate', 'create'],
    stretch: 'Stretch: also reject names shorter than 2 characters with 400.',
    predict: {
      prompt: 'Successful create often returns status…',
      choices: ['200', '201', '404'],
      correctIndex: 1,
    },
    compare: {
      note: 'Wrong methods should not create resources.',
      wrong: 'return {"status": 200, "body": body}',
      fixed: 'return {"status": 405, "body": {"error": "method not allowed"}}',
    },
  },
  {
    id: 'api-middleware',
    difficulty: 'api',
    number: 7,
    topic: 'Middleware',
    goal: 'Wrap a handler to add an X-Request-Id header on every response.',
    tasks: [
      'Call the inner handler',
      'Add headers["x-request-id"] before returning',
    ],
    code: `# API 7 — Middleware
# Goal: Wrap a handler to add an X-Request-Id header on every response.
# FastAPI middleware runs before/after your route — here a simple wrapper.

def with_request_id(handler):
    def wrapped(request):
        response = ???
        headers = dict(response.get("headers") or {})
        headers["x-request-id"] = "req-1"
        response = {**response, "headers": headers}
        return response
    return wrapped

def hello(_request):
    return {"status": 200, "body": {"message": "hi"}, "headers": {}}

app = with_request_id(hello)
print(app({"method": "GET", "path": "/"}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['handler(', 'x-request-id'],
      printPatterns: ['req-1', 'hi'],
      minNonEmptyPrints: 1,
    },
    pipeline: ['before', 'handler', 'after'],
    hints: ['Call handler(request) to get the inner response.'],
    predict: {
      prompt: 'Middleware usually runs…',
      choices: ['instead of the handler', 'around the handler', 'only on errors'],
      correctIndex: 1,
    },
    compare: {
      note: 'Call the inner handler, then decorate the response.',
      wrong: 'response = {"status": 200}',
      fixed: 'response = handler(request)',
    },
  },
  {
    id: 'api-mini-app',
    difficulty: 'api',
    number: 8,
    topic: 'Mini app',
    goal: 'Wire a tiny app() that routes health and items by id.',
    tasks: [
      'Route /health and /items/... inside app',
      'Print three sample requests',
    ],
    code: `# API 8 — Mini app
# Goal: Wire a tiny app() that routes health and items by id.
# This is the FastAPI mental model without a real network.

DB = {"a1": {"title": "Notebook"}}

def app(request):
    method = request["method"]
    path = request["path"]
    if method == "GET" and path == "/health":
        return {"status": 200, "body": {"ok": True}}
    if method == "GET" and path.startswith("/items/"):
        item_id = path.split("/")[-1]
        item = DB.get(item_id)
        if item:
            return {"status": 200, "body": item}
        return {"status": 404, "body": {"error": "missing"}}
    return {"status": ???, "body": {"error": "no route"}}

print(app({"method": "GET", "path": "/health"}))
print(app({"method": "GET", "path": "/items/a1"}))
print(app({"method": "GET", "path": "/items/nope"}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def app', '/health', '/items/'],
      printPatterns: ['True', 'Notebook', '404'],
      minNonEmptyPrints: 3,
    },
    pipeline: ['route', 'lookup', 'respond'],
    stretch: 'Stretch: add POST /items that stores a new title in DB.',
    compare: {
      note: 'Unknown routes should not pretend to succeed.',
      wrong: 'return {"status": 200, "body": {}}',
      fixed: 'return {"status": 404, "body": {"error": "no route"}}',
    },
    predict: {
      prompt: 'GET /items/a1 when a1 exists should return…',
      choices: ['404', '200 with the item', '405'],
      correctIndex: 1,
    },
  },
  {
    id: 'api-auth',
    difficulty: 'api',
    number: 9,
    topic: 'Auth header',
    goal: 'Check Authorization Bearer and return 200 or 401.',
    tasks: [
      'Read headers["authorization"]',
      'Return 200 only for Bearer secret, else 401',
    ],
    code: `# API 9 — Auth header
# Goal: Check Authorization Bearer and return 200 or 401.
# Real APIs often expect: Authorization: Bearer <token>

SECRET = "Bearer secret"

def authorize(request):
    headers = request.get("headers") or {}
    token = headers.get(???, "")
    if token == SECRET:
        return {"status": 200, "body": {"ok": True, "user": "ada"}}
    return {"status": 401, "body": {"error": "unauthorized"}}

print(authorize({"method": "GET", "path": "/me", "headers": {}}))
print(authorize({
    "method": "GET",
    "path": "/me",
    "headers": {"authorization": "Bearer secret"},
}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['headers.get', 'Bearer secret'],
      printPatterns: ['401', '200', 'ada'],
      minNonEmptyPrints: 2,
    },
    pipeline: ['read-header', 'check', 'respond'],
    hints: ['The header name is the string "authorization" (lowercase key in our dict).'],
    compare: {
      note: 'Missing or wrong tokens should not look like success.',
      wrong: 'return {"status": 200, "body": {"ok": True}}',
      fixed: 'return {"status": 401, "body": {"error": "unauthorized"}}',
    },
    stretch: 'Stretch: also accept a query token= as a second path (less secure, for comparison).',
    predict: {
      prompt: 'What status should a request without Authorization get?',
      choices: ['200', '401', '404'],
      correctIndex: 1,
    },
  },
]

export const LESSONS: Lesson[] = LESSON_DRAFTS.map(finalizeLesson)

/** @deprecated use LESSONS */
export const EXAMPLES = LESSONS

export function lessonsForDifficulty(difficulty: Difficulty): Lesson[] {
  return LESSONS.filter((l) => l.difficulty === difficulty)
}

/** Lessons grouped by chapter for the toolbar menu. */
export function lessonsByChapter(
  difficulty: Difficulty,
): { chapter: string; lessons: Lesson[] }[] {
  const track = lessonsForDifficulty(difficulty)
  const order: string[] = []
  const map = new Map<string, Lesson[]>()
  for (const lesson of track) {
    if (!map.has(lesson.chapter)) {
      map.set(lesson.chapter, [])
      order.push(lesson.chapter)
    }
    map.get(lesson.chapter)!.push(lesson)
  }
  return order.map((chapter) => ({
    chapter,
    lessons: map.get(chapter)!,
  }))
}

export function getLesson(id: string): Lesson {
  return LESSONS.find((l) => l.id === id) ?? LESSONS[0]
}

export function firstLessonId(difficulty: Difficulty): string {
  return lessonsForDifficulty(difficulty)[0]?.id ?? DEFAULT_LESSON_ID
}

/** @deprecated use getLesson */
export function getExample(id: string): Lesson {
  return getLesson(id)
}
