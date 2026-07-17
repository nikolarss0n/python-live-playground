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

- Two-pane layout: Python editor + live results
- Automatic execution after a short typing pause, plus **Run** and **Stop**
- Captured `print()` output and top-level expression values
- Friendly error messages with optional full traceback
- Timeout (5s) and Stop that terminate and recreate the worker
- Small example menu (hello, variables, loops, errors, infinite loop)
- Light and dark themes, keyboard-focus styles, reduced-motion support
- Responsive layout for desktop and narrow widths

## Outside this MVP

- Accounts, cloud save, or multi-file projects
- Installing third-party packages (`pip` / micropip UI)
- AI assistant, telemetry, or collaboration
- Native desktop app shell

Product direction lives in [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).

## Architecture notes

| Piece | Role |
| --- | --- |
| `src/execution/python.worker.ts` | Loads Pyodide, instruments AST, runs code off the UI thread |
| `src/execution/PythonRunner.ts` | Main-thread worker lifecycle, debounce/timeout/Stop |
| `src/execution/protocol.ts` | Typed messages between UI and worker |
| `src/components/*` | Editor, results, toolbar |

Stop and timeout always `terminate()` the worker and spawn a fresh one so infinite loops cannot freeze the page.
