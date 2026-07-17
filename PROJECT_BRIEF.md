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

## Browser-first MVP

Build a responsive single-page application with:

- A refined two-pane layout: Python editor on the left, live results on the right.
- Automatic execution after a short debounce, plus visible Run and Stop controls.
- Captured `print()` output, warnings, exceptions, and the value of top-level expressions.
- Output associated with source lines when practical, similar to RunJS.
- Clear states for loading Python, running, success, timeout, and error.
- A safe reset after infinite loops, crashes, or stale execution.
- A small set of useful examples accessible without becoming a dashboard.
- Excellent light and dark themes, typography, spacing, keyboard focus, and responsive behavior.
- No account, backend, telemetry, AI assistant, package manager, or file tree in the first release.

## Suggested technical direction

- React + TypeScript + Vite.
- Monaco Editor or CodeMirror 6, selected after testing which better supports the intended minimal visual treatment.
- Pyodide running inside a dedicated Web Worker so execution cannot freeze the interface.
- An execution protocol that captures stdout/stderr and returns structured result events.
- Python AST instrumentation for displaying values of top-level expression statements without requiring `print()`.
- Worker termination and recreation for Stop and timeout behavior.
- Browser-local execution only for the MVP; do not introduce a server unless a demonstrated requirement demands it.

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

