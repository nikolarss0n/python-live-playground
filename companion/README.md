# Python Live — optional FastAPI companion

The main app runs **entirely in the browser**. This folder is optional: a tiny real HTTP server that matches the Web APIs lesson shapes.

## Run

```bash
cd companion
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional: require the same key you put in playground Settings
export PLP_API_KEY=dev-secret

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or from the repo root (after the venv is active and deps installed):

```bash
npm run companion
```

- Docs: http://127.0.0.1:8000/docs  
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json  
- Playground: http://127.0.0.1:5173 → **Web APIs** → **Local API** → **Import OpenAPI**  
- **Settings** (toolbar): companion base URL + API key

## Auth

| `PLP_API_KEY` env | Behavior |
|-------------------|----------|
| unset / empty | Open (no key needed) |
| set (e.g. `dev-secret`) | Requests need `X-API-Key` or `Authorization: Bearer …` |

Put the same value in playground **Settings → API key**.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness (+ `auth_required` flag) |
| GET | `/hello` | Simple JSON |
| GET | `/greet?name=` | Query param |
| GET | `/items/{id}` | Path param (`a1` exists) |
| POST | `/users` | JSON body `{"name":"Ada"}` |
| GET | `/me` | Whether a key was sent (`authenticated`) |

CORS allows Vite dev origins only.
