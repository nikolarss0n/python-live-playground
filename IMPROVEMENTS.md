# Learning improvements roadmap

Quiet, RunJS-like visual and interaction upgrades.

## Done (Python learning)

- [x] **16. Visual collections** — expandable list/dict/set/tuple tree
- [x] **1. Line↔result reading surface** — stronger hover fill + path chips + ribbons
- [x] **2. What just ran pulse** — soft source-line highlight after each run
- [x] **3. Value type chips** — quiet `int` / `str` / `list` labels on results
- [x] **5. Error mini lesson** — always-visible tip + expand for full explanation
- [x] **6. Connectors with tall cards** — remeasure on expand/resize (error anchor)
- [x] **7. First-run coaching** — one-line Results hint until first success
- [x] **8. Quiet task progress** — soft ✓ on lesson tasks
- [x] **10. Keyboard loop** — ⌘/Ctrl+Enter Run, Esc Stop, `?` shortcuts
- [x] **11. Interactive blanks** — `???` underline, click-to-select
- [x] **12. Micro-hints ladder** — Next + “Stuck?” second hint after incomplete runs
- [x] **13. Predict then run** — optional quiet quiz (Lesson 1)
- [x] **15. Loop step scrubber** — when 3+ prints, focus one step at a time
- [x] **18. Lesson map** — path dots in the goal strip

## Visual polish (in progress / next)

- [x] **Line-aligned results** — rows stack beside source lines (wide layout)
- [x] **Single Results header** — one row for label + status + time + Previous
- [x] **Thin scrollbars / density** — quieter chrome
- [x] **Diff-aware re-run** — soft underline on changed outputs
- [x] **Previous-run ghost** — toggle faint prior results
- [x] **Active-line only when focused**
- [x] **Wrong vs fix in-code** (#14) — collapsible wrong/fixed pairs on repair labs
- [x] **Stretch challenge strip** (#17) — quiet stretch under every goal
- [x] **Book-style chapters** (#19) — optgroup menu + chapter label
- [x] **Share snapshot** (#20) — copy URL hash with lesson + code
- [x] **Richer loop scrub** (#15+) — step buttons show print previews

## AI foundations track (browser-local)

- [x] **21** Token chips — list-of-strings results render as chips
- [x] **23** Embedding-style labs — bag of words, vocab ids, dot product, cosine
- [x] **24** JSON contract lesson — required keys validation
- [x] **25** Pipeline strip — soft stages on AI lessons
- [x] **22** Prompt templates — string composition (no external model API)

## Deferred (separate product decisions)

- [ ] **26–29** FastAPI companion runner (needs local process boundary)
- [ ] Live LLM API sandbox (user-supplied key) — out of quiet MVP
