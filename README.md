# Python Live

A calm, beginner-friendly Python scratchpad inspired by the interaction quality of [RunJS](https://runjs.app/play): write Python on the left and see results on the right as you type.

Runs entirely in the browser (Pyodide in a Web Worker). No account, no backend, no package manager.

## Requirements

- Node.js 20+ (22 recommended)
- npm 10+

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
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Build

```bash
npm run build
npm run preview
```

## What this MVP includes

- Two-pane layout: Python editor + live results aligned beside source lines (wide), hover path ribbons + var chips
- Automatic execution after a short typing pause, plus **Run** and **Stop**
- Captured `print()` output, top-level expression values, and expandable collections
- Quiet type chips (`int`, `str`, `list`, …) and soft goal / task progress
- Friendly error cards with always-visible “what to fix” + optional full explanation
- Soft loop timeout + hard Stop that terminates and recreates the worker
- 61 guided **lessons** across Python, AI foundations, and Web APIs (goals, why-it-matters context, `???` blanks, step-by-step task instructions, Next / stuck hints)
- Light and dark themes, keyboard shortcuts (`⌘/Ctrl+Enter`, `Esc`, `?`)
- Responsive layout for desktop and narrow widths

Learning polish roadmap: [IMPROVEMENTS.md](./IMPROVEMENTS.md).

## Lessons (topics)

### Beginner (16)

1. Printing · 2. Variables · 3. Types · 4. Expressions · 5. Strings · 6. Booleans  
7. If decisions · 8. Lists · 9. For loops · 10. While loops · 11. Dictionaries  
12. Functions · 13. Reading errors · 14. Python for-loops · 15. Infinite loops · 16. Capstone

### Intermediate (20)

1. Enumerate & zip · 2. Nested loops · 3. List methods · 4. Comprehensions
5. Dict loops · 6. Sets · 7. Tuples · 8. Function defaults · 9. Sorting
10. Try / except · 11. Classes · 12. Math & random · 13. JSON · 14. Capstone
15. Counter & defaultdict · 16. Generators · 17. Priority queues
18. Dataclasses · 19. Decorators & cache · 20. Context managers

### AI foundations (16) — browser-local, no API keys

1. Tokens · 2. Bag of words · 3. Vocabulary ids · 4. Dot product
5. Cosine similarity · 6. Prompt templates · 7. JSON contracts · 8. Mini pipeline
9. Softmax & temperature · 10. Train, validation & test · 11. Precision, recall & F1
12. Next-token generation · 13. Attention & causal masks · 14. Retrieval & top-k
15. Evals & regressions · 16. Safe tool calls

The expanded topics draw from the companion study book’s Python engineering, ML fundamentals, LLM internals, RAG, evals, and agent-safety chapters. Token lists show as quiet chips; AI lessons include a soft pipeline ribbon (tokenize → count → decide, etc.). Still no chat sidebar or cloud models.

### Web APIs (9) — FastAPI-shaped thinking, still in-browser

1. Request dict · 2. Response dict · 3. Status codes · 4. Routing  
5. Query params · 6. JSON body · 7. Middleware · 8. Mini app · 9. Auth header

No real HTTP server required: you model requests/responses as Python dicts. Results shaped like `{"status": 200, "body": ...}` render as quiet **HTTP cards** (status + body).

On **AI foundations** lessons, **Run with model** can call your Settings LLM (one-shot; no chat sidebar). It prefers your longest printed result, or a lesson default prompt if you have not printed yet.

**Live HTTPS demos (zero install):** deploy `companion/` once (Fly/Render/Docker — see [companion/README.md](./companion/README.md)), then build the playground with:

```bash
# .env or CI
VITE_COMPANION_URL=https://your-companion.example.com
npm run build
```

On **Web APIs**, the **Live API** strip talks to that HTTPS host (rate-limited demo API). **Settings → Use demo default** restores the build-time URL; **Use local** points at `http://127.0.0.1:8000`.

```bash
# local playground
npm run dev

# optional local companion (if not using the public demo URL)
cd companion && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && npm run companion
```

Also: **Import OpenAPI**, optional API key / LLM in **Settings** (localStorage only).

Switch difficulty and lesson from the toolbar (grouped by chapter), or step with **Prev** / **Next**. Each lesson has a detailed goal strip with a short “why it matters” plus lesson-specific “How” and “Then” instructions. The current step is emphasized, the next step stays quieter, and completed guidance disappears. Each lesson also includes an optional stretch and starter code with something left to finish. Code auto-runs as you type; use `⌘/Ctrl+Enter` to run now and `Esc` to stop loops.

## Outside this MVP

- Accounts, cloud save, or multi-file projects
- Installing third-party packages (`pip` / micropip UI) in the browser app
- AI chat assistant, telemetry, or collaboration
- Native desktop app shell
- Cloud LLM keys / multi-file IDE

Product direction lives in [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).

## Architecture notes

| Piece | Role |
| --- | --- |
| `src/execution/python.worker.ts` | Loads Pyodide, instruments AST, runs code off the UI thread |
| `src/execution/PythonRunner.ts` | Main-thread worker lifecycle, debounce/timeout/Stop |
| `src/execution/protocol.ts` | Typed messages between UI and worker |
| `src/examples.ts` | Python, AI, and Web API lessons, context, goals, checks |
| `src/lessonInstructions.ts` | Actionable instructions for each lesson task |
| `src/components/*` | Editor, results, lesson goal, toolbar |

Stop and timeout always `terminate()` the worker and spawn a fresh one so infinite loops cannot freeze the page.
