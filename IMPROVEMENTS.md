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
- [x] **Optional FastAPI companion** (`companion/`) + in-app Local API strip

## Left to do

| Priority | Item | Notes |
|----------|------|--------|
| Optional | **Live LLM sandbox** | User-supplied API key; stay no-chat-sidebar if ever built |
| Optional | **Richer OpenAPI import** | Generate lesson snippets from companion `/openapi.json` |
| Optional | **Auth lesson** (JWT header soft goal) | Could be pure dict or companion route |
| Polish | **More compare pairs** on remaining lessons | Only repair labs have wrong-vs-fix today |
| Polish | **Predict prompts** on more lessons | Only printing has one |
| Polish | **Narrow-width alignment** | Line-align is wide-only by design |
| Product | **Deploy companion** | Not needed for static hosting of the SPA |

The playground remains useful **without** the companion or any server.
