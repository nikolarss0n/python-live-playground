/**
 * Vertical alignment of result rows beside their source lines.
 *
 * Each row wants its top at the source line’s vertical position (`targets`,
 * in results-body content coordinates; `null` = no line, just stack).
 * Rows may never overlap: a row whose target is already covered stacks
 * directly below the previous row with `gap` spacing.
 *
 * Pure — the panel measures DOM rows and applies the result as margins.
 */

export type AlignMode = 'full' | 'soft' | 'off'

export type StackOptions = {
  /** Cap how far the first row may drop (soft/narrow layouts). */
  maxFirstTop?: number
  /** Cap extra spacing between consecutive rows. */
  maxStep?: number
}

export function computeStackedTops(
  targets: readonly (number | null)[],
  heights: readonly number[],
  gap: number,
  options: StackOptions = {},
): number[] {
  const maxFirst = options.maxFirstTop ?? Number.POSITIVE_INFINITY
  const maxStep = options.maxStep ?? Number.POSITIVE_INFINITY
  const tops: number[] = []
  let prevBottom = Number.NEGATIVE_INFINITY
  for (let i = 0; i < heights.length; i += 1) {
    const target = targets[i] ?? Number.NEGATIVE_INFINITY
    const stacked = i === 0 ? 0 : prevBottom + gap
    let top = Math.max(target, stacked, 0)
    if (i === 0) {
      top = Math.min(top, maxFirst)
    } else {
      const prevTop = tops[i - 1] ?? 0
      const prevH = heights[i - 1] ?? 0
      const maxTop = prevTop + prevH + gap + maxStep
      top = Math.min(top, maxTop)
      top = Math.max(top, stacked)
    }
    tops.push(top)
    prevBottom = top + Math.max(0, heights[i] ?? 0)
  }
  return tops
}

/** Soft caps for stacked (narrow) viewports — keep results readable. */
export function stackOptionsForMode(mode: AlignMode): StackOptions | null {
  if (mode === 'off') return null
  if (mode === 'soft') return { maxFirstTop: 56, maxStep: 40 }
  return {}
}
