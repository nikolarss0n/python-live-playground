# Learning improvements roadmap

Quiet, RunJS-like visual and interaction upgrades.

## Done

### Python fluency refresher
- [x] Fourteen days with recall, syntax explanation, guided practice, independent code, and mistake review
- [x] Two timed mock interviews, local unseen-variant tracking, minute-30 requirement changes, and frozen submissions
- [x] Mistake log, recoverable restarts, and two-function personal consolidation
- [x] Standalone local Python/pytest/files/asyncio practice pack without AWS dependencies

### Core playground + curriculum
- [x] Four tracks with predict + compare on every lesson
- [x] 160-lesson AI Engineer path with every objective in all 43 study-book chapters mapped to a direct exercise or an honest browser-local simulation
- [x] Lesson-specific “How” guidance for the current unfinished task
- [x] Live results UX, Settings, Run with model, optional share-URL restore
- [x] Toolbar Prev/Next lesson navigation (auto-run; keyboard Run/Stop)
- [x] Three connected service exercises: Python validation, a simulated FastAPI endpoint, and behavior-checked request tests
- [x] Local per-lesson drafts, completion tied to verified source, and resume across lessons, tracks, and reloads
- [x] Ten behavior-checked Python for GenAI exercises, plus a separate offline-first AWS/pytest/LangChain lab
- [x] Quiet lesson coach under Results (structured context, multi-turn, Settings LLM)
- [x] FastAPI companion (local + **public HTTPS demo** ready)
- [x] `VITE_COMPANION_URL` for zero-install demos
- [x] Deploy configs: `companion/Dockerfile`, `fly.toml`, `render.yaml`

## Left to do (ops — you deploy once)

| Step | Action |
|------|--------|
| 1 | `cd companion && fly launch` / Render Blueprint / any Docker host |
| 2 | Set `CORS_ORIGINS` or `CORS_ORIGIN_REGEX` for your playground origin |
| 3 | Build SPA with `VITE_COMPANION_URL=https://…` |
| 4 | Host SPA (GitHub Pages / Netlify / Vercel) |

Optional: hosted LLM proxy (CORS for browsers); not required if providers allow browser keys.
