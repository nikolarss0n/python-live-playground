# Python Live companion — local or public HTTPS demo

Tiny FastAPI app for the **Web APIs** track. The playground itself stays static; this is only for **real HTTP**.

## Zero-install (public HTTPS)

Deploy this folder once, then set the playground build env:

```bash
# after deploy, e.g. https://python-live-companion.fly.dev
VITE_COMPANION_URL=https://YOUR-APP.fly.dev
```

Learners open the playground → **Web APIs** → **Live API** strip works with **no Python install**.

### Deploy options

**Fly.io** (recommended — free tier, force HTTPS):

```bash
cd companion
fly launch --config fly.toml   # or fly launch and pick Dockerfile
fly secrets set CORS_ORIGIN_REGEX='https://([a-z0-9-]+\.)*(github\.io|pages\.dev|vercel\.app|netlify\.app)'
# If you know exact origins:
# fly secrets set CORS_ORIGINS=https://you.github.io,https://you.github.io/python-live-playground
fly deploy
```

**Render:** Dashboard → New → Blueprint → `companion/render.yaml` (set `CORS_ORIGINS` for your playground URL).

**Docker locally (HTTPS via tunnel if needed):**

```bash
cd companion
docker build -t plp-companion .
docker run --rm -p 8000:8000 -e PLP_DEMO_MODE=1 plp-companion
```

### Production env

| Variable | Purpose |
|----------|---------|
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `CORS_ORIGIN_REGEX` | Regex for GitHub Pages / Vercel / Netlify |
| `RATE_LIMIT_PER_MINUTE` | Default `90` per IP |
| `PLP_API_KEY` | Optional; leave empty for public demos |
| `PLP_DEMO_MODE` | Default on; tags `/health` as demo |

## Local development

```bash
cd companion
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or from repo root: `npm run companion`.

In the playground **Settings** → **Use local** (`http://127.0.0.1:8000`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/hello` | Simple JSON |
| GET | `/greet?name=` | Query param |
| GET | `/items/{id}` | Path param (`a1` exists) |
| POST | `/users` | JSON body `{"name":"Ada"}` |
| GET | `/me` | Whether a key was sent |
| GET | `/docs` | OpenAPI UI |
| GET | `/openapi.json` | Spec for **Import OpenAPI** |
