# Python Live — optional FastAPI companion

The main app runs **entirely in the browser**. This folder is optional: a tiny real HTTP server that matches the Web APIs lesson shapes so you can feel network requests after learning with dicts.

## Run

```bash
cd companion
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open interactive docs: http://127.0.0.1:8000/docs

Keep the playground on http://127.0.0.1:5173 and switch to **Web APIs**. Use the **Local API** strip to probe `/health`, `/hello`, and friends.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/hello` | Simple JSON |
| GET | `/greet?name=` | Query param |
| GET | `/items/{id}` | Path param (`a1` exists) |
| POST | `/users` | JSON body `{"name":"Ada"}` |

CORS allows the Vite dev origins only.
