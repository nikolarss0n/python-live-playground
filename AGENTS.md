# Project instructions

Read `PROJECT_BRIEF.md` before planning or changing the application.

This is a focused, calm Python learning environment and scratchpad, not a general-purpose IDE. Preserve the quiet RunJS-like default experience: keep the plain editor uncluttered, keep learning sections opt-in behind Settings switches, and resist adding accounts, cloud backend infrastructure, telemetry, or unnecessary chrome.

Keep RunJS's layout, density, typography, result placement, and interaction polish as the visual bar without copying RunJS branding or proprietary assets.

Keep execution browser-local (including inside the offline macOS `WKWebView` shell). Run Python off the main UI thread in a dedicated Web Worker, validate every worker message at the boundary, and ensure Stop/timeout reliably replaces the worker. Treat untrusted Python execution and shared links as a security boundary.

Treat `src/execution/fastapi_sim.py` as a **frozen teaching subset**, not a full FastAPI/Pydantic v2 reimplementation. Prefer raising a clear `SimFastAPIError` for unsupported APIs over expanding framework surface area; use `npm run verify:fastapi-parity` as a regression guard for the supported subset.

Use accessible semantic controls, visible keyboard focus, sufficient contrast, and reduced-motion support. Verify UI changes visually at desktop and narrow widths. Add focused tests for execution behavior and primary user flows.

Keep `README.md` current with setup, run, test, and build commands, and commit completed work in clean, logical slices.
