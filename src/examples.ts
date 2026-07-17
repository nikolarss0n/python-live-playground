export type Example = {
  id: string
  title: string
  description: string
  code: string
}

export const DEFAULT_EXAMPLE_ID = 'hello'

export const EXAMPLES: Example[] = [
  {
    id: 'hello',
    title: 'Hello',
    description: 'Print and expression values',
    code: `# Welcome to the Python playground
# Edit this code — results appear as you type.

name = "world"
print(f"Hello, {name}!")

2 + 2
"Python" * 3
`,
  },
  {
    id: 'variables',
    title: 'Variables',
    description: 'Names, lists, and simple math',
    code: `temperature = 22
unit = "°C"

print(f"It is {temperature}{unit} outside.")

scores = [8, 9, 7, 10]
average = sum(scores) / len(scores)
average
`,
  },
  {
    id: 'loops',
    title: 'Loops',
    description: 'Repeat work with for and range',
    code: `for n in range(1, 6):
    square = n * n
    print(f"{n} squared is {square}")

sum(range(1, 11))
`,
  },
  {
    id: 'errors',
    title: 'Errors',
    description: 'How mistakes look (and teach)',
    code: `# Change the numbers and watch the friendly error.

a = 10
b = 0
a / b
`,
  },
  {
    id: 'infinite',
    title: 'Infinite loop',
    description: 'Use Stop when code runs too long',
    code: `# This never finishes on its own.
# Press Stop, or wait for the timeout.

while True:
    pass
`,
  },
]

export function getExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0]
}
