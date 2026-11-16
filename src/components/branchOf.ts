/** `line` is the branch's own header; `chain` the line of the `if` that starts its if/elif/else chain. */
export type Branch = { keyword: 'if' | 'elif' | 'else'; line: number; chain: number }

const HEADER = /^(if|elif|else|for|while|def|class|with|try|except|finally|match|case|async)\b[^#]*:\s*(#.*)?$/

/** Bracket depth change of one line, ignoring brackets inside strings and comments. */
function depthChange(text: string): number {
  let depth = 0
  let quote: string | null = null
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = null
    } else if (char === '#') break
    else if (char === '"' || char === "'") quote = char
    else if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
  }
  return depth
}

/**
 * For each source line (1-based), the if/elif/else block it sits directly inside, or null. Lines inside a loop or
 * function nested in a branch belong to that loop or function, not the branch.
 */
export function branchesOf(code: string): Map<number, Branch> {
  return scan(code).branches
}

/** For each source line inside a for/while body, the line of its innermost loop. */
export function loopsOf(code: string): Map<number, number> {
  return scan(code).loops
}

function scan(code: string): { branches: Map<number, Branch>; loops: Map<number, number> } {
  const branches = new Map<number, Branch>()
  const loops = new Map<number, number>()
  const stack: { indent: number; keyword: string; line: number; chain: number }[] = []
  const chainAt = new Map<number, number>()
  let depth = 0
  code.split('\n').forEach((text, index) => {
    const line = index + 1
    const trimmed = text.trim()
    const continuation = depth > 0
    depth = Math.max(0, depth + depthChange(text))
    if (continuation || !trimmed || trimmed.startsWith('#')) return
    const indent = text.length - text.trimStart().length
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack[stack.length - 1]
    const loop = [...stack].reverse().find((block) => block.keyword === 'for' || block.keyword === 'while')
    if (loop) loops.set(line, loop.line)
    if (parent && (parent.keyword === 'if' || parent.keyword === 'elif' || parent.keyword === 'else')) {
      branches.set(line, { keyword: parent.keyword, line: parent.line, chain: parent.chain })
    }
    const header = trimmed.match(HEADER)
    if (header) {
      if (header[1] === 'if') chainAt.set(indent, line)
      const chain = header[1] === 'elif' || header[1] === 'else' ? chainAt.get(indent) ?? line : line
      stack.push({ indent, keyword: header[1], line, chain })
    }
  })
  return { branches, loops }
}
