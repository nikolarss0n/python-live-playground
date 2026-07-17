# Project instructions

Read `PROJECT_BRIEF.md` before planning or changing the application.

This is a focused product prototype, not a general-purpose IDE. Preserve the quiet RunJS-like experience and resist adding panels, accounts, AI features, project management, or backend infrastructure to the MVP.

Before implementation, inspect the current RunJS live playground in the in-app browser and capture the relevant desktop reference state. Use it to guide layout, density, typography, result placement, and interaction polish. Recreate the experience for Python without copying RunJS branding or proprietary assets.

Prefer a browser-local architecture. Keep Python execution off the main UI thread, define a typed message protocol between the interface and runner, and ensure Stop/timeout reliably replaces the worker. Treat untrusted Python execution as a security boundary even in a local prototype.

Use accessible semantic controls, visible keyboard focus, sufficient contrast, and reduced-motion support. Verify the result visually at desktop and narrow widths. Add focused tests for the execution behavior and the primary beginner flow.

Keep `README.md` current with setup, run, test, and build commands as soon as the application is scaffolded.
