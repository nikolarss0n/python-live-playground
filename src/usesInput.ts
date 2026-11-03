/** True when the code calls input(), so the Inputs box is worth showing. */
export function usesInput(code: string): boolean {
  return /(?<![\w.])input\s*\(/.test(code)
}
