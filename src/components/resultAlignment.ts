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
export function computeStackedTops(
  targets: readonly (number | null)[],
  heights: readonly number[],
  gap: number,
): number[] {
  const tops: number[] = []
  let prevBottom = Number.NEGATIVE_INFINITY
  for (let i = 0; i < heights.length; i += 1) {
    const target = targets[i] ?? Number.NEGATIVE_INFINITY
    const stacked = i === 0 ? 0 : prevBottom + gap
    const top = Math.max(target, stacked, 0)
    tops.push(top)
    prevBottom = top + Math.max(0, heights[i] ?? 0)
  }
  return tops
}
