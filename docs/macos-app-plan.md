# macOS app plan

Status: phase 1 spike passed and phase 2 native shell built (2026-11-16). The app requires macOS 27 (decided 2026-11-16).

## Decision

Ship the playground as a native SwiftUI app that hosts the existing web app in a `WKWebView`. This is option 3 from the VS Code discussion: no editor fork, keep everything we have.

We chose a Swift shell over Tauri. Apple's Foundation Models framework is a Swift API, and it is the main reason to be a Mac app at all. Tauri would need a custom Swift plugin to reach it, so it gives us a smaller benefit for more glue.

## What changed on the platform (WWDC26, macOS 27)

- **Foundation Models** is Apple's on-device model, with Private Cloud Compute for larger requests. It does guided generation into Swift types, so a "pinpoint" answer comes back as a typed value rather than parsed text.
- **Provider protocol:** one `LanguageModel` protocol now covers Apple's models and cloud models such as Claude, so the provider can be swapped without changing the feature code.
- **Free cloud tier:** small developers (Small Business Program, under 2M first-time downloads) get Apple's next-generation models on Private Cloud Compute at no API cost. This could replace the paid TypeSafe/Jev key for most learners.
- **Evaluations framework:** a way to test AI features across many inputs, which fits our existing error fixtures.
- **`fm` CLI and Python SDK:** these come with macOS 27 and are useful for evaluation scripts, not for the app itself.
- **Swift 6.4** (Sept 2026) makes Swift Build the default build system and adds Subprocess 1.0.

Apple announced that it will open-source the framework, but treat that as a promise rather than something already released.

## Architecture

```
SwiftUI app (menus, windows, files, settings, AI)
 └─ WKWebView  ← the existing React + CodeMirror build, served from the app bundle
     └─ Web Worker → Pyodide (Python runs here, never in Swift)
```

- **Serving:** serve the built `dist/` through a custom URL scheme handler (`app://`), not `file://`. Workers, wasm and module scripts need a real origin. The handler also sets COOP/COEP headers if we need `SharedArrayBuffer`.
- **Execution:** keep Pyodide in a worker. Stop/timeout still terminates and replaces the worker. Learner code never gets a real `subprocess` or filesystem access. This keeps the current security boundary, and the app also runs under App Sandbox.
- **Bridge:** a typed message protocol between web and Swift using `WKScriptMessageHandlerWithReply`. Messages are versioned, with TypeScript types mirrored by `Codable` structs and one test that both sides agree on.
  - `ai.pinpoint(code, error) -> {line, from, to, mistake, message, confidence}`
  - `ai.judgeGoal(code, output, criteria) -> {id: met|not_met, confidence}[]`
  - `file.open / file.save / file.recent`
  - `app.theme`, `app.openURL`
- **AI layer:** in Swift, define `@Generable` types that match today's `pinpoint.ts` and `goalJudge.ts` answers. The web app picks the backend in this order:
  1. On-device or Apple Private Cloud Compute (Mac app).
  2. Existing `/api/jev` (web build).
  3. Local `diagnose.ts` only (offline or off).
  The UI already labels these answers "AI", so nothing visible changes.

## Phases

1. **Spike (go/no-go).** A SwiftUI window loads `dist/` over `app://`. Prove four things in `WKWebView`:
   - Pyodide loads offline.
   - A run prints results.
   - Stop kills an infinite loop.
   - Results, lessons and the problem chip render as they do in Safari.
   - **Result (2026-11-16): go.** `npm run test:mac` passes in the sandboxed, ad-hoc-signed app with every http(s) load blocked:
     - Pyodide and `sqlite3` load from the bundle; the first run takes about 1.2 s, including Pyodide start-up.
     - Stop ends an endless loop in about 0.1 s, and the next run on the new worker takes about 0.9 s.
     - Line numbers line up with their code lines.
   - **Findings:**
     - App Sandbox needs `com.apple.security.network.client`, or WebKit's networking process never starts and nothing loads.
     - A window covered by other apps is reported hidden, so WebKit slows timers and skips layout passes. CodeMirror then left line numbers 20 px off until the next edit. Fixed in the web app: `src/editor/remeasureOnShow.ts` re-measures when the page is shown.
     - The page has no cross-origin isolation (`crossOriginIsolated: false`). We don't need it today, because nothing uses `SharedArrayBuffer`.
     - Links to http(s) pages are not yet sent to the default browser. That is phase 2 work, together with blocking web loads inside the app view.
2. **Native shell.**
   - Mac features: a menu bar with Run, Stop, lessons and share; open and save `.py` documents; recent files; window restoration.
   - Look and feel: follows the system light/dark setting, and uses native toolbar styling where it doesn't add panels.
   - Offline: Pyodide and packages ship in the bundle, so the first run needs no network.
   - **Built (2026-11-16):**
     - The shell moved from SwiftUI to the AppKit lifecycle, for full control of the menus.
     - Menus: File (Open, Open Recent with security-scoped bookmarks, Save, Save As), Edit, Run (⌘↩, ⌘.), and View with int-ai-m's Background Transparency slider over a behind-window blur.
     - Finder can open `.py` files in the app.
     - Web links open in the default browser, and web loads are blocked in the app view.
   - **Found while building:** ⌘S right after typing saved the code from before the last keystroke, because React's code state lags the editor. `getCode` now reads the editor.
   - **Not done yet:**
     - An unsaved-changes dot: the page autosaves to the device, so nothing is lost, but the title doesn't show edits.
     - Share links copied in the app point at `app://local` and only open inside the app.
     - A real-window screenshot of the blur: the terminal has no Screen Recording permission, so the blur has only been checked by eye.
3. **AI on Foundation Models.**
   - Port pinpoint and goal-judge prompts to guided generation.
   - Run them against `src/jev/__fixtures__/python-errors.json` and the lesson goals with the Evaluations framework.
   - Ship only if accuracy is at least what TypeSafe scores on the same set.
4. **Distribution.** App Sandbox, hardened runtime and notarization, then the Mac App Store, joining the Small Business Program for the free cloud tier. A signed direct download is the fallback.

## Repo layout

- `macos/`: a Swift package (SwiftUI app target). `scripts/build-mac.sh` wraps the binary into a `.app` with an Info.plist, so no generated Xcode project is checked in. `open macos/Package.swift` opens it in Xcode.
- The web app stays the single source of UI. `npm run build:mac` builds `dist/` with a `mac` flag and copies it into the app bundle.
- `README.md` gets the Mac build, run and test commands when phase 1 lands.

## Risks and open questions

- **Model quality:** the on-device model may be weaker than TypeSafe at locating code mistakes. Phase 3's evaluation decides this, and Claude through the provider protocol is the fallback.
- **OS floor:** decided: macOS 27 is the minimum (`LSMinimumSystemVersion` 27.0), so the new Foundation Models features need no fallback path.
- **Apple silicon only:** Apple Intelligence needs M1 or later. Intel Macs fall back to local diagnosis.
- **WKWebView differences:** Pyodide memory limits and worker termination behaviour need checking in the spike, beyond what we have measured in Chromium and Firefox.
- **Product scope:** the Mac app must stay the same quiet playground, with no accounts, project panels or chat window.

## Sources

- [WWDC26 macOS guide](https://developer.apple.com/wwdc26/guides/macos/)
- [What's new in Foundation Models (WWDC26)](https://developer.apple.com/videos/play/wwdc2026/241/)
- [fm CLI and Python SDK (WWDC26)](https://developer.apple.com/videos/play/wwdc2026/334/)
- [Swift 6.4 coverage, InfoQ](https://www.infoq.com/news/2026/09/swift-6-4-released/)
