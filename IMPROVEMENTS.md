# Learning improvements roadmap

Quiet, RunJS-like visual and interaction upgrades.

## Done

### Core playground + curriculum
- [x] Beginner (16) · Intermediate (14) · AI foundations (8) · Web APIs (9)
- [x] Goals, tasks, blanks, hints, chapters, stretch, wrong-vs-fix, share URL
- [x] Collections, type chips, alignment, previous ghost, path ribbons, pulse
- [x] Settings (API key, companion URL, optional LLM test)
- [x] FastAPI companion + Local API strip + optional `PLP_API_KEY`
- [x] **Run with model** on AI prompt-template lesson (one-shot, no chat UI)
- [x] **Auth header** Web API lesson + companion `GET /me`
- [x] Extra predict prompts (variables, API request, auth)

## Left to do

| Priority | Item | Notes |
|----------|------|--------|
| Optional | **OpenAPI import** | Snippets from companion `/openapi.json` |
| Optional | **More lessons with runWithModel** | Flag is generic; only prompt-template uses it |
| Polish | **More compare pairs** | Still sparse outside repair labs |
| Polish | **More predict prompts** | A few lessons only |
| Polish | **Narrow-width alignment** | Wide-only by design |
| Product | **Deploy companion** | Not needed for static SPA |

The playground remains useful **without** companion, key, or LLM.
