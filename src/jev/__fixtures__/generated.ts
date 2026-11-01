/** Generated error programs shared by the real-Python unit tests and the Pyodide check. */

const OPENERS = ['(', '[', '{'] as const
const SHAPES = [
  (open: string) => `value = ${open}1, 2`,
  (open: string) => `print(${open === '(' ? '' : open}"text"${open === '(' ? '' : open === '[' ? ']' : '}'}`,
  (open: string) => `total = len(${open}1, 2, 3`,
  (open: string) => `data = ${open}${open === '{' ? '"a": 1' : '1'},`,
  (open: string) => `result = max(3, ${open}4`,
  (open: string) => `x = ${open}${open === '{' ? '"k": ' : ''}1 + 2`,
]
const FOLLOWERS = ['a = 1', 'print(a)', 'b = a + 1', 'for i in range(2):\n    print(i)', 'if a:\n    print("yes")', 'def g():\n    return 1', 'c = [1, 2]', 'd = {"k": 1}']

/** `[name, source, line Python should report]` for a bracket left open 1–8 lines before the code stops. */
export function unclosedBracketCases(): [string, string, number][] {
  const cases: [string, string, number][] = []
  for (const open of OPENERS) {
    SHAPES.forEach((shape, shapeIndex) => {
      for (const distance of [1, 3, 5, 8]) {
        for (const nested of [false, true]) {
          const pad = nested ? '    ' : ''
          const body = FOLLOWERS.slice(0, distance).join('\n').split('\n').map((line) => pad + line)
          cases.push([`${open} shape ${shapeIndex} +${distance}${nested ? ' in def' : ''}`, `${nested ? 'def f():\n' : 'n = 0\n'}${pad}${shape(open)}\n${body.join('\n')}\n`, 2])
        }
      }
    })
  }
  return cases
}

/** `[name, source, line Python should report]` for tabs and spaces mixed in one block. */
export const TAB_CASES: [string, string, number][] = [
  ['tab then spaces', 'if True:\n\tx = 1\n        y = 2\nprint(x, y)\n', 3],
  ['spaces then tab in def', 'def f():\n        a = 1\n\treturn a\nprint(f())\n', 3],
  ['tab in loop body', 'for i in range(2):\n    print(i)\n\tprint(i)\n', 3],
  ['nested tab and spaces', 'if True:\n\tif True:\n\t    x = 1\n\t\ty = 2\nprint(x, y)\n', 4],
  ['spaces before a tab', 'def f():\n\tx = 1\n    \treturn x\nprint(f())\n', 3],
]

/** `[name, source, line holding the bad value, marked text]`: Python stops inside a function, the cause is far above. */
export const FAR_ORIGIN_CASES: [string, string, number, string][] = [
  ['text list item, two calls deep', 'def double(x):\n    return x * 2 + 1\n\ndef double_all(items):\n    return [double(x) for x in items]\n\n\n\n\n\nnumbers = [1, 2, 3, "4"]\nprint(double_all(numbers))\n', 11, '"4"'],
  ['text in a list, summed', 'def total_price(prices):\n    return sum(prices)\n\n\n\n\nprices = [10, 20, "30"]\nprint(total_price(prices))\n', 7, '"30"'],
  ['text argument at the call', 'def repeat(word, times):\n    return word * times + "!"\n\n\n\n\n\n\nprint(repeat("ab", "3"))\n', 9, '"3"'],
  ['None from a dict', 'def shout(text):\n    return text.upper() + "!"\n\nsettings = {"greeting": None}\n\n\n\n\n\nprint(shout(settings["greeting"]))\n', 4, 'None'],
  ['text count for range', 'def stars(n):\n    return "".join("*" for _ in range(n))\nrows = "3"\n\n\n\n\n\n\nprint(stars(rows))\n', 3, '"3"'],
  ['text divided far below', 'width = "10"\n\n\n\n\n\n\n\n\n\n\ndef half(value):\n    return value / 2\nprint(half(width))\n', 1, '"10"'],
  ['keyword argument', 'def area(width, height):\n    return width * height - 1\n\n\n\nsize = "4"\nprint(area(height=2, width=size))\n', 6, '"4"'],
  ['loop over a list three frames deep', 'def add_tax(price):\n    return price * 1.2\n\ndef prices_with_tax(prices):\n    result = []\n    for price in prices:\n        result.append(add_tax(price))\n    return result\n\ndef report(cart):\n    return prices_with_tax(cart)\n\n\ncart = [5, "7"]\nprint(report(cart))\n', 14, '"7"'],
]
