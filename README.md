# Python Live

A calm, beginner-friendly Python scratchpad inspired by the interaction quality of [RunJS](https://runjs.app/play): write Python on the left and see results on the right as you type.

Runs entirely in the browser (Pyodide in a Web Worker). No account, no backend, no package manager.

## Requirements

- Node.js 20+ (22 recommended)
- npm 10+
- Python 3.11+ for the Python-backed tests and optional local lab; using the browser playground needs no Python installation

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

The first run downloads the Pyodide runtime from the jsDelivr CDN (~10–20 MB). After that, the worker caches it in the browser.

## Test

```bash
npm run lint
npm test
```

Watch mode:

```bash
npm run test:watch
```

With the dev server running, verify real Pyodide execution and the desktop flows. Mobile work is deferred for the current refresher task:

```bash
npx playwright install chromium  # first browser-test run only
npm run verify:browser -- --desktop-only
npm run verify:service -- --desktop-only
npm run verify:genai -- --desktop-only
npm run verify:refresher
npm run verify:error-help
npm run verify:apply-fix  # Apply fix, then checks the fixed program's output
npm run verify:jev        # live TypeSafe call; needs TYPESAFE_API_KEY
npm run verify:jev-goal   # live Jev goal judging on lesson tasks; needs TYPESAFE_API_KEY
npm run verify:goal-checks -- http://localhost:5173  # browser: green goal checks at desktop and narrow widths
npm run verify:no-flicker -- http://localhost:5173   # browser: an edit re-renders only the changed result
npm run verify:pyodide-errors  # 240 error programs through the app runner on Pyodide's Python 3.12
```

## Build

```bash
npm run build
npm run preview
```

### Python worker isolation

Learner Python can reach JavaScript through Pyodide, so the worker is treated as untrusted:

- `npm run dev` and `npm run preview` serve the worker with its own Content-Security-Policy (`vite.workerCsp.ts`): it may load scripts from this origin and Pyodide from `cdn.jsdelivr.net`, fetch only from that CDN, and start no workers. Python therefore cannot call the local Jev proxy or send data elsewhere. **Static hosting must send the same header** for `assets/python.worker-*.js`, using `PYTHON_WORKER_CSP`.
- Messages from the worker are rebuilt field by field before the page uses them (`src/execution/workerMessages.ts`).
- Code opened from a shared link is untrusted until you edit it: your own draft is kept as a restorable backup, and the next run of other code starts a fresh worker.

## What this MVP includes

- Two-pane layout: Python editor + live results aligned beside source lines (wide), hover path ribbons + var chips
- Automatic execution after a short typing pause, plus **Run** and **Stop**
- Captured `print()` output, top-level expression values, and collections shown as cards: a pill with the Python brackets and a count (`{:} dict · 3 keys`, `( ) tuple · 2 items`), then one framed row per item with its index or key; each kind has its own hue and nested collections open as smaller cards
- Simulated FastAPI in the worker (`from fastapi import FastAPI` + `TestClient`); responses render as pretty JSON HTTP cards
- Quiet type chips (`int`, `str`, `list`, …) and soft goal / task progress
- Friendly error cards with always-visible “what to fix” + optional full explanation
- Soft loop timeout + hard Stop that terminates and recreates the worker
- 195 lessons and day sessions across seven tracks, beginning with a complete **14-day Python refresher**
- Recall, syntax explanations, guided practice, independent drafts, and saved mistake review, with recoverable exercise restart
- Two timed mock interviews with hidden problem variants, frozen submissions, and a midway requirement change
- A three-exercise **Project: build an AI service** track that carries your code from a validation function to a FastAPI endpoint and request tests
- Browser-local drafts and completion progress, restored on reload and when switching lessons or tracks
- Quiet **lesson coach** ask field under Results (uses your Settings LLM key; compact structured context, short replies)
- Light and dark themes, keyboard shortcuts (`⌘/Ctrl+Enter`, `Esc`, `?`)
- Responsive layout for desktop and narrow widths

Learning polish roadmap: [IMPROVEMENTS.md](./IMPROVEMENTS.md).

## AI Engineer learning path

The toolbar menu has five sections, each one lesson list numbered from 1 (`src/curriculum/sections.ts` decides what goes where):

- **Learn Python** — Python basics (lessons 1–32), then Python in depth (33–75)
- **Machine learning & LLMs** — lessons 1–56
- **Build AI services** — APIs & production AI (1–61, ending with Support automation and Full-stack data), GenAI services (62–71), then the build-a-service project (72–74)
- **Interview prep** — the 14-day refresher (Day 1–14), then array patterns and data structures & algorithms (lessons 15–32)
- **Algorithm practice** — 25 frequently asked problems in six chapters: arrays & strings, searching & sorting, trees, graphs, dynamic programming, and lists, stacks & recursion (lessons 1–25)
- **Agent harness interview** — 13 lessons for a live-coding interview on production AI agents: tool registry, argument validation, a bounded agent loop over a scripted fake model, async tools with timeouts, human approval for writes, idempotency keys, retries with backoff, a prompt-injection guard, structured traces, regression evals, then two mock sessions (build, then harden). Function bodies start empty with Idea → What to use → Plan → Shape hints. Code can use top-level `await`, like a notebook
- **Playground** — a free editor with no goal or checks: plain Python, the `playdb` practice database, FastAPI routes and the Data · API · View tabs are all available (`/?lesson=playground`). **Project data** in the Data tab picks which practice datasets are loaded before every run; the choice is remembered on this device

The parts below keep their own checks and UI inside those sections. New visitors begin with the refresher; existing lesson links and saved drafts are preserved. The core path is deterministic and browser-local. The general AI coach is hidden in the refresher. Optional error hints are available during supported learning stages; AI requests are disabled during independent attempts and mocks, including elsewhere in the app while a mock is active.

### Blank hints and a quiet start

A lesson opened with its `???` blanks untouched shows "Fill the N ??? blanks" in Results instead of the parse error; the error appears after the first edit or an explicit Run. Starters without blanks still show errors right away. The orange **Hint** pill above the editor (with the count of blanks left) opens a bubble anchored on the blank under the cursor, or the first one. Each press or **More help** goes one step further: first what kind of code belongs in the blank and why the line needs it (worked out from the line — a `return`, a `key=`, `self.x = ???` inside `__init__`, an operator…) with clues such as the enclosing function's parameters or names defined above (`src/blankSlot.ts`), then the matching task with its detailed instruction, then — for lessons listed in `src/curriculum/blankAnswers.ts` — the answer with **Insert**. Esc or any edit closes the bubble. Hint steps come from the lesson's own tasks (`src/blankHints.ts`); `blankAnswers.python.test.ts` and the chapter Python tests run every listed answer in real `python3`.

Algorithm practice lessons start with an empty function body (one `???`), so you write the algorithm yourself. Hint never hands out the answer: it climbs from **the idea** to **what to use** (a set, two pointers, a heap…), a **plan** in words, and the **shape of the code** (`src/curriculum/algorithmLayers.ts`). The purple **Solution** pill, shown on every lesson with known answers, opens the whole worked program with the filled parts highlighted; click it again (or press Esc) to hide it. Your code is never changed.

### Hover explanations

Hover any word in the editor for a short card saying what it is and where it comes from (`src/codeExplain.ts`, `src/editor/codeHover.ts`). It covers Python keywords, built-ins, special methods such as `__init__`, `self`, common methods (`.append`, `.items`, …) and modules. For your own names it traces the origin: a parameter of which function (and its default), a loop variable and what it walks over, the line a variable, function, class or `self.x` attribute was set, or the import it came from. Strings and comments are skipped.

### Error explanations and optional AI hints

Local syntax guidance identifies common slips such as `function` instead of `def`, JavaScript declaration/operator spellings, missing colons, indentation, and unfinished `???` expressions, including inside f-strings. It points to the relevant edit and supplies a small fixed example where the source supports one. Original Python messages and tracebacks remain available. These explanations need no key or network provider.

For less obvious errors, expand **AI error help** inside the error card. Configure an OpenAI-compatible model in **Settings**, inspect **Snippet and error to send**, then choose **Ask for a hint**. No request happens automatically. The model receives a bounded excerpt around the failing line, a short error, and the lesson title; obvious sensitive patterns are masked, but the preview should still be checked before sending. Model responses are validated as short suggestions and shown in the editor under the failing line; **Insert as comment** adds them as `#` comments, and nothing is applied automatically. Editing the source, changing stage, cancelling, or entering a restricted practice mode cancels and discards stale advice. Live provider connectivity depends on the configured endpoint and browser CORS support.

Error hints and model testing are unavailable during independent refresher attempts and mock interviews. Local Python diagnostics remain available. No live provider requests were used to validate this feature; automated tests use synthetic responses.

On a busy machine, the complete unit suite can use fewer workers without changing its assertions: `npm test -- --maxWorkers=2`.

**Problem pinpointing.** Every fresh error (outside restricted practice modes) is first diagnosed locally by `src/jev/diagnose.ts`, with no network and no key. It uses the error's line, column and traceback frames to mark the exact token, missing line end or indentation in red, explains why, and offers **Apply fix** / **Dismiss** under the line. It covers keyword and name typos, foreign syntax (`&&`, `else if`, `.push`), missing `:`/brackets, indentation, `None` returned by a function, index/key/type/value errors, wrong arguments, recursion and import typos. Timeouts point at the loop condition and add the missing update. Where the right change is clear it also offers a guard or a missing line (`if items:`, `if b != 0:`, `import math`, an `except` block, a reordered `def`). Renames and moved lines rewrite the whole program in one step. A placeholder such as `0` for a missing argument is called out as one to replace. Two kinds get a reason without **Apply fix**: a package that cannot be installed in browser Python, and a failed `assert`, which is itself the test. When Python stops inside a function because of a bad value (text where a number belongs, or `None`), it follows the traceback back to where that value was set, such as a quoted number in a list ten lines above, and fixes it there. Mixed tabs and spaces are re-indented by block depth. Any other exception still gets its expression marked. When other suspicious lines exist, it adds "Also check lines …". Any edit clears the mark.

When the local diagnoser cannot place an error, and for a failing behaviour check, the app asks **Jev** (TypeSafe) instead. Jev searches the lines around each traceback frame and the lines that assign the names used there. It chooses the token and kind of mistake, and `src/jev/pinpoint.ts` turns that choice into a reason and, when possible, a corrected line. Lines that the secret masking would change are never sent. The browser posts to the same-origin `/api/jev/systemone`, and the Vite middleware (`vite.jev.ts`) adds the key server-side, so it never enters the bundle. Configure it in a gitignored `.env.local`:

```bash
TYPESAFE_API_KEY=...
TYPESAFE_MODEL=jev-latest   # optional
```

After a clean run of a lesson, the Results pane shows **goal checks**: one row per task plus the goal, each with a green check or a red cross and a reason (HackerRank style). Jev judges each row as met, unchanged, wrong output or missing (`src/jev/goalJudge.ts`); a confident *met* turns a row green; when the local check already passes, a low-confidence *met* or a “changed other code” verdict with no changed starter line counts as passed too (for the goal only when every task passes). The goal also needs the local goal check. A check passed once in a lesson stays green (“Passed in an earlier run”), because “then try …” steps undo the step before them. The task counter on the **Lesson** pill follows the same checks. Without Jev the rows use the local checks. Saved lesson completion still uses only the local goal check.

Restart `npm run dev` after changing it. Static builds without the middleware skip Jev; local diagnosis still works. `npm run verify:jev` runs a live Jev check (needs the key and `python3`). The `diagnose.python.test.ts` unit test applies every local fix and re-runs it in real `python3` (skipped when Python is missing). Model hints from **AI error help** also appear in the editor, offered as comments to insert.

### 14-day Python refresher (14)

Choose **14-day Python refresher**, or open `http://localhost:5173/?lesson=refresher-01`. The [supplied curriculum](docs/python-refresher-plan.md) is implemented in full; the [requirement and evidence map](docs/refresher-coverage.md) explains its verification boundaries. Plan for 60–90 minutes daily: normal practice days suggest 75 minutes, mocks allow 60 minutes, and the final consolidation suggests a light 60 minutes. The actual interview format remains unconfirmed.

The session lives inside the editor: stage tabs sit in the editor's top bar, **Task** opens a floating card with the stage instructions, notes, checks and Continue (it closes when you click outside it), and syntax hints are pills above the code that open a small card.

Each normal session has five stages with separate saved drafts and notes:

1. **Recall:** write yesterday's idea from memory; Day 1 asks only for a starting point.
2. **Explain:** run a worked example and inspect short syntax explanations before acknowledging understanding.
3. **Guided:** complete an exercise or repair a real bug; guidance gradually decreases. Day 7 starts with runnable broken validation and failing assertions.
4. **Independent:** rebuild from unsolved signatures in a separate draft, without the walkthrough beside the code.
5. **Review:** inspect checks, explain mistakes, and record a correction. Reflection acknowledgments are self-reported; code completion requires checks of the exact executed source and context.

Days 1–7 cover syntax through testing, including `unique_ids`, `latest_by_id`, copying/mutation and deterministic counting. Days 8–11 cover modules/files/dataclasses, reliable requests, three concurrent calls, and a runner limited to two active calls with ordered outcomes and cleanup. Browser files are real files in the temporary worker filesystem, not access to the host filesystem. CLI, virtual-environment, package and `asyncio.run` instructions are clearly labeled; browser checks use plain assertions rather than pretending pytest is installed.

**Days 12–13: timed mocks.** Start reveals an unused local variant from a three-problem pool. The timer persists through navigation and reload; only one mock can run at a time. Use 5 minutes to clarify, 5 to plan, 30 to implement, 15 to test/debug, and 5 to explain. Day 13 reveals an additional requirement at minute 30; submitting before it creates a partial attempt that cannot complete that day. Submission or expiry freezes the code. Automated checks and the review rubric appear afterward. Once every variant has been shown, subsequent attempts are labeled retakes. This is self-directed practice, not proctoring or a guarantee that a problem is unfamiliar outside this browser.

**Day 14: consolidation.** Pick exactly two named functions, suggested from unresolved mistakes. Guided time is for planning and an environment check; rebuild the functions once in the independent stage. Each selection pair has separate saved work. Tests verify both selected contracts, and the final reflection keeps this session focused on weak concepts.

**Mistakes and recovery.** The local mistake log stores the error, its cause and the correct pattern; entries can be edited, resolved and reopened. Restart saves a recoverable backup before changing the current draft. Restore works after reload and preserves newer work. If the backup cannot be saved or history is full, restart is refused without discarding the draft. Clearing browser site data still removes local work; there is no account or cloud sync.

Days 7, 8 and 14 link to a downloadable [local Python practice pack](labs/python-refresher/README.md), with real scripts, imports, JSON files, dataclasses, pytest and bounded asyncio. It has no AWS dependency and contains no mock interview solutions. AWS and framework exercises remain separate, for after the foundations feel comfortable.

Rebuild its source-only download after changing the pack:

```bash
python3 scripts/package-refresher-lab.py
```

### Project: build an AI service (3)

Choose **Build AI services** and go to lesson 72, or open `http://localhost:5173/?lesson=service-validation`.

1. **Validate a question:** complete `validate_question(payload)` to trim useful text and reject empty, missing, or incorrectly typed input.
2. **Expose a FastAPI endpoint:** carry your verified function into `POST /ask`, return the normalized question, and translate validation errors into HTTP 422 responses.
3. **Test valid and invalid requests:** carry your endpoint forward and write assertions for response status and body with the simulated `TestClient`.

Behavior checks run inside the Python worker. They call your function and endpoint with several inputs; the final exercise also checks that your tests detect deliberately broken responses. Printed success messages alone do not complete these exercises. **Next** unlocks after the current exercise passes. Existing drafts are preserved when returning to a step, and changes to earlier steps do not overwrite later drafts. FastAPI remains an explicitly labeled browser simulation; this path does not call a model, install packages, or start a server.

Code, completion for the exact checked source, the current lesson, and each track's last lesson are saved in this browser's localStorage. Editing verified code clears that completion until checks pass again. The footer reports save failures; editing still works if storage is blocked or full. Clearing site data removes saved work, and another browser or origin has separate storage. A lesson URL opens its saved draft; a shared-code URL loads its supplied code into that lesson's draft.

### GenAI services (10)

In **Build AI services**, lessons 62–71. These are short, independent exercises so each Python skill stays visible without accumulating a large source file:

1. Typed dataclasses and explicit runtime input validation.
2. Real `asyncio` concurrency, bounded waits, and cancellation cleanup.
3. Table-driven assertions that catch deliberately broken implementations.
4. Versioned prompts with separate instruction and user-data roles.
5. Strict validation of model JSON, including missing, extra, and incorrectly typed fields.
6. An injected fake Bedrock Converse client with realistic request/response dictionaries.
7. Bounded retries for transient failures, with no retry of permission or validation errors.
8. A small allowlisted tool loop with validated arguments and a turn limit.
9. Trusted-principal tenant and scope checks enforced by Python code.
10. Illustrative redaction and audit records containing only approved metadata.

All ten use executable behavior checks inside the replaceable worker. They require no account, key, packages, or network provider. `asyncio` is real Python; Bedrock and agent-framework behavior is explicitly simulated. The testing exercise uses plain assertions, not an installed pytest runner. Character limits are labeled as character limits, not token accounting, and illustrative redaction is not comprehensive DLP.

Every worker run cancels and awaits background tasks it created before returning. Stop and the hard timeout replace the worker, including when learner code refuses cancellation.

Under **Show lesson**, **Download local AWS lab** provides the separate [Python lab](labs/aws-genai/README.md), including real pytest, boto3 with offline SDK tests, and an optional LangChain example. Its default mode is offline; live AWS work is opt-in and uses local AWS authentication, never browser credentials. The frontend does not execute this lab or submit anything to AWS.

Completed exercises demonstrate practice with these contracts. They do not establish years of production experience, security certification, or production readiness. The local lab explains what additional operational evidence to collect during genuine project work.

Maintainers can rebuild the source-only download after editing the lab:

```bash
python3 scripts/package-aws-lab.py
```

### Python basics (32)

- Core Python, in teaching order (`src/curriculum/beginnerPath.ts` assigns numbers and chapters): printing, comments and indentation, variables, types, expressions, operators (`//`, `%`, `+=`), strings and string methods, booleans, `if`/`elif` with `and`/`or`, lists, loops, dictionaries, functions with defaults, keyword arguments and multiple return values, local vs global scope, reading errors and the common error types, classes, inheritance, files with `pathlib` and `csv` (in the browser’s in-memory file system), and importing your own module; `foundationLessons.python.test.ts` checks every new starter fails and every intended fix meets the goal in real `python3`
- AI-shaped data basics: missing values and `None`, nested prediction records, noisy-text normalization, and assertions as tests
- Capstone: clean feedback, assign a transparent keyword label, handle empty input, and summarize label counts

### Python in depth (86)

- Idiomatic Python: comprehensions, sets, tuples, sorting, exceptions, classes, generators, dataclasses, caching, and context managers
- Engineering skills: type hints and contracts, JSONL ingestion, regex redaction, mutation-safe copying, and table-driven tests
- Runtime skills: CPython GC and memory tools, profiling, zero-copy views, the GIL, executors, locks, cancellation, C3 method resolution, properties, metaclasses, dependency injection, and dunder protocols
- Cross-language bridges: Java core, collections, concurrency, and Spring concepts modeled honestly through executable Python comparisons
- Engineering practice: Strategy, Factory, Observer, functional tools, metadata-safe decorators, pytest fixture teardown, TDD, CI/CD, incident response, corrections and gotchas, plus the data-pipeline capstone
- Interview patterns (Interview prep, lessons 21–32): stack brackets, monotonic stack, merge intervals, hash-map grouping, heap top-k, BFS shortest path, topological sort, backtracking, coin-change DP, linked-list reversal, union-find and tries — each a classic problem with its key line left as `???`; `interviewPatternLessons.python.test.ts` checks every starter fails and every intended fill meets the goal in real `python3`
- Algorithm practice (its own section): two-number sum, subsequence check, three-sum, array of products, Kadane, palindromes, run-length encoding, binary search, Dutch-flag sort, merge sort, BST validation, tree inversion and diameter, grid flood fill, directed-cycle detection, Dijkstra, staircase, no-adjacent sum, ways to make change, edit distance, 0/1 knapsack, remove kth from end, reverse Polish notation and permutations. Topics were picked from a public list of common interview questions, leaving out puzzle-style ones that rarely come up and ones the interview patterns already cover; the problems and code are written for this project. `algorithmPracticeLessons.python.test.ts` runs each in real `python3`

### Machine learning & LLMs (56) — browser-local, no API key required

- Data and classical ML: problem framing, learning paradigms and lifecycle, data-science tool roles, EDA, data quality and leakage, feature engineering, resampling, classification/regression metrics, linear scores, loss and gradients, thresholds, validation, boosting choices, framework trade-offs, and neural training simulations
- LLM internals: tokens, vocabularies, embeddings, cosine similarity, stable softmax, context budgets, top-k/top-p sampling, complete Transformer-block anatomy, and Markov-chain/PageRank contrast
- Scale and optimization: Spark map/shuffle/reduce concepts, partitions and streaming, quantization, distillation, QLoRA, cache choices, and hosted-versus-self-hosted trade-offs
- LLM application engineering: prompt contracts, structured output, chunking and metadata, hybrid retrieval with RRF, reranking, permission filters, citations, abstention, and prompt-vs-RAG-vs-fine-tune decisions
- Agentic and domain topics: ReAct/planner-executor decisions, tool-result repair, semantic layers and ontologies, GraphRAG/CAG/memory, capital-markets time-series validation, judge calibration, threat scenarios, resilience/relevance controls, PEFT techniques, and a local cited-RAG capstone

Token lists show as quiet chips and multi-stage lessons show a soft pipeline ribbon. **Run with model** can optionally call the LLM configured in Settings for one-shot comparison; there is still no chat sidebar or cloud dependency in the learning path.

### APIs & production AI (48) — service behavior simulated in plain Python

- HTTP foundations: requests, responses, status codes, routing, query/body parsing, middleware, and authentication
- Reliability: schema validation, consistent errors, idempotency, authorization, timeouts, bounded retries/backoff, per-tenant rate limits, streaming event contracts, dynamic batching, caching, and provider fallback
- Serving and MLOps: export/serve architecture, experiment evidence, retraining triggers, token/cost budgets, safe logs, traces, canary rollout, versions, rollback, evaluation gates, and drift detection
- System and agent architecture: ETL/store selection, crawler policy, Kafka and store roles, containers versus VMs, cold starts and externalized state, autoscaling, MCP contracts, the AWS agentic component map, layered agent security, NFRs/ADRs, and whiteboard drills
- Capstones: harden an AI endpoint, then integrate ingest → retrieve → generate → evaluate → harden in one local document-RAG system
- FastAPI essentials (lessons 43–48): path and query parameters, Pydantic request bodies, `HTTPException` 404/409, a CRUD resource, API-key headers (401 vs 403) and limit/offset pagination — real `fastapi` imports running on the in-browser simulator with `TestClient`; `fastapiEssentialsLessons.python.test.ts` checks every starter fails and every intended fill meets the goal against the simulator
- Support automation (lessons 49–54): the plain-Python core of an email support bot for a fictional outdoor shop — a knowledge base split from Markdown headings, guards that never answer our own mail, auto-replies, newsletters or bounces, a polling loop that labels handled mail and retries failures, triage with always-escalate rules, “the model proposes, code decides” replacement rules on a structured draft, and a golden-email eval set. Models are simulated by small deterministic functions, so no key is needed; `supportAutomationLessons.python.test.ts` runs every starter and intended fill in real `python3`
- Full-stack data (lessons 55–61): an in-memory SQLite database (`import playdb`) with four seeded practice datasets (orders, weather, students, tickets), queried with `SELECT`/`WHERE`/`GROUP BY` and served by FastAPI routes. These lessons add **Data · API · View** tabs next to Results: Data shows every table with column types and a **Shuffle data** seed control; API calls the listed routes after each run (paths are editable, `POST /path {json}` sends a body) and shows each JSON response; View charts a response as bars, a line or a table in hand-drawn SVG. `sqlite3` is loaded into Pyodide on the first full-stack run; `fullstackLessons.python.test.ts` runs every starter and fill against two seeds, and `fullstackRun.test.ts` covers the tables-plus-calls payload

No real HTTP server or third-party Python package is required for these exercises: requests, providers, registries, and deployment decisions are explicitly modeled as small simulations. Results shaped like `{"status": 200, "body": ...}` render as quiet **HTTP cards** (status + body).

The curriculum has an explicit objective-level map for all 43 chapters and 523 content blocks in the current working-tree edition of the companion study book. Framework- and platform-specific material—PyTorch/TensorFlow, Spark, JVM/Spring, ONNX/TensorRT, MCP, and AWS—is taught through clearly labeled browser-local simulations. The playground exercises the architecture and engineering decisions without pretending to launch a cluster, JVM, cloud account, or production deployment. The parity inventory and its automated checks live in `src/curriculum/studyBookCoverage.ts`.

**Live HTTPS demos (zero install):** deploy `companion/` once (Fly/Render/Docker — see [companion/README.md](./companion/README.md)), then build the playground with:

```bash
# .env or CI
VITE_COMPANION_URL=https://your-companion.example.com
npm run build
```

On **APIs & production AI**, the optional **Live API** strip talks to that HTTPS host (rate-limited demo API). **Settings → Use demo default** restores the build-time URL; **Use local** points at `http://127.0.0.1:8000`.

```bash
# local playground
npm run dev

# optional local companion (if not using the public demo URL)
cd companion && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && npm run companion
```

Also: **Import OpenAPI**, optional API key / LLM in **Settings** (localStorage only).

**Study-book practice (not a merged app):** the interactive book at `http://127.0.0.1:8765` teaches the tapes; this playground is the editor. Open `http://localhost:5173/?lesson=mid-pattern-pick` (or `api-fastapi-dispatch`) from the book’s “Practice in the playground” cards. Array patterns live under **Python in depth**; FastAPI lessons under **APIs & production AI**.

Switch learning track and lesson from the toolbar (grouped by chapter), or step with **Prev** / **Next**. The editor bar has a small **Lesson** pill with the task count; clicking it opens a popup with the goal, a short “why it matters”, and lesson-specific “How” and “Then” instructions (Esc or a click outside closes it). The current step is emphasized, the next step stays quieter, and completed guidance disappears. Each lesson also includes a concrete stretch and starter code with something left to finish. Each saved draft remembers a fingerprint of the starter it began from; when a lesson’s starter later changes, a pill above the editor offers **Use new starter** (your draft is kept as a restorable backup) or **Keep mine**. Drafts saved before fingerprints existed are never flagged. Code auto-runs as you type. Re-runs change only what is new: the last results, goal checks and task count stay on screen until the new run answers, only changed result rows and their source lines update, and “Running…” appears only for runs slower than about half a second; use `⌘/Ctrl+Enter` to run now and `Esc` to stop loops. When one source line prints several times in a row (a loop), Results frames those rows as one group with a loop badge (`line 4 · 3×`) just above the card, numbers each iteration in the gutter and separates iterations with a dashed line. Click a row (or its number) to focus that iteration and dim the rest; click again to show all.

## Outside this MVP

- Accounts, cloud save, or multi-file projects
- Installing third-party packages (`pip` / micropip UI) in the browser app
- Real uvicorn / listening ports (FastAPI syntax is **simulated** in-process; probe with `TestClient` in the editor)
- AI chat assistant, telemetry, or collaboration
- Native desktop app shell
- Cloud LLM keys / multi-file IDE

Product direction lives in [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).

## Architecture notes

| Piece | Role |
| --- | --- |
| `src/execution/python.worker.ts` | Loads Pyodide, instruments AST, runs code off the UI thread |
| `src/execution/fastapi_sim.py` | In-browser FastAPI/pydantic subset; handlers run via TestClient |
| `src/execution/PythonRunner.ts` | Main-thread worker lifecycle, debounce/timeout/Stop/Call |
| `src/execution/protocol.ts` | Typed messages between UI and worker |
| `src/examples.ts` | Core lessons plus the assembled curriculum catalog, context, goals, and checks |
| `src/curriculum/*` | Expanded lesson modules plus the tested 43-chapter study-book coverage manifest |
| `src/lessonInstructions.ts` | Actionable instructions for each lesson task |
| `src/components/*` | Editor, results, lesson goal, toolbar |

Stop and timeout always `terminate()` the worker and spawn a fresh one so infinite loops cannot freeze the page.
