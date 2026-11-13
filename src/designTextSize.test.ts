import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('design text sizes', () => {
  it.each(['src/App.css', 'src/index.css'])('%s has no absolute font size below 11px', (file) => {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const failures = [...css.matchAll(/font-size:\s*([\d.]+)(rem|px)\b/g)]
      .filter((match) => Number(match[1]) * (match[2] === 'rem' ? 16 : 1) < 11)
      .map((match) => `${file}:${css.slice(0, match.index).split('\n').length}: ${match[0]}`)
    expect(failures).toEqual([])
  })

  it('defines scalable reading sizes and uses the body token for instructions', () => {
    const tokens = readFileSync('src/index.css', 'utf8')
    for (const [name, size] of [['label', 11], ['small', 12], ['body', 13], ['emphasis', 14]]) {
      expect(tokens).toContain(`--font-size-${name}: ${Number(size) / 16}rem`)
    }
    const css = readFileSync('src/App.css', 'utf8')
    for (const selector of ['.lesson-task-instruction', '.lesson-goal-why', '.lesson-popover-now', '.goal-check', '.goal-check-text small', '.goal-checks-count']) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(css).toMatch(new RegExp(`${escaped}\\s*\\{[^}]*font-size: var\\(--font-size-body\\)`))
    }
  })
})
