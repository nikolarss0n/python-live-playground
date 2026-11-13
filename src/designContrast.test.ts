import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Color = readonly [number, number, number, number]
type Theme = 'light' | 'dark'
const css = readFileSync('src/index.css', 'utf8')
const appCss = readFileSync('src/App.css', 'utf8')
const editor = readFileSync('src/components/CodeEditor.tsx', 'utf8')

function parts(text: string): string[] {
  const result: string[] = []
  let depth = 0, start = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') depth++
    if (text[index] === ')') depth--
    if (text[index] === ',' && depth === 0) { result.push(text.slice(start, index).trim()); start = index + 1 }
  }
  return [...result, text.slice(start).trim()]
}

function mix(a: Color, b: Color, weight: number): Color {
  const alpha = a[3] * weight + b[3] * (1 - weight)
  if (!alpha) return [0, 0, 0, 0]
  const channel = (index: 0 | 1 | 2) => (a[index] * a[3] * weight + b[index] * b[3] * (1 - weight)) / alpha
  return [channel(0), channel(1), channel(2), alpha]
}

function over(a: Color, b: Color): Color {
  const alpha = a[3] + b[3] * (1 - a[3])
  if (!alpha) return [0, 0, 0, 0]
  const channel = (index: 0 | 1 | 2) => (a[index] * a[3] + b[index] * b[3] * (1 - a[3])) / alpha
  return [channel(0), channel(1), channel(2), alpha]
}

function parseColor(value: string, tokens: Readonly<Record<string, string>>): Color {
  const input = value.trim()
  if (input === 'transparent') return [0, 0, 0, 0]
  const variable = /^var\((--[\w-]+)(?:,\s*(.*))?\)$/.exec(input)
  if (variable) {
    const resolved = tokens[variable[1]] ?? variable[2]
    if (!resolved) throw new Error(`Missing color token ${input}`)
    return parseColor(resolved, tokens)
  }
  if (input.startsWith('color-mix(in srgb,')) {
    const [left, right] = parts(input.slice('color-mix(in srgb,'.length, -1))
    const weighted = /^(.*)\s+(\d+(?:\.\d+)?)%$/.exec(left)
    return mix(parseColor(weighted?.[1] ?? left, tokens), parseColor(right, tokens), weighted ? Number(weighted[2]) / 100 : 0.5)
  }
  const hex = /^#([\da-f]{6})$/i.exec(input)
  if (hex) {
    const value = parseInt(hex[1], 16)
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1]
  }
  const rgb = /^rgba?\((.*)\)$/.exec(input)
  if (rgb) {
    const values = rgb[1].split(/\s*[,/]\s*|\s+/).filter(Boolean)
    const channel = (index: number) => Number(values[index]?.replace('%', '')) / (values[index]?.includes('%') ? 100 : 255)
    const alpha = values[3] === undefined ? 1 : Number(values[3].replace('%', '')) / (values[3].includes('%') ? 100 : 1)
    return [channel(0), channel(1), channel(2), alpha]
  }
  throw new Error(`Unsupported color expression: ${input}`)
}

function luminance(color: Color): number {
  return color.slice(0, 3).reduce((sum, channel, index) =>
    sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index], 0)
}
function contrast(a: Color, b: Color): number {
  return (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
}
function declarations(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]))
}
function rule(selector: string): string {
  const source = appCss.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].split(',').some((candidate) => candidate.trim() === selector)) return match[2]
  }
  throw new Error(`Missing rule ${selector}`)
}
function declaration(selector: string, property: string): string {
  const match = new RegExp(`(?:^|[;\\n])\\s*${property}:\\s*([^;]+);`).exec(rule(selector))
  if (!match) throw new Error(`Missing ${property} for ${selector}`)
  return match[1].trim()
}
function editorColor(selector: string, property: string, theme: Theme): string {
  const start = editor.indexOf(`'${selector}': {`)
  if (start < 0) throw new Error(`Missing editor rule ${selector}`)
  const block = editor.slice(start, editor.indexOf('\n      },', start))
  const match = new RegExp(`${property}:\\s*isDark\\s*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'`).exec(block)
  if (!match) throw new Error(`Missing theme color for ${selector}`)
  return theme === 'dark' ? match[1] : match[2]
}

function palette(theme: Theme): Record<string, string> {
  const light = /:root\s*\{([^}]+)\}/.exec(css)?.[1]
  const dark = /:root\[data-theme='dark'\]\s*\{([^}]+)\}/.exec(css)?.[1]
  if (!light || !dark) throw new Error('Both theme token blocks are required')
  return { ...declarations(light), ...(theme === 'dark' ? declarations(dark) : {}) }
}

