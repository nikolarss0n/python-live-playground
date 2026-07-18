# Learning improvements roadmap

Quiet, RunJS-like visual and interaction upgrades.

## Done

### Core playground + curriculum
- [x] Four tracks with predict + compare on every lesson
- [x] Live results UX, Settings, Run with model, share URL
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
