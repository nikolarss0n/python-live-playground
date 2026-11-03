import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * The FastAPI track from the first endpoint up: health check, path and query parameters, a JSON body, 404s and async
 * routes, then validation limits, response models, dependencies, auth, routers and tests. Every lesson runs against
 * the in-browser simulator with TestClient; fastapiEssentialsLessons.ts holds the six lessons that sit between these.
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
  fastapi({
    id: 'fastapi-post-create',
    number: 8,
    topic: 'Create and list: POST 201',
    pipeline: ['validate the body', 'assign the next id', 'store it', 'answer 201'],
    goal: 'Create notes with POST /notes so each one answers 201 with a new id, and GET /notes lists both in order.',
    why:
      '201 Created tells the client a new resource exists, and returning its id lets the client fetch it later. Create plus list is the first half of every CRUD API.',
    tasks: [
      'Answer 201 from the create route',
      'Store the note text under its new id',
      'Run and check the list at the end',
    ],
    code: `# FastAPI — create and list
# status_code= on the decorator sets the success status for that route.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Note(BaseModel):
    text: str

app = FastAPI()
NOTES = {}
next_id = 1

@app.post("/notes", status_code=???)
def create_note(note: Note):
    global next_id
    note_id = next_id
    next_id += 1
    NOTES[note_id] = ???
    return {"id": note_id, "text": note.text}

@app.get("/notes")
def list_notes():
    return [{"id": note_id, "text": text} for note_id, text in NOTES.items()]

client = TestClient(app)
for text in ["Buy milk", "Call mom"]:
    response = client.post("/notes", json={"text": text})
    print("POST", response.status_code, response.json())
response = client.get("/notes")
print("GET", response.status_code, response.json())
`,
    codeIncludes: ['status_code=201'],
    printPatterns: [
      "^POST 201 \\{'id': 1, 'text': 'Buy milk'\\}$",
      "^POST 201 \\{'id': 2, 'text': 'Call mom'\\}$",
      "^GET 200 \\[\\{'id': 1, 'text': 'Buy milk'\\}, \\{'id': 2, 'text': 'Call mom'\\}\\]$",
    ],
    hints: [
      '201 is the status for "created".',
      'The list route reads text from NOTES, so store note.text.',
    ],
    predict: {
      prompt: 'Without status_code=201, what status does a successful POST return?',
      answer: '200',
      distractors: ['201 anyway, because it is a POST', '204'],
    },
    compare: {
      note: 'Say "created" with the status code, not only with the body.',
      wrong: '@app.post("/notes")',
      fixed: '@app.post("/notes", status_code=201)',
    },
    stretch: 'Stretch: add GET /notes/{note_id} that returns one note, or raises a 404 for an id that was never created.',
  }),
  fastapi({
    id: 'fastapi-field-limits',
    number: 11,
    topic: 'Field limits: min_length, ge, le',
    pipeline: ['parse the body', 'check each limit', '422 with the field', 'store the review'],
    goal: 'Require review titles of at least 3 characters and stars from 1 to 5, so a good review answers 201 and a short title or 6 stars answers 422 at that field.',
    why:
      'Types alone accept a one-letter title or 99 stars. Field(...) limits put the business rules in the model, so every route that takes a Review gets the same checks and the same clear 422.',
    tasks: [
      'Require titles of at least 3 characters',
      'Cap stars at 5',
      'Run and read where each 422 points',
    ],
    code: `# FastAPI — Field limits
# Field(min_length=..., ge=..., le=...) adds rules on top of the type.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

class Review(BaseModel):
    title: str = Field(min_length=???)
    stars: int = Field(ge=1, le=???)

app = FastAPI()

@app.post("/reviews", status_code=201)
def create_review(review: Review):
    return review

client = TestClient(app)
cases = {
    "good": {"title": "Great book", "stars": 5},
    "short_title": {"title": "ok", "stars": 4},
    "too_many_stars": {"title": "Wow", "stars": 6},
}
for name, body in cases.items():
    response = client.post("/reviews", json=body)
    if response.status_code == 201:
        print(name, response.status_code, response.json())
    else:
        error = response.json()["detail"][0]
        print(name, response.status_code, error["loc"], error["msg"])
`,
    codeIncludes: ['min_length=3', 'le=5'],
    printPatterns: [
      "^good 201 \\{'title': 'Great book', 'stars': 5\\}$",
      "^short_title 422 \\['body', 'title'\\] String should have at least 3 characters$",
      "^too_many_stars 422 \\['body', 'stars'\\] Input should be less than or equal to 5$",
    ],
    hints: [
      '"Wow" has 3 characters and must pass, "ok" has 2 and must fail.',
      'le means "less than or equal": le=5 allows 5 and rejects 6.',
    ],
    predict: {
      prompt: 'stars: int = Field(ge=1, le=5). Is {"stars": 0} accepted?',
      answer: 'No, 422: 0 is less than 1',
      distractors: ['Yes, 0 is an int', 'Yes, but it is stored as 1'],
    },
    compare: {
      note: 'Put the rule in the model, not in an if inside one route.',
      wrong: 'if review.stars > 5:\n    raise HTTPException(400, "too many stars")',
      fixed: 'stars: int = Field(ge=1, le=5)',
    },
    stretch: 'Stretch: add a comment field with max_length=200 and send one that is too long.',
  }),
  fastapi({
    id: 'fastapi-query-limits',
    number: 12,
    topic: 'Query and Path limits',
    pipeline: ['read the parameter', 'check its range', '422 out of range', 'run the handler'],
    goal: 'Allow limit from 1 to 20 and only positive book ids, so in-range calls answer 200 and limit=50 or id 0 answer 422 with the rule they broke.',
    why:
      'Query(...) and Path(...) give URL parameters the same limits Field gives body fields. A client asking for 10,000 rows or book 0 gets a precise 422 instead of a slow query or a confusing empty result.',
    tasks: [
      'Cap limit at 20',
      'Require book_id to be greater than 0',
      'Run and compare the 200 and 422 lines',
    ],
    code: `# FastAPI — Query and Path limits
# Query(default, ge=..., le=...) and Path(gt=...) check numbers in the URL.
from fastapi import FastAPI, Path, Query
from fastapi.testclient import TestClient

app = FastAPI()
BOOKS = ["Dune", "Emma", "Ulysses", "Beloved", "Middlemarch"]

@app.get("/books")
def list_books(limit: int = Query(3, ge=1, le=???)):
    return BOOKS[:limit]

@app.get("/books/{book_id}")
def get_book(book_id: int = Path(???=0)):
    return {"id": book_id, "title": BOOKS[(book_id - 1) % len(BOOKS)]}

client = TestClient(app)
for url in ["/books", "/books?limit=50", "/books/2", "/books/0"]:
    response = client.get(url)
    body = response.json()
    print(url, response.status_code, body if response.status_code == 200 else body["detail"][0]["msg"])
`,
    codeIncludes: ['le=20', 'Path(gt=0)'],
    printPatterns: [
      "^/books 200 \\['Dune', 'Emma', 'Ulysses'\\]$",
      '^/books\\?limit=50 422 Input should be less than or equal to 20$',
      "^/books/2 200 \\{'id': 2, 'title': 'Emma'\\}$",
      '^/books/0 422 Input should be greater than 0$',
    ],
    hints: [
      'le=20 caps limit at 20.',
      'gt means "greater than": Path(gt=0) rejects 0 and negatives.',
    ],
    predict: {
      prompt: 'limit: int = Query(3, ge=1, le=20). What does GET /books return?',
      answer: 'The first 3 books, because 3 is the default',
      distractors: ['422, because limit is missing', 'All 5 books'],
    },
    compare: {
      note: 'Without a cap, one request can ask for everything.',
      wrong: 'def list_books(limit: int = 3):',
      fixed: 'def list_books(limit: int = Query(3, ge=1, le=20)):',
    },
    stretch: 'Stretch: add a q: str = Query(None, min_length=2) title filter, then call it with q=e and q=em.',
  }),
  fastapi({
    id: 'fastapi-response-model',
    number: 13,
    topic: 'response_model hides fields',
    pipeline: ['store the full user', 'return it', 'filter through UserOut', 'send only safe fields'],
    goal: 'Filter both user routes through UserOut, so the password the routes return never appears in a response.',
    why:
      'The object you store often has fields the client must never see: password hashes, internal flags, other tenants. response_model is an allow-list for what leaves the API, so a careless return cannot leak them.',
    tasks: [
      'Set response_model on the create route',
      'Annotate the read route to return UserOut',
      'Run and confirm the password never appears',
    ],
    code: `# FastAPI — response_model
# response_model=UserOut, or a -> UserOut return annotation, keeps only UserOut's fields.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class UserIn(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    username: str

app = FastAPI()
USERS = {}

@app.post("/users", status_code=201, response_model=???)
def create_user(user: UserIn):
    USERS[user.username] = user
    return user  # still holds the password

@app.get("/users/{username}")
def get_user(username: str) -> ???:
    return USERS[username]

client = TestClient(app)
created = client.post("/users", json={"username": "ada", "password": "s3cret"})
print("POST", created.status_code, created.json())
fetched = client.get("/users/ada")
print("GET", fetched.status_code, fetched.json())
print("password leaked:", "password" in created.json() or "password" in fetched.json())
`,
    codeIncludes: ['response_model=UserOut', '-> UserOut'],
    printPatterns: [
      "^POST 201 \\{'username': 'ada'\\}$",
      "^GET 200 \\{'username': 'ada'\\}$",
      '^password leaked: False$',
    ],
    hints: [
      'Both blanks are UserOut.',
      'The return annotation does the same job as response_model=.',
    ],
    predict: {
      prompt: 'A route returns a dict with username and password, and response_model=UserOut has only username. What does the client get?',
      answer: 'Only username',
      distractors: ['Both fields', 'A 500 error because of the extra field'],
    },
    compare: {
      note: 'Do not rely on remembering to delete secrets in every route.',
      wrong: 'return {"username": user.username, "password": user.password}',
      fixed: '@app.post("/users", response_model=UserOut)',
    },
    stretch: 'Stretch: add GET /users with response_model=list[UserOut] and check no password appears in the list.',
  }),
  fastapi({
    id: 'fastapi-depends',
    number: 15,
    topic: 'Depends: share one dependency',
    pipeline: ['call the dependency', 'read its query params', 'pass the result in', 'run the route'],
    goal: 'Share one pagination dependency between /books and /authors with Depends, so both read skip and limit the same way.',
    why:
      'Several routes need the same inputs: paging, the current user, a database session. Depends(fn) calls fn for each request, resolving its own parameters, and passes the result in. Write the rule once, reuse it everywhere.',
    tasks: [
      'Wrap pagination in Depends for /books',
      'Point /authors at the same dependency',
      'Run and check skip and limit on both routes',
    ],
    code: `# FastAPI — Depends
# Depends(fn) calls fn for each request and passes its return value in.
# fn's own parameters (skip, limit) are read from the request like a route's.
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
BOOKS = ["Dune", "Emma", "Ulysses", "Beloved"]
AUTHORS = ["Austen", "Eliot", "Joyce", "Morrison"]

def pagination(skip: int = 0, limit: int = 2):
    return {"skip": skip, "limit": limit}

@app.get("/books")
def list_books(page: dict = ???(pagination)):
    return BOOKS[page["skip"] : page["skip"] + page["limit"]]

@app.get("/authors")
def list_authors(page: dict = Depends(???)):
    return AUTHORS[page["skip"] : page["skip"] + page["limit"]]

client = TestClient(app)
for url in ["/books", "/books?skip=2", "/authors?limit=1", "/authors?skip=3&limit=5"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['Depends(pagination)'],
    printPatterns: [
      "^/books 200 \\['Dune', 'Emma'\\]$",
      "^/books\\?skip=2 200 \\['Ulysses', 'Beloved'\\]$",
      "^/authors\\?limit=1 200 \\['Austen'\\]$",
      "^/authors\\?skip=3&limit=5 200 \\['Morrison'\\]$",
    ],
    hints: [
      'The first blank is Depends.',
      'Pass the function itself, without calling it: Depends(pagination).',
    ],
    predict: {
      prompt: 'Why Depends(pagination) and not Depends(pagination())?',
      answer: 'FastAPI calls it per request, with values from that request',
      distractors: ['Both work the same', 'pagination() would be faster'],
    },
    compare: {
      note: 'Pass the function; FastAPI decides when to call it.',
      wrong: 'page: dict = Depends(pagination())',
      fixed: 'page: dict = Depends(pagination)',
    },
    stretch: 'Stretch: cap limit inside pagination with Query(2, le=10), then call /books?limit=50 and read the 422.',
  }),
  fastapi({
    id: 'fastapi-yield-dependency',
    number: 16,
    topic: 'yield dependencies: open, then close',
    pipeline: ['open the session', 'yield it to the route', 'run the route', 'close it in finally'],
    goal: 'Turn get_db into a yield dependency that always closes the session, so the log shows open and close for the 200 call and for the 404 call.',
    why:
      'A database session must be closed after every request, even when the route raises. Code before yield runs first, the yielded value goes to the route, and a finally block runs afterwards whatever happened.',
    tasks: [
      'Hand the session to the route with yield',
      'Close it in a block that always runs',
      'Run and read the log after both calls',
    ],
    code: `# FastAPI — dependencies with yield
# Code before yield runs before the route; the yielded value is what the route gets.
# finally runs after the route, even if it raised an error.
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

LOG = []
NOTES = {1: "Buy milk"}

class FakeSession:
    def __init__(self):
        self.open = True
    def close(self):
        self.open = False

def get_db():
    db = FakeSession()
    LOG.append("open")
    try:
        ??? db
    ???:
        db.close()
        LOG.append("close")

app = FastAPI()

@app.get("/notes/{note_id}")
def read_note(note_id: int, db: FakeSession = Depends(get_db)):
    if note_id not in NOTES:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"id": note_id, "text": NOTES[note_id], "session_open": db.open}

client = TestClient(app)
for url in ["/notes/1", "/notes/9"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
print("log", LOG)
`,
    codeIncludes: ['yield db', 'finally:'],
    printPatterns: [
      "^/notes/1 200 \\{'id': 1, 'text': 'Buy milk', 'session_open': True\\}$",
      "^/notes/9 404 \\{'detail': 'Note not found'\\}$",
      "^log \\['open', 'close', 'open', 'close'\\]$",
    ],
    hints: [
      'yield db hands the session to the route and waits there until the route is done.',
      'The second blank is finally, so the close runs even after the 404.',
    ],
    predict: {
      prompt: 'The route raises a 404. Does the code after yield in a finally block still run?',
      answer: 'Yes, finally always runs',
      distractors: ['No, the error skips it', 'Only for 500 errors'],
    },
    compare: {
      note: 'Without finally, an error in the route leaks the session.',
      wrong: 'yield db\ndb.close()',
      fixed: 'try:\n    yield db\nfinally:\n    db.close()',
    },
    stretch: 'Stretch: count open sessions in a global and print it after both calls; it should be 0.',
  }),
  fastapi({
    id: 'fastapi-current-user',
    number: 18,
    topic: 'Auth: current user and admin-only',
    pipeline: ['read Authorization', 'look up the token', '401 or the user', 'check the role 403'],
    goal: 'Answer 401 for an invalid token and 403 for a signed-in reader who tries the admin route, so the five calls print 401, 200, 401, 403 and 200.',
    why:
      'Most APIs need "who is calling?" on almost every route. A current_user dependency answers it once; an admin_only dependency builds on it. 401 means "sign in", 403 means "signed in, but not allowed".',
    tasks: [
      'Answer 401 for an unknown token',
      'Answer 403 for a user who is not an admin',
      'Run and compare the five status codes',
    ],
    code: `# FastAPI — auth with dependencies
# current_user reads the Authorization: Bearer <token> header.
# admin_only depends on current_user, and a route can require it with dependencies=[...].
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

TOKENS = {
    "token-ada": {"name": "Ada", "role": "admin"},
    "token-bob": {"name": "Bob", "role": "reader"},
}

def current_user(authorization: str | None = Header(None)):
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    user = TOKENS.get(authorization.removeprefix("Bearer "))
    if user is None:
        raise HTTPException(status_code=???, detail="Invalid token")
    return user

def admin_only(user: dict = Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=???, detail="Admins only")
    return user

app = FastAPI()

@app.get("/me")
def me(user: dict = Depends(current_user)):
    return {"name": user["name"]}

@app.delete("/cache", dependencies=[Depends(admin_only)])
def clear_cache():
    return {"cleared": True}

client = TestClient(app)
calls = [("GET", "/me", None), ("GET", "/me", "token-ada"), ("GET", "/me", "nope"),
         ("DELETE", "/cache", "token-bob"), ("DELETE", "/cache", "token-ada")]
for method, url, token in calls:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = client.request(method, url, headers=headers)
    print(method, url, token, response.status_code, response.json())
`,
    codeIncludes: ['status_code=401', 'status_code=403'],
    printPatterns: [
      "^GET /me None 401 \\{'detail': 'Not signed in'\\}$",
      "^GET /me token-ada 200 \\{'name': 'Ada'\\}$",
      "^GET /me nope 401 \\{'detail': 'Invalid token'\\}$",
      "^DELETE /cache token-bob 403 \\{'detail': 'Admins only'\\}$",
      "^DELETE /cache token-ada 200 \\{'cleared': True\\}$",
    ],
    hints: [
      'An unknown token means "we do not know who you are": 401.',
      'Bob is known but not an admin: 403.',
    ],
    predict: {
      prompt: 'Bob has a valid token but is not an admin. Which status fits?',
      answer: '403 Forbidden',
      distractors: ['401 Unauthorized', '404 Not Found'],
    },
    compare: {
      note: 'Check auth in one dependency, not copied into every route.',
      wrong: 'def clear_cache(authorization: str = Header(None)):\n    # token checks pasted here again',
      fixed: '@app.delete("/cache", dependencies=[Depends(admin_only)])',
    },
    stretch: 'Stretch: add GET /admin/users that takes user: dict = Depends(admin_only) and returns the user names.',
  }),
  fastapi({
    id: 'fastapi-routers',
    number: 19,
    topic: 'APIRouter: split the app',
    pipeline: ['group routes in a router', 'give it a prefix', 'include it in the app', 'call the full paths'],
    goal: 'Give the users router the /users prefix and include the notes router in the app, so /notes, /notes/1 and /users all answer 200.',
    why:
      'One file with fifty routes is hard to read and review. APIRouter groups related routes, usually one router per file, and the prefix keeps their paths short. The app just includes each router.',
    tasks: [
      'Give the users router its /users prefix',
      'Include the notes router in the app',
      'Run and check all three paths',
    ],
    code: `# FastAPI — APIRouter
# A router collects routes; prefix="/notes" is added in front of each of its paths.
# app.include_router(router) adds the router's routes to the app.
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

NOTES = {1: "Buy milk", 2: "Call mom"}

notes = APIRouter(prefix="/notes")

@notes.get("/")
def list_notes():
    return list(NOTES.values())

@notes.get("/{note_id}")
def read_note(note_id: int):
    return {"id": note_id, "text": NOTES[note_id]}

users = APIRouter(prefix=???)

@users.get("/")
def list_users():
    return ["ada", "grace"]

app = FastAPI()
app.???(notes)
app.include_router(users)

client = TestClient(app)
for url in ["/notes", "/notes/1", "/users"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['app.include_router(notes)'],
    printPatterns: [
      "^/notes 200 \\['Buy milk', 'Call mom'\\]$",
      "^/notes/1 200 \\{'id': 1, 'text': 'Buy milk'\\}$",
      "^/users 200 \\['ada', 'grace'\\]$",
    ],
    hints: [
      'The prefix is a path string: "/users".',
      'The app method is include_router.',
    ],
    predict: {
      prompt: 'A router has prefix="/notes" and a route "/{note_id}". What is the full path?',
      answer: '/notes/{note_id}',
      distractors: ['/{note_id}', '/notes'],
    },
    compare: {
      note: 'A router does nothing until the app includes it.',
      wrong: 'users = APIRouter(prefix="/users")\n# forgot app.include_router(users)',
      fixed: 'app.include_router(users)',
    },
    stretch: 'Stretch: include the notes router a second time with prefix="/v2" and call /v2/notes/1.',
  }),
  fastapi({
    id: 'fastapi-dependency-overrides',
    number: 21,
    topic: 'Testing: dependency_overrides',
    pipeline: ['route depends on get_db', 'override get_db in tests', 'call the route', 'clear the override'],
    goal: 'Swap the real database for a fake in tests with app.dependency_overrides, so the middle call lists the fake notes and the last call is back to the real one.',
    why:
      'Tests must not touch the real database or call paid APIs. Because routes ask for get_db through Depends, a test can swap it for a fake without changing the route.',
    tasks: [
      'Override the get_db dependency',
      'Point it at fake_db',
      'Run and compare the three lines',
    ],
    code: `# FastAPI — dependency_overrides in tests
# app.dependency_overrides[real] = fake makes every Depends(real) call fake instead.
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

def get_db():
    return {"notes": ["real note"]}  # imagine a real database connection here

def fake_db():
    return {"notes": ["fake 1", "fake 2"]}

app = FastAPI()

@app.get("/notes")
def list_notes(db: dict = Depends(get_db)):
    return db["notes"]

client = TestClient(app)
print("before", client.get("/notes").json())

app.dependency_overrides[???] = ???
print("override", client.get("/notes").json())

app.dependency_overrides.clear()
print("after", client.get("/notes").json())
`,
    codeIncludes: ['app.dependency_overrides[get_db] = fake_db'],
    printPatterns: [
      "^before \\['real note'\\]$",
      "^override \\['fake 1', 'fake 2'\\]$",
      "^after \\['real note'\\]$",
    ],
    hints: [
      'The key is the real dependency function, get_db, not a call to it.',
      'The value is the replacement function: fake_db.',
    ],
    predict: {
      prompt: 'After dependency_overrides.clear(), which database does /notes use?',
      answer: 'The real get_db again',
      distractors: ['Still fake_db', 'None, the route fails'],
    },
    compare: {
      note: 'Override the dependency, do not edit the route for tests.',
      wrong: 'def list_notes(db: dict = Depends(fake_db)):  # changed for tests',
      fixed: 'app.dependency_overrides[get_db] = fake_db',
    },
    stretch: 'Stretch: make fake_db return an empty list and check that /notes returns [].',
  }),
  fastapi({
    id: 'fastapi-test-asserts',
    number: 22,
    topic: 'Testing: assert on responses',
    pipeline: ['call the route', 'assert the status', 'assert the body', 'report pass or fail'],
    goal: 'Finish the three tests so each asserts the right status and body, and all three print PASS.',
    why:
      'A test is a function that calls the API and asserts on what comes back. Run with pytest, each failing assert names the broken behavior before a user finds it.',
    tasks: [
      'Expect 404 for a missing note',
      'Expect the created text back',
      'Run and check all three PASS lines',
    ],
    code: `# FastAPI — tests that assert on responses
# pytest runs every function named test_*; here a small loop does the same job.
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Note(BaseModel):
    text: str

app = FastAPI()
NOTES = {}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/notes/{note_id}")
def read_note(note_id: int):
    if note_id not in NOTES:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"id": note_id, "text": NOTES[note_id]}

@app.post("/notes", status_code=201)
def create_note(note: Note):
    note_id = len(NOTES) + 1
    NOTES[note_id] = note.text
    return {"id": note_id, "text": note.text}

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_missing_note():
    response = client.get("/notes/99")
    assert response.status_code == ???

def test_create_note():
    response = client.post("/notes", json={"text": "Buy milk"})
    assert response.status_code == 201
    assert response.json()["text"] == ???

for test in [test_health, test_missing_note, test_create_note]:
    try:
        test()
        print("PASS", test.__name__)
    except AssertionError:
        print("FAIL", test.__name__)
`,
    codeIncludes: ['def test_missing_note', 'def test_create_note'],
    printPatterns: [
      '^PASS test_health$',
      '^PASS test_missing_note$',
      '^PASS test_create_note$',
    ],
    hints: [
      'A missing note answers 404.',
      'The test sent "Buy milk", so that is the text that comes back.',
    ],
    predict: {
      prompt: 'An assert fails inside test_create_note. What does the loop print?',
      answer: 'FAIL test_create_note',
      distractors: ['PASS test_create_note', 'Nothing, the program stops'],
    },
    compare: {
      note: 'Assert on the status and the body; printing is not testing.',
      wrong: 'print(client.get("/notes/99").status_code)',
      fixed: 'assert client.get("/notes/99").status_code == 404',
    },
    stretch: 'Stretch: add test_bad_body that posts {} to /notes and asserts a 422, then add it to the loop.',
  }),
]