describe('design contrast from shipped styles', () => {
  it('preserves error colors and limits normal text to overlapping blank/error glyphs', () => {
    expect(palette('light')['--danger']).toBe('#8d392f')
    expect(palette('dark')['--danger']).toBe('#f28279')
    expect(declaration('.cm-problem-mark', 'color')).toBe('var(--danger)')
    expect(declaration('.cm-problem-mark', 'border-bottom')).toBe('2px solid var(--danger)')
    for (const selector of ['.cm-problem-mark .cm-blank-token', '.cm-blank-token .cm-problem-mark', '.cm-blank-token.cm-problem-mark']) {
      expect(declaration(selector, 'color')).toBe('var(--text)')
      expect(declaration(`${selector} *`, 'color')).toBe('var(--text)')
    }
  })

  it('uses alpha compositing and WCAG linear-light luminance', () => {
    expect(contrast([0, 0, 0, 1], [1, 1, 1, 1])).toBe(21)
    expect(over([0, 0, 0, 0.5], [1, 1, 1, 1])).toEqual([0.5, 0.5, 0.5, 1])
  })

  it.each<Theme>(['light', 'dark'])('%s text reaches 4.5:1 on its actual surfaces and line tints', (theme) => {
    const tokens = palette(theme), color = (value: string) => parseColor(value, tokens)
    const surface = color('var(--surface)'), bg = color('var(--bg)')
    const failures: string[] = []
    const check = (label: string, foreground: Color, background: Color, opacity = 1) => {
      const ratio = contrast(over([foreground[0], foreground[1], foreground[2], foreground[3] * opacity], background), background)
      if (!Number.isFinite(ratio) || ratio < 4.5) failures.push(`${label}: ${ratio.toFixed(2)}:1`)
    }
    for (const token of ['--text', '--muted', '--gutter', '--accent', '--accent-deep', '--expr', '--ok', '--warn', '--solution', '--coll-tuple', '--coll-set', '--danger']) {
      check(`${token} on surface`, color(`var(${token})`), surface)
      check(`${token} on bg`, color(`var(${token})`), bg)
    }
    check('primary button', color('var(--on-accent)'), color('var(--accent)'))
    const opacity = Number(declaration('.lesson-task:not(.is-current) .lesson-task-instruction', 'opacity'))
    check('upcoming task', color(declaration('.lesson-task-instruction', 'color')), surface, opacity)
    const label = color(declaration('.lesson-task-instruction-label', 'color'))
    check('How label', label, surface)
    check('Then label', label, surface, opacity)
    check('ask placeholder', color(declaration('.coach-ask-input::placeholder', 'color')), bg)
    const footer = over(color(declaration('.app-footer', 'background')), bg)
    check('footer hint', color(declaration('.footer-hint', 'color')), footer)
    const problemLine = over(color(declaration('.cm-problem-line', 'background')), surface)
    check('marked error token', color(declaration('.cm-problem-mark', 'color')),
      over(color(declaration('.cm-problem-mark', 'background')), problemLine))
    const blankTint = color(editorColor('.cm-blank-token', 'backgroundColor', theme))
    const problemTint = color(declaration('.cm-problem-mark', 'background'))
    check('unfilled blank inside an error mark', color(declaration('.cm-problem-mark .cm-blank-token', 'color')),
      over(blankTint, over(problemTint, problemLine)))
    check('error mark inside an unfilled blank', color(declaration('.cm-blank-token .cm-problem-mark', 'color')),
      over(problemTint, over(blankTint, problemLine)))
    const backgrounds: [string, Color][] = [
      ['white/surface', surface],
      ['active line', over(color(editorColor('&.cm-focused .cm-activeLine', 'backgroundColor', theme)), surface)],
      ['run pulse', over(color(editorColor('.cm-run-pulse-line', 'backgroundColor', theme)), surface)],
      ['problem line', problemLine],
    ]
    const highlight = new RegExp(`const ${theme}Highlight = HighlightStyle.define\\(\\[([\\s\\S]*?)\\]\\)`).exec(editor)?.[1]
    if (!highlight) throw new Error(`Missing ${theme} highlight style`)
    const highlights = [...highlight.matchAll(/color: '([^']+)'/g)]
    expect(highlights.length).toBeGreaterThan(10)
    for (const match of highlights) for (const [name, background] of backgrounds) check(`syntax ${match[1]} on ${name}`, color(match[1]), background)
    check('editor gutter', color(editorColor('.cm-gutters', 'color', theme)), surface)
    expect(failures, `${theme} rendered pairs below 4.5:1`).toEqual([])
  })
})
