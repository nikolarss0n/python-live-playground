# Learning improvements roadmap

Quiet, RunJS-like visual and interaction upgrades.

## Done

### Python learning
- [x] Lessons (beginner 16 + intermediate 14), goals, tasks, blanks, hints
- [x] Visual collections, type chips, run pulse, path ribbons
- [x] Error mini lesson, connectors, first-run coaching
- [x] Task progress, keyboard shortcuts, predict, loop scrub, lesson map
- [x] Line-aligned results, Previous ghost, diff underlines, share URL
- [x] Chapters, stretch, wrong-vs-fix

### AI foundations (8) — browser-local
- [x] Tokens / bag-of-words / vocab / vectors / cosine / prompts / JSON / pipeline
- [x] Token chips + pipeline strip

### Web APIs (8) — browser-local FastAPI mental model
- [x] Request/response, status, routing, query, body, middleware, mini app
- [x] HTTP response cards
- [x] Optional FastAPI companion (`companion/`) + Local API strip

### Settings
- [x] Toolbar **Settings** — API key, companion URL, optional LLM base/model
- [x] Companion optional `PLP_API_KEY` auth
- [x] Quiet LLM test (OpenAI-compatible, no chat sidebar)

## Left to do

| Priority | Item | Notes |
|----------|------|--------|
| Optional | **Richer LLM in lessons** | e.g. “Run with model” on prompt template lesson using Settings key |
| Optional | **OpenAPI import** | Snippets from companion `/openapi.json` |
| Optional | **Auth lesson** | JWT/header soft goal (dict and/or companion) |
| Polish | **More compare pairs** | Only some repair labs |
| Polish | **More predict prompts** | Only printing has one |
| Polish | **Narrow-width alignment** | Wide-only by design |
| Product | **Deploy companion** | Not needed for static SPA |

The playground remains useful **without** companion, key, or LLM.
