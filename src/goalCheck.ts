/**
 * Smarter lesson goal evaluation.
 *
 * Rules of thumb:
 * - Only the code that actually ran counts (executedCode must match editor).
 * - Success required by default.
 * - Starters with ??? must be edited and blanks removed.
 * - Prefer structural signals (print count, patterns) over weak substring checks.
 */

import type { ExecutionStatus, ResultEvent } from './execution/protocol'

/** Placeholder token learners replace in starter code. */
export const BLANK = '???'

/**
 * Soft goal detection (no grades). Prefer structured fields over weak checks.
 * Defaults (when starter has ???): must edit starter, no blanks, require success + fresh run.
 */
export type GoalCheck = {
  /** Default true — status must be success */
  requireSuccess?: boolean
  /** Default true — editor code must match the code that just ran */
  requireFreshRun?: boolean
  /** Default true if starter has ??? — code must change from starter */
  mustEditStarter?: boolean
  /** Default true if starter has ??? */
  noBlanks?: boolean
  minPrints?: number
  minNonEmptyPrints?: number
  minExprs?: number
  printsInclude?: string[]
  printPatterns?: string[]
  exprPatterns?: string[]
  codeIncludes?: string[]
  codeExcludes?: string[]
  codeForbidden?: string[]
  codePatterns?: string[]
  codeForbiddenPatterns?: string[]
  /** @deprecated use requireSuccess */
  runsOk?: boolean
}

export type GoalProgress = {
  met: boolean
  missing: string[]
}

export type GoalLesson = {
  code: string
  goalCheck?: GoalCheck
}

export function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      // Strip full-line and trailing comments for comparison.
      const noComment = line.replace(/(^|[^"'])#.*$/, '$1')
      return noComment.trimEnd()
    })
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim()
}

export function collectPrints(events: ResultEvent[]): string[] {
  return events
    .filter((e): e is Extract<ResultEvent, { kind: 'print' }> => e.kind === 'print')
    .map((e) => e.text)
}

export function collectExprs(events: ResultEvent[]): string[] {
  return events
    .filter((e): e is Extract<ResultEvent, { kind: 'expr' }> => e.kind === 'expr')
    .map((e) => e.value)
}

function matchesAll(patterns: string[] | undefined, haystack: string): string[] {
  if (!patterns?.length) return []
  const missing: string[] = []
  for (const p of patterns) {
    try {
      const re = new RegExp(p, 'm')
      if (!re.test(haystack)) missing.push(p)
    } catch {
      if (!haystack.includes(p)) missing.push(p)
    }
  }
  return missing
}

function anyLineMatches(patterns: string[] | undefined, lines: string[]): string[] {
  if (!patterns?.length) return []
  const missing: string[] = []
  for (const p of patterns) {
    let ok = false
    try {
      const re = new RegExp(p)
      ok = lines.some((line) => re.test(line))
    } catch {
      ok = lines.some((line) => line.includes(p))
    }
    if (!ok) missing.push(p)
  }
  return missing
}

export type GoalEvalInput = {
  code: string
  starterCode: string
  status: ExecutionStatus
  events: ResultEvent[]
  /** Code that produced events; goal needs this to match current code. */
  executedCode: string | null
}

/**
 * Evaluate whether the learner met the lesson goal.
 */
