import { BLANK } from './goalCheck'

/** The starter split around its blanks, with each blank's answer, so the filled parts can be highlighted. */
export function solutionParts(starter: string, answers: readonly string[]): { text: string; filled: boolean }[] {
  const pieces = starter.split(BLANK)
  return pieces.flatMap((text, index) =>
    index < pieces.length - 1 ? [{ text, filled: false }, { text: answers[index] ?? BLANK, filled: true }] : [{ text, filled: false }],
  )
}
