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
- Beginner + intermediate **lessons** (goals, `???` blanks, Next / stuck hints)
- Light and dark themes, keyboard shortcuts (`⌘/Ctrl+Enter`, `Esc`, `?`)
- Responsive layout for desktop and narrow widths

Learning polish roadmap: [IMPROVEMENTS.md](./IMPROVEMENTS.md).

## Lessons (topics)

### Beginner (16)

1. Printing · 2. Variables · 3. Types · 4. Expressions · 5. Strings · 6. Booleans  
7. If decisions · 8. Lists · 9. For loops · 10. While loops · 11. Dictionaries  
12. Functions · 13. Reading errors · 14. Python for-loops · 15. Infinite loops · 16. Capstone

### Intermediate (14)

1. Enumerate & zip · 2. Nested loops · 3. List methods · 4. Comprehensions  
5. Dict loops · 6. Sets · 7. Tuples · 8. Function defaults · 9. Sorting  
10. Try / except · 11. Classes · 12. Math & random · 13. JSON · 14. Capstone

### AI foundations (8) — browser-local, no API keys

1. Tokens · 2. Bag of words · 3. Vocabulary ids · 4. Dot product  
5. Cosine similarity · 6. Prompt templates · 7. JSON contracts · 8. Mini pipeline

Token lists show as quiet chips; AI lessons include a soft pipeline ribbon (tokenize → count → decide, etc.). Still no chat sidebar or cloud models.

### Web APIs (8) — FastAPI-shaped thinking, still in-browser

1. Request dict · 2. Response dict · 3. Status codes · 4. Routing  
5. Query params · 6. JSON body · 7. Middleware · 8. Mini app

No real HTTP server required: you model requests/responses as Python dicts. Results shaped like `{"status": 200, "body": ...}` render as quiet **HTTP cards** (status + body).

**Optional real server:** see [companion/README.md](./companion/README.md). On the Web APIs track a **Local API** strip can probe `http://127.0.0.1:8000` when uvicorn is running.

```bash
# terminal A
npm run dev

# terminal B (optional)
cd companion && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm run companion   # or: uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Switch difficulty and lesson from the toolbar (grouped by chapter). Each lesson has a goal strip, soft tasks, optional stretch, and starter code with something left to finish. **Share** copies a URL that restores the lesson and your code (no account).

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
| `src/examples.ts` | Beginner + intermediate lessons, goals, checks |
| `src/components/*` | Editor, results, lesson goal, toolbar |

Stop and timeout always `terminate()` the worker and spawn a fresh one so infinite loops cannot freeze the page.