export function evaluateGoal(lesson: GoalLesson, input: GoalEvalInput): GoalProgress {
  const check: GoalCheck = lesson.goalCheck ?? {}
  const missing: string[] = []
  const code = input.code
  const starterHasBlank = lesson.code.includes(BLANK)
  // Support deprecated runsOk alias
  if (check.runsOk === false) check.requireSuccess = false
  if (check.runsOk === true) check.requireSuccess = true
  const prints = collectPrints(input.events)
  const exprs = collectExprs(input.events)
  const printStream = prints.join('\n')

  const requireSuccess = check.requireSuccess !== false
  const requireFreshRun = check.requireFreshRun !== false
  const noBlanks = check.noBlanks ?? starterHasBlank
  const mustEdit = check.mustEditStarter ?? starterHasBlank

  // 1) Code that ran must be what's in the editor (no stale success).
  if (requireFreshRun) {
    if (!input.executedCode) {
      missing.push('Run your code')
    } else if (normalizeCode(input.executedCode) !== normalizeCode(code)) {
      missing.push('Run again after your latest edits')
    }
  }

  // 2) Successful run (errors/timeouts never complete a skill lesson).
  if (requireSuccess && input.status !== 'success') {
    if (input.status === 'timeout') {
      missing.push('Stop the infinite loop so the program can finish')
    } else if (input.status === 'error') {
      missing.push('Fix errors so the program runs successfully')
    } else if (!missing.some((m) => m.startsWith('Run'))) {
      missing.push('Run your code successfully')
    }
  }

  // 3) No leftover blanks.
  if (noBlanks && code.includes(BLANK)) {
    missing.push('Replace every ??? with real code')
  }

  // 4) Actually changed the starter (when it was a fill-in lesson).
  if (mustEdit && normalizeCode(code) === normalizeCode(input.starterCode)) {
    missing.push('Change the starter code to complete the task')
  }

  // 5) Explicit forbids / requires in source.
  for (const s of check.codeForbidden ?? check.codeExcludes ?? []) {
    if (s === BLANK) continue // handled above
    if (code.includes(s)) {
      missing.push(`Remove \`${s}\` from your code`)
    }
  }

  for (const s of check.codeIncludes ?? []) {
    if (!code.includes(s)) {
      missing.push(`Use \`${s}\` in your code`)
    }
  }

  const badCodePatterns = matchesAll(check.codePatterns, code)
  for (const p of badCodePatterns) {
    missing.push(`Adjust your code to match the lesson pattern`)
    void p
    break // one generic message is enough
  }

  const forbiddenPatterns = matchesAll(check.codeForbiddenPatterns, code)
  // matchesAll returns patterns that did NOT match; for forbidden we need patterns that DID match
  if (check.codeForbiddenPatterns?.length) {
    for (const p of check.codeForbiddenPatterns) {
      try {
        if (new RegExp(p, 'm').test(code)) {
          missing.push('Remove the old incorrect pattern from your code')
          break
        }
      } catch {
        if (code.includes(p)) {
          missing.push('Remove the old incorrect pattern from your code')
          break
        }
      }
    }
  }
  void forbiddenPatterns

  // 6) Output structure.
  const nonEmptyPrints = prints.filter((p) => p.trim().length > 0)
  if (check.minPrints != null && prints.length < check.minPrints) {
    missing.push(`Print at least ${check.minPrints} line(s)`)
  }
  if (
    check.minNonEmptyPrints != null &&
    nonEmptyPrints.length < check.minNonEmptyPrints
  ) {
    missing.push(`Print at least ${check.minNonEmptyPrints} non-empty line(s)`)
  }
  if (check.minExprs != null && exprs.length < check.minExprs) {
    missing.push(`Leave at least ${check.minExprs} expression(s) that show a value`)
  }

  for (const s of check.printsInclude ?? []) {
    if (!printStream.includes(s)) {
      missing.push(`Print something containing “${s}”`)
    }
  }

  const missingPrintPatterns = matchesAll(check.printPatterns, printStream)
  if (missingPrintPatterns.length) {
    missing.push('Print the output the lesson is aiming for')
  }

  const missingExprPatterns = anyLineMatches(check.exprPatterns, exprs)
  if (missingExprPatterns.length) {
    missing.push('Show the expected expression value on the right')
  }

  // Deduplicate missing messages while preserving order.
  const seen = new Set<string>()
  const unique = missing.filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })

  return { met: unique.length === 0, missing: unique }
}
