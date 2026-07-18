/**
 * Infer a quiet type label for plain print/expr strings (no structure tree).
 */

export function inferTypeLabel(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  if (t === 'True' || t === 'False') return 'bool'
  if (t === 'None') return 'NoneType'
  if (/^-?\d+$/.test(t)) return 'int'
  if (/^-?\d+\.\d+$/.test(t) || /^-?\d+\.\d+e[+-]?\d+$/i.test(t)) return 'float'
  if (
    (t.startsWith("'") && t.endsWith("'")) ||
    (t.startsWith('"') && t.endsWith('"'))
  ) {
    return 'str'
  }
  if (t.startsWith('[') && t.endsWith(']')) return 'list'
  if (t.startsWith('{') && t.endsWith('}') && t.includes(':')) return 'dict'
  if (t.startsWith('{') && t.endsWith('}')) return 'set'
  if (t.startsWith('(') && t.endsWith(')')) return 'tuple'
  // Bare print strings without quotes still look like text to beginners.
  if (!/^[\[{(]/.test(t) && /[a-zA-Z]/.test(t)) return 'str'
  return null
}
