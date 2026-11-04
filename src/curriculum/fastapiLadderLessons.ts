import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * FastAPI lessons 1-6, the first endpoints: health check, path and query parameters, a JSON body, 404s and async
 * routes. These fill single blanks; from lesson 7 (fastapiBuildLessons.ts) the learner writes the code.
 */
const fastapi = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>) =>
  practice({ ...spec, difficulty: 'fastapi', chapter: 'FastAPI', bookChapter: 'fastapi' })

export const FASTAPI_LADDER_LESSON_DRAFTS: LessonDraft[] = [
  fastapi({
    id: 'fastapi-health',
    number: 1,
    topic: 'Your first endpoint: /health',
    pipeline: ['create the app', 'register GET /health', 'return a dict', 'FastAPI sends JSON'],
    goal: 'Register GET /health so it returns {"status": "ok"} with status 200, and see that a path nobody registered answers 404.',
    why:
      'Every service starts with a health check: load balancers and uptime monitors call it to ask "are you alive?". It is also the smallest possible endpoint: one decorator, one function, one dict.',
    tasks: [
      'Put the path /health in the decorator',
      'Return "ok" as the status',
      'Run and compare the 200 and 404 lines',
    ],
    code: `# FastAPI — your first endpoint
# @app.get(path) registers the function below it for GET requests to that path.
# The dict the function returns is sent back to the caller as JSON.
# TestClient calls the app directly, the way a browser or curl would over HTTP.
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get(???)
def health():
    return {"status": ???}

client = TestClient(app)
response = client.get("/health")
print("GET /health", response.status_code, response.json())

missing = client.get("/healthz")
print("GET /healthz", missing.status_code, missing.json())
`,
    codeIncludes: ['def health'],
    printPatterns: [
      "^GET /health 200 \\{'status': 'ok'\\}$",
      "^GET /healthz 404 \\{'detail': 'Not Found'\\}$",
    ],
    hints: [
      'The path is a string that starts with a slash: "/health".',
      'The status value is the string "ok".',
    ],
    predict: {
      prompt: 'Nothing is registered for GET /healthz. What status comes back?',
      answer: '404 Not Found',
      distractors: ['500 Internal Server Error', '200 with an empty body'],
    },
    compare: {
      note: 'The decorator, not the function name, decides the URL.',
      wrong: '@app.get("health")\ndef status(): ...',
      fixed: '@app.get("/health")\ndef health(): ...',
    },
    stretch: 'Stretch: add GET /version that returns {"version": "1.0"} and call it with the client.',
  }),
  fastapi({
    id: 'fastapi-hello-path',
    number: 2,
    topic: 'Path parameters: /hello/{name}',
    pipeline: ['match /hello/{name}', 'pass name to the function', 'build the message', 'return JSON'],
    goal: 'Make GET /hello/{name} greet whoever is in the URL, so /hello/Ada and /hello/Grace answer 200 and plain /hello answers 404.',
    why:
      'Most URLs carry an id or a name: /users/42, /orders/A17. Curly braces in the path capture that part of the URL and hand it to your function as an argument with the same name.',
    tasks: [
      'Capture the name in the path with curly braces',
      'Add a name parameter to the function',
      'Run and check all three lines',
    ],
    code: `# FastAPI — path parameters
# {name} in the path captures that part of the URL.
# The function needs a parameter with the same name to receive it.
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/hello/???")
def hello(???):
    return {"message": f"Hello, {name}!"}

client = TestClient(app)
for url in ["/hello/Ada", "/hello/Grace", "/hello"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['/hello/{name}'],
    printPatterns: [
      "^/hello/Ada 200 \\{'message': 'Hello, Ada!'\\}$",
      "^/hello/Grace 200 \\{'message': 'Hello, Grace!'\\}$",
      "^/hello 404 \\{'detail': 'Not Found'\\}$",
    ],
    hints: [
      'The path becomes "/hello/{name}".',
      'The function signature becomes def hello(name: str):',
    ],
    predict: {
      prompt: 'The route is /hello/{name}. Does GET /hello (no name) reach the function?',
      answer: 'No, it answers 404 because the path does not match',
      distractors: ['Yes, with name set to None', 'Yes, with name set to ""'],
    },
    compare: {
      note: 'The name in braces and the parameter name must match.',
      wrong: '@app.get("/hello/{name}")\ndef hello(person: str): ...',
      fixed: '@app.get("/hello/{name}")\ndef hello(name: str): ...',
    },
    stretch: 'Stretch: add /hello/{name}/{times} that repeats the greeting times times, with times: int.',
  }),
  fastapi({
    id: 'fastapi-ask-query',
    number: 3,
    topic: 'Query parameters: /ask?q=',
    pipeline: ['read ?q= from the URL', 'look up the answer', 'fall back politely', 'return JSON'],
    goal: 'Make GET /ask read the question from ?q= and answer from the FAQ, so known questions get their answer, unknown ones get the fallback, and a call without q answers 422.',
    why:
      'A function parameter that is not in the path is read from the query string. Without a default it is required, so FastAPI rejects a call that leaves it out with 422 before your code runs.',
    tasks: [
      'Declare q as a text query parameter',
      'Look the question up in lowercase so "Refund" matches',
      'Run and compare the 200 and 422 lines',
    ],
    code: `# FastAPI — query parameters
# A parameter that is not in the path comes from the query string: /ask?q=hours
# No default means required: leaving it out is a 422 error.
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
FAQ = {
    "hours": "We are open 9 to 5.",
    "refund": "Refunds take 3 days.",
}

@app.get("/ask")
def ask(q: ???):
    answer = FAQ.get(???, "Sorry, no answer for that yet.")
    return {"question": q, "answer": answer}

client = TestClient(app)
for url in ["/ask?q=hours", "/ask?q=Refund", "/ask?q=parking", "/ask"]:
    response = client.get(url)
    print(url, response.status_code, response.json() if response.status_code == 200 else "missing q")
`,
    codeIncludes: ['q: str'],
    printPatterns: [
      "^/ask\\?q=hours 200 \\{'question': 'hours', 'answer': 'We are open 9 to 5.'\\}$",
      "^/ask\\?q=Refund 200 \\{'question': 'Refund', 'answer': 'Refunds take 3 days.'\\}$",
      "^/ask\\?q=parking 200 \\{'question': 'parking', 'answer': 'Sorry, no answer for that yet.'\\}$",
      '^/ask 422 missing q$',
    ],
    hints: [
      'The question is text, so q: str.',
      'FAQ keys are lowercase, so look up q.lower().',
    ],
    predict: {
      prompt: 'ask(q: str) has no default. What does GET /ask return?',
      answer: '422, because the required q is missing',
      distractors: ['200 with q set to None', '404, because the path is wrong'],
    },
    compare: {
      note: 'A default makes a query parameter optional.',
      wrong: 'def ask(q: str):  # /ask without q is a 422',
      fixed: 'def ask(q: str = "hours"):  # /ask now uses the default',
    },
    stretch: 'Stretch: add an optional lang: str = "en" parameter and return it in the response.',
  }),
  fastapi({
    id: 'fastapi-ask-body',
    number: 4,
    topic: 'POST /ask with a JSON body',
    pipeline: ['read the JSON body', 'validate it as Question', 'answer from the FAQ', 'return JSON'],
    goal: 'Move the question into a JSON body: POST /ask takes a Question model, answers known and unknown questions with 200, and rejects an empty body with 422.',
    why:
      'Real questions are long and may hold private text, so they go in the request body, not the URL. A Pydantic model describes that body; FastAPI parses the JSON and checks every field before your function runs.',
    tasks: [
      'Annotate the parameter with the Question model',
      'Send the requests with the client post method',
      'Run and read the 422 for the empty body',
    ],
    code: `# FastAPI — a JSON request body
# A parameter typed with a BaseModel is read from the JSON body and validated.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Question(BaseModel):
    text: str

app = FastAPI()
FAQ = {"hours": "We are open 9 to 5.", "refund": "Refunds take 3 days."}

@app.post("/ask")
def ask(question: ???):
    answer = FAQ.get(question.text.lower(), "Sorry, no answer for that yet.")
    return {"question": question.text, "answer": answer}

client = TestClient(app)
for body in [{"text": "hours"}, {"text": "parking"}, {}]:
    response = client.???("/ask", json=body)
    result = response.json()
    print(body, response.status_code, result if response.status_code == 200 else result["detail"][0]["loc"])
`,
    codeIncludes: ['question: Question'],
    printPatterns: [
      "^\\{'text': 'hours'\\} 200 \\{'question': 'hours', 'answer': 'We are open 9 to 5.'\\}$",
      "^\\{'text': 'parking'\\} 200 \\{'question': 'parking', 'answer': 'Sorry, no answer for that yet.'\\}$",
      "^\\{\\} 422 \\['body', 'text'\\]$",
    ],
    hints: [
      'The parameter type is the model class: question: Question.',
      'The route is registered with @app.post, so the client calls client.post.',
    ],
    predict: {
      prompt: 'POST /ask with the body {} when Question needs text. What happens?',
      answer: '422 pointing at body.text, and ask() never runs',
      distractors: ['ask() runs with text set to ""', '500 because text is missing'],
    },
    compare: {
      note: 'GET with a body is unusual and many clients drop it; send bodies with POST.',
      wrong: '@app.get("/ask")\ndef ask(question: Question): ...',
      fixed: '@app.post("/ask")\ndef ask(question: Question): ...',
    },
    stretch: 'Stretch: add an optional user: str = "guest" field to Question and include it in the answer.',
  }),
  fastapi({
    id: 'fastapi-not-found',
    number: 5,
    topic: 'Not found: raising 404',
    pipeline: ['convert the id', 'look it up', 'raise 404 on a miss', 'return the note'],
    goal: 'Raise HTTPException with 404 when a note id is unknown, so /notes/1 answers 200 and /notes/3 answers 404 with a clear detail.',
    why:
      'Returning {"error": "not found"} with status 200 tells every client the call worked. HTTPException stops the function and sends the status and detail, so clients can tell "missing" from "found".',
    tasks: [
      'Import HTTPException from fastapi',
      'Raise it with status 404 for an unknown id',
      'Run and compare the 200 and 404 lines',
    ],
    code: `# FastAPI — raising a 404
# raise HTTPException(status_code=..., detail=...) ends the request with that error.
from fastapi import FastAPI, ???
from fastapi.testclient import TestClient

app = FastAPI()
NOTES = {1: "Buy milk", 2: "Call mom"}

@app.get("/notes/{note_id}")
def read_note(note_id: int):
    if note_id not in NOTES:
        raise ???(status_code=404, detail="Note not found")
    return {"id": note_id, "text": NOTES[note_id]}

client = TestClient(app)
for url in ["/notes/1", "/notes/3"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['status_code=404'],
    printPatterns: [
      "^/notes/1 200 \\{'id': 1, 'text': 'Buy milk'\\}$",
      "^/notes/3 404 \\{'detail': 'Note not found'\\}$",
    ],
    hints: [
      'Both blanks are HTTPException.',
      'raise, not return: raising stops the function and FastAPI turns it into the response.',
    ],
    predict: {
      prompt: 'The handler does return {"error": "missing"} for an unknown id. What status does the client see?',
      answer: '200, so the client thinks it worked',
      distractors: ['404', '500'],
    },
    compare: {
      note: 'Raise the error so the status code says what happened.',
      wrong: 'return {"error": "Note not found"}',
      fixed: 'raise HTTPException(status_code=404, detail="Note not found")',
    },
    stretch: 'Stretch: add DELETE /notes/{note_id} that raises the same 404 for an unknown id.',
  }),
  fastapi({
    id: 'fastapi-async-route',
    number: 6,
    topic: 'async def routes',
    pipeline: ['receive the question', 'await the model call', 'build the answer', 'return JSON'],
    goal: 'Make the /ask route async and await the model call, so both questions come back answered instead of as an unfinished coroutine.',
    why:
      'Calling a model or another API means waiting on the network. An async def route lets the server handle other requests while it waits; await is where it pauses. Forget await and you get a coroutine object, not the answer.',
    tasks: [
      'Declare the route function with async def',
      'Await the fake model call',
      'Run and check both answers',
    ],
    code: `# FastAPI — async def routes
# async def lets the server serve other requests while this one waits.
# await pauses here until the slow call finishes and gives back its result.
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Question(BaseModel):
    text: str

async def fake_model(prompt: str) -> str:
    await asyncio.sleep(0)  # a real model call would wait on the network here
    return f"You asked about {prompt}."

app = FastAPI()

@app.post("/ask")
??? def ask(question: Question):
    answer = ??? fake_model(question.text)
    return {"answer": answer}

client = TestClient(app)
for text in ["refunds", "opening hours"]:
    response = client.post("/ask", json={"text": text})
    print(text, response.status_code, response.json())
`,
    codeIncludes: ['async def ask', 'await fake_model'],
    printPatterns: [
      "^refunds 200 \\{'answer': 'You asked about refunds.'\\}$",
      "^opening hours 200 \\{'answer': 'You asked about opening hours.'\\}$",
    ],
    hints: [
      'The first blank is async, so the line reads async def ask(...).',
      'The second blank is await: answer = await fake_model(question.text).',
    ],
    predict: {
      prompt: 'Inside async def ask, you write answer = fake_model(text) without await. What is answer?',
      answer: 'A coroutine object, not the text',
      distractors: ['The text, just slower', 'None'],
    },
    compare: {
      note: 'await is what turns the coroutine into its result.',
      wrong: 'answer = fake_model(question.text)',
      fixed: 'answer = await fake_model(question.text)',
    },
    stretch: 'Stretch: call fake_model for two questions at once with asyncio.gather and return both answers.',
  }),
]
