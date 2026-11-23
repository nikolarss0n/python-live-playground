# Product brief: Python Live Playground

## Purpose

Create a beautiful Python learning environment with the immediacy and simplicity of RunJS. It should let a complete beginner experiment without first understanding terminals, project configuration, packages, or virtual environments.

Reference experience:

- RunJS product: https://runjs.app/
- RunJS live playground: https://runjs.app/play

RunJS is the interaction and visual-quality reference, not a source of branding or assets to copy.

## Primary user

A complete programming beginner learning Python from a guided study book.

## Experience principles

1. Code is the main event. Keep navigation and chrome nearly invisible.
2. Feedback feels immediate. Run code automatically after a short typing pause.
3. Results are easy to connect to the code that produced them.
4. Errors teach rather than punish. Show a short, friendly explanation with the original traceback available.
5. The first screen is already useful. Open with a tiny editable example and its result.
6. Advanced controls stay out of sight until they are needed.

## Current product scope

- **Plain editor first:** Opens as a calm two-pane Python scratchpad (editor on the left, live results aligned beside source lines on the right). All guided learning tracks are opt-in switches under **Settings › Learning** (off by default) so the first screen stays quiet.
- **Immediate browser-local execution:** Automatic run after a short typing pause, plus Run (`⌘/Ctrl+Enter`) and Stop (`Esc`), captured `print()` output, warnings, exceptions, top-level expression values, collection cards, loop round grouping, and branch labels.
- **Safe worker isolation:** Pyodide runs in a dedicated Web Worker with a strict CSP, field-by-field message validation, untrusted shared-link gating, and worker termination/recreation on Stop and timeout.
- **Opt-in guided curriculum:** Self-paced Python, ML/LLM, AI services, interview refresher, and algorithm tracks stored locally in the browser, with local error diagnosis and optional user-configured AI hints (never automatic, disabled during mocks/independent stages).
- **Local multi-file Projects:** Browser-local multi-file editing (`Projects` mode) with real module imports, fresh worker filesystem per run, and resizable panes.
- **Prepared API requests & frozen FastAPI simulator:** Single-file Playground and full-stack lessons expose `Data · API · View` tabs backed by in-memory SQLite (`playdb`) and a **frozen teaching subset** of FastAPI/Pydantic (`src/execution/fastapi_sim.py`). Prepared requests populate path, query, header, and JSON body inputs from handler signatures, highlight 422 refusals, and link 500 crashes to source lines.
- **Offline macOS app (`py.app`):** Native AppKit/`WKWebView` shell bundling the web app and Pyodide offline with native File open/save, frosted window transparency, and zero outbound web access from the editor window.

## Technical direction & boundaries

- React + TypeScript + Vite + CodeMirror 6 + Pyodide in a dedicated Web Worker, plus the Swift/AppKit macOS host in `macos/`.
- **FastAPI simulator freeze:** `src/execution/fastapi_sim.py` is intentionally a bounded teaching subset, not a full FastAPI or Pydantic v2 clone. Unsupported APIs should raise a clear `SimFastAPIError`. `npm run verify:fastapi-parity` acts as a regression guard for the supported subset, not a roadmap to emulate every framework feature.
- **Out of scope:** Accounts, cloud sync, telemetry, a browser package-manager UI (`pip`/`micropip`), real listening servers (`uvicorn`), bundled cloud LLM keys, or general-purpose IDE clutter.
- **Open product decision:** Decide later whether multi-file **Projects** (`ProjectPlayground`) should also gain the `API` tab (including multi-file crash-line links) or stay focused on script/module execution.

## Visual target

Preserve the qualities that make RunJS appealing:

- generous whitespace;
- restrained color;
- crisp typography;
- a nearly borderless split view;
- code and results aligned as one continuous reading surface;
- subtle controls and status indicators;
- motion used only to communicate execution state.

The result should feel designed for curious beginners, not like a conventional IDE with features removed.

## Definition of done for the first task

- The app installs and starts with documented commands.
- Editing Python produces live output without manually pressing Run.
- `print()`, expression values, syntax errors, runtime errors, multiline programs, and infinite-loop cancellation are demonstrated.
- The page is visually checked at desktop and narrow widths against captured RunJS reference screenshots.
- Relevant automated tests pass.
- The README explains how to run the app and what remains outside the MVP.

