import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * FastAPI lessons 7-22, where the learner writes the code instead of filling single words. Scaffolding fades:
 * 7-9 write the routes, 10-14 also the model and the TestClient calls, 15-22 the whole file under the given data,
 * imports included. Each starter states the routes to build and the exact output to print; the hint ladder in
 * fastapiBuildAnswers.ts climbs from the idea to the shape of the code, and Solution shows a full answer.
 */
const build = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>): LessonDraft => ({
  ...practice({ ...spec, difficulty: 'fastapi', chapter: 'FastAPI', bookChapter: 'fastapi' }),
  taskInstructions: spec.tasks.map(
    (task) => `${task}. Write it where ??? stands and match the expected output in the comments; Hint starts with the idea, Solution has a full answer.`,
  ),
})

export const FASTAPI_BUILD_LESSON_DRAFTS: LessonDraft[] = [
  build({
    id: 'api-fastapi-path-query',
    number: 7,
    topic: 'Write routes: path and query parameters',
    pipeline: ['match the path', 'convert path params', 'read query params', 'return JSON'],
    goal:
      'Write GET /books/{book_id} and GET /search yourself, so /books/2 returns Emma, /books/abc answers 422, and /search?q=e returns two titles by default.',
    why:
      'From here on you write the routes, not single words. FastAPI reads the function signature: names in the path come from the URL, the rest from the query string, and the type hints decide what is converted or rejected with 422.',
    tasks: [
      'Write read_book with an int book_id and an optional shout flag',
      'Write search with a required q and a default limit of 2',
      'Run and compare every line with the expected output',
    ],
    code: `# FastAPI — write routes: path and query parameters
# Write two routes in place of the question-mark line:
#   GET /books/{book_id}  book_id is an int; return {"id": book_id, "title": ...}
#                         ?shout=true returns the title in capitals
#   GET /search           q is required, limit defaults to 2;
#                         return {"q": q, "results": [...]} with up to limit titles containing q, any case
#
# Expected output:
#   /books/2 200 {'id': 2, 'title': 'Emma'}
#   /books/2?shout=true 200 {'id': 2, 'title': 'EMMA'}
#   /books/abc 422 {'detail': [...]}
#   /search?q=e 200 {'q': 'e', 'results': ['Dune', 'Emma']}
#   /search 422 {'detail': [...]}
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
BOOKS = {1: "Dune", 2: "Emma", 3: "Ulysses"}

???

client = TestClient(app)
for url in ["/books/2", "/books/2?shout=true", "/books/abc", "/search?q=e", "/search"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['book_id: int', 'limit: int = 2'],
    printPatterns: [
      "^/books/2 200 \\{'id': 2, 'title': 'Emma'\\}$",
      "^/books/2\\?shout=true 200 \\{'id': 2, 'title': 'EMMA'\\}$",
      '^/books/abc 422 ',
      "^/search\\?q=e 200 \\{'q': 'e', 'results': \\['Dune', 'Emma'\\]\\}$",
      '^/search 422 ',
    ],
    hints: [
      'Without int, book_id stays the text "2", and BOOKS has no key "2".',
      'A parameter with a default is optional; q has none, so /search without q is a 422.',
    ],
    predict: {
      prompt: 'GET /books/abc when the handler says book_id: int. Status?',
      answer: '422, before the handler runs',
      distractors: ['404 Not Found', '500 Internal Server Error'],
    },
    compare: {
      note: 'The type hint is the validation. Leave it out and the handler gets a string.',
      wrong: 'def read_book(book_id, shout: bool = False):',
      fixed: 'def read_book(book_id: int, shout: bool = False):',
    },
    stretch:
      'Stretch: add /books/{book_id}/title that returns only the title, and call it with an id that is not in BOOKS to see what comes back.',
  }),
  build({
    id: 'fastapi-post-create',
    number: 8,
    topic: 'Write routes: create and list',
    pipeline: ['validate the body', 'assign the next id', 'store it', 'answer 201'],
    goal:
      'Write POST /notes, which answers 201 with a new id, and GET /notes, which lists every note in order, so both creates and the final list match the expected output.',
    why:
      '201 Created tells the client a new resource exists, and returning its id lets the client fetch it later. Create plus list is the first half of every CRUD API, and the first routes you write without blanks.',
    tasks: [
      'Write the POST route that stores a note and answers 201',
      'Write the GET route that lists every note',
      'Run and check the list at the end',
    ],
    code: `# FastAPI — write routes: create and list
# Write two routes in place of the question-mark line:
#   POST /notes  takes a Note body, answers 201, stores the text under the next id (1, 2, ...)
#                and returns {"id": ..., "text": ...}
#   GET /notes   returns [{"id": ..., "text": ...}, ...] in the order the notes were created
#
# Expected output:
#   POST 201 {'id': 1, 'text': 'Buy milk'}
#   POST 201 {'id': 2, 'text': 'Call mom'}
#   GET 200 [{'id': 1, 'text': 'Buy milk'}, {'id': 2, 'text': 'Call mom'}]
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Note(BaseModel):
    text: str

app = FastAPI()
NOTES = {}

???

client = TestClient(app)
for text in ["Buy milk", "Call mom"]:
    response = client.post("/notes", json={"text": text})
    print("POST", response.status_code, response.json())
response = client.get("/notes")
print("GET", response.status_code, response.json())
`,
    codeIncludes: ['@app.post(', 'status_code=201', '@app.get('],
    printPatterns: [
      "^POST 201 \\{'id': 1, 'text': 'Buy milk'\\}$",
      "^POST 201 \\{'id': 2, 'text': 'Call mom'\\}$",
      "^GET 200 \\[\\{'id': 1, 'text': 'Buy milk'\\}, \\{'id': 2, 'text': 'Call mom'\\}\\]$",
    ],
    hints: [
      'status_code=201 goes on the decorator: @app.post("/notes", status_code=201).',
      'The next id can be len(NOTES) + 1 while nothing is ever deleted.',
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
  build({
    id: 'api-fastapi-crud',
    number: 9,
    topic: 'Write routes: update and delete',
    pipeline: ['create 201', 'read 200', 'replace 200', 'delete 204 / 404'],
    goal:
      'Write PUT and DELETE for /todos, so updating todo 1 answers 200, deleting todo 2 answers 204 and then 404, and the final list holds only the finished todo 1.',
    why:
      'Most services are a handful of resources with create, read, update and delete. The same four verbs, a 404 for missing ids and 201/204 for create/delete come up in every API review.',
    tasks: [
      'Write PUT /todos/{todo_id} that replaces a todo or answers 404',
      'Write DELETE /todos/{todo_id} that answers 204 or 404',
      'Run and check the list at the end',
    ],
    code: `# FastAPI — write routes: update and delete
# Create and list are done. Write two routes in place of the question-mark line:
#   PUT /todos/{todo_id}     replace the todo with the Todo body; return {"id": ..., "title": ..., "done": ...}
#   DELETE /todos/{todo_id}  remove it and answer 204 with no body
# Both answer 404 with detail "Todo not found" for an id that does not exist.
#
# Expected output:
#   create 201
#   create 201
#   update 1 200
#   delete 2 204
#   delete 2 again 404
#   list [{'id': 1, 'title': 'Write tests', 'done': True}]
from itertools import count
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Todo(BaseModel):
    title: str
    done: bool = False

app = FastAPI()
TODOS = {}
ids = count(1)

@app.post("/todos", status_code=201)
def create_todo(todo: Todo):
    todo_id = next(ids)
    TODOS[todo_id] = todo
    return {"id": todo_id, **todo.model_dump()}

@app.get("/todos")
def list_todos():
    return [{"id": todo_id, **todo.model_dump()} for todo_id, todo in TODOS.items()]

???

client = TestClient(app)
print("create", client.post("/todos", json={"title": "Write tests"}).status_code)
print("create", client.post("/todos", json={"title": "Ship it"}).status_code)
print("update 1", client.put("/todos/1", json={"title": "Write tests", "done": True}).status_code)
print("delete 2", client.delete("/todos/2").status_code)
print("delete 2 again", client.delete("/todos/2").status_code)
print("list", client.get("/todos").json())
`,
    codeIncludes: ['@app.put(', '@app.delete(', 'status_code=204'],
    printPatterns: [
      '^update 1 200$',
      '^delete 2 204$',
      '^delete 2 again 404$',
      "^list \\[\\{'id': 1, 'title': 'Write tests', 'done': True\\}\\]$",
    ],
    hints: [
      'PUT replaces the whole resource, so store the validated todo under its id.',
      'del TODOS[todo_id] removes it; a 204 response has no body, so nothing needs returning.',
    ],
    predict: {
      prompt: 'DELETE the same todo twice. What does the second call return?',
      answer: '404, because it no longer exists',
      distractors: ['204 again', '500 KeyError'],
    },
    compare: {
      note: 'Check existence first so a missing id is a 404, not a KeyError and a 500.',
      wrong: 'del TODOS[todo_id]  # without the check above',
      fixed: 'if todo_id not in TODOS:\n    raise HTTPException(status_code=404, detail="Todo not found")\ndel TODOS[todo_id]',
    },
    stretch:
      'Stretch: add GET /todos/{todo_id} that returns one todo or 404, and a PATCH that only flips done without needing the title again.',
  }),
  build({
    id: 'api-fastapi-body-model',
    number: 10,
    topic: 'Write a model, a route and the calls',
    pipeline: ['parse JSON', 'validate the model', 'fill defaults', 'call the handler'],
    goal:
      'Write the Signup model, the POST /signup route and the client loop yourself, so a valid signup answers 201 and a missing or non-numeric age answers 422 at body.age.',
    why:
      'Now you also write the calls. A BaseModel is the contract for a JSON body: FastAPI converts "36" to 36, fills defaults and answers 422 with the exact field location before your handler runs.',
    tasks: [
      'Write the Signup model with email, age and an optional newsletter flag',
      'Write POST /signup answering 201 with the three fields',
      'Post every body in CASES and print the expected lines',
    ],
    code: `# FastAPI — write a model, a route and the calls
# In place of the question-mark line, write:
#   class Signup(BaseModel)  email: str, age: int, newsletter: bool that defaults to False
#   POST /signup             answers 201 and returns {"email": ..., "age": ..., "newsletter": ...}
#   a TestClient loop        post each body in CASES and print: name, status, then the JSON on 201
#                            or the loc of the first error (response.json()["detail"][0]["loc"])
#
# Expected output:
#   valid 201 {'email': 'ada@example.com', 'age': 36, 'newsletter': False}
#   missing_age 422 ['body', 'age']
#   bad_age 422 ['body', 'age']
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()
CASES = {
    "valid": {"email": "ada@example.com", "age": "36"},
    "missing_age": {"email": "ada@example.com"},
    "bad_age": {"email": "ada@example.com", "age": "old"},
}

???
`,
    codeIncludes: ['class Signup(BaseModel)', 'newsletter: bool = False', 'TestClient(app)'],
    printPatterns: [
      "^valid 201 \\{'email': 'ada@example.com', 'age': 36, 'newsletter': False\\}$",
      "^missing_age 422 \\['body', 'age'\\]$",
      "^bad_age 422 \\['body', 'age'\\]$",
    ],
    hints: [
      'A field with a default value is optional: newsletter: bool = False.',
      'Annotate the route parameter with the class itself: user: Signup. A plain dict skips all validation.',
    ],
    predict: {
      prompt: 'The body is {"email": "ada@example.com"} and age has no default. Status?',
      answer: '422 with loc body.age',
      distractors: ['201 with age None', '400 Bad Request'],
    },
    compare: {
      note: 'Typed models validate; a dict lets bad data reach your code.',
      wrong: 'def signup(user: dict):',
      fixed: 'def signup(user: Signup):',
    },
    stretch:
      'Stretch: add a name: str field with no default, send a body without it and check that the 422 now lists body.name as well as any other missing field.',
  }),
  build({
    id: 'fastapi-field-limits',
    number: 11,
    topic: 'Write a model with Field limits',
    pipeline: ['parse the body', 'check each limit', '422 with the field', 'store the review'],
    goal:
      'Write a Review model whose titles need at least 3 characters and whose stars run from 1 to 5, plus the route and calls, so a good review answers 201 and each bad one answers 422 at its field.',
    why:
      'Types alone accept a one-letter title or 99 stars. Field(...) limits put the business rules in the model, so every route that takes a Review gets the same checks and the same clear 422.',
    tasks: [
      'Write Review with Field limits on title and stars',
      'Write POST /reviews answering 201 with the review',
      'Post every body in CASES and print the expected lines',
    ],
    code: `# FastAPI — write a model with Field limits
# Field(min_length=..., ge=..., le=...) adds rules on top of the type.
# In place of the question-mark line, write:
#   class Review(BaseModel)  title: at least 3 characters; stars: from 1 to 5
#   POST /reviews            answers 201 and returns the review
#   a TestClient loop        post each body in CASES; print name, status and the JSON on 201,
#                            or name, status, the first error's loc and msg
#
# Expected output:
#   good 201 {'title': 'Great book', 'stars': 5}
#   short_title 422 ['body', 'title'] String should have at least 3 characters
#   too_many_stars 422 ['body', 'stars'] Input should be less than or equal to 5
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

app = FastAPI()
CASES = {
    "good": {"title": "Great book", "stars": 5},
    "short_title": {"title": "ok", "stars": 4},
    "too_many_stars": {"title": "Wow", "stars": 6},
}

???
`,
    codeIncludes: ['min_length=3', 'le=5', 'TestClient(app)'],
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
  build({
    id: 'fastapi-query-limits',
    number: 12,
    topic: 'Write routes with Query and Path limits',
    pipeline: ['read the parameter', 'check its range', '422 out of range', 'run the handler'],
    goal:
      'Write /books with a limit from 1 to 20 and /books/{book_id} for positive ids only, plus the calls, so in-range calls answer 200 and limit=50 or id 0 answer 422 with the rule they broke.',
    why:
      'Query(...) and Path(...) give URL parameters the same limits Field gives body fields. A client asking for 10,000 rows or book 0 gets a precise 422 instead of a slow query or a confusing empty result.',
    tasks: [
      'Write GET /books with limit defaulting to 3, from 1 to 20',
      'Write GET /books/{book_id} that only accepts ids above 0',
      'Call every URL in URLS and print the expected lines',
    ],
    code: `# FastAPI — write routes with Query and Path limits
# Query(default, ge=..., le=...) and Path(gt=...) check numbers in the URL.
# In place of the question-mark line, write:
#   GET /books            limit defaults to 3 and must be 1 to 20; return BOOKS[:limit]
#   GET /books/{book_id}  book_id must be greater than 0;
#                         return {"id": book_id, "title": BOOKS[(book_id - 1) % len(BOOKS)]}
#   a TestClient loop     call each URL in URLS; print url, status, then the JSON on 200
#                         or the first error's msg
#
# Expected output:
#   /books 200 ['Dune', 'Emma', 'Ulysses']
#   /books?limit=50 422 Input should be less than or equal to 20
#   /books/2 200 {'id': 2, 'title': 'Emma'}
#   /books/0 422 Input should be greater than 0
from fastapi import FastAPI, Path, Query
from fastapi.testclient import TestClient

app = FastAPI()
BOOKS = ["Dune", "Emma", "Ulysses", "Beloved", "Middlemarch"]
URLS = ["/books", "/books?limit=50", "/books/2", "/books/0"]

???
`,
    codeIncludes: ['le=20', 'Path(gt=0)', 'TestClient(app)'],
    printPatterns: [
      "^/books 200 \\['Dune', 'Emma', 'Ulysses'\\]$",
      '^/books\\?limit=50 422 Input should be less than or equal to 20$',
      "^/books/2 200 \\{'id': 2, 'title': 'Emma'\\}$",
      '^/books/0 422 Input should be greater than 0$',
    ],
    hints: [
      'le=20 caps limit at 20; Query(3, ...) makes 3 the default.',
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
  build({
    id: 'fastapi-response-model',
    number: 13,
    topic: 'Write response models that hide fields',
    pipeline: ['store the full user', 'return it', 'filter through UserOut', 'send only safe fields'],
    goal:
      'Write UserIn, UserOut and two user routes filtered through UserOut, plus the calls, so the password the routes store never appears in a response.',
    why:
      'The object you store often has fields the client must never see: password hashes, internal flags, other tenants. response_model is an allow-list for what leaves the API, so a careless return cannot leak them.',
    tasks: [
      'Write UserIn with a password and UserOut without one',
      'Write POST /users and GET /users/{username} with response_model=UserOut',
      'Make the calls and print the expected lines',
    ],
    code: `# FastAPI — write response models that hide fields
# response_model=UserOut keeps only UserOut's fields in the response, whatever the route returns.
# In place of the question-mark line, write:
#   class UserIn(BaseModel)   username: str, password: str
#   class UserOut(BaseModel)  username: str
#   POST /users               answers 201, stores the UserIn in USERS, returns it through UserOut
#   GET /users/{username}     returns the stored user through UserOut
#   the calls                 POST ada with password "s3cret", GET ada, then print whether
#                             "password" appears in either response's JSON
#
# Expected output:
#   POST 201 {'username': 'ada'}
#   GET 200 {'username': 'ada'}
#   password leaked: False
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()
USERS = {}

???
`,
    codeIncludes: ['class UserOut(BaseModel)', 'response_model=UserOut', 'TestClient(app)'],
    printPatterns: [
      "^POST 201 \\{'username': 'ada'\\}$",
      "^GET 200 \\{'username': 'ada'\\}$",
      '^password leaked: False$',
    ],
    hints: [
      'Return the full user from both routes; response_model does the filtering.',
      'The check is "password" in created.json() or "password" in fetched.json().',
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
  build({
    id: 'api-fastapi-http-errors',
    number: 14,
    topic: 'Write routes that raise 404 and 409',
    pipeline: ['look up the resource', 'raise on a gap', 'pick 404 / 409', 'return the body'],
    goal:
      'Write GET and POST /users/{username} so an unknown user answers 404 and a taken username answers 409, and the five calls print 200, 404, 201, 409 and 200.',
    why:
      'A handler that returns {"error": ...} with status 200 tells every client it worked. HTTPException stops the handler and sends the status and detail the client can act on: 404 for missing, 409 for a clash.',
    tasks: [
      'Write GET /users/{username} that raises 404 for an unknown user',
      'Write POST /users/{username} that raises 409 for a taken name',
      'Run every call in CALLS and print the expected lines',
    ],
    code: `# FastAPI — write routes that raise 404 and 409
# In place of the question-mark line, write:
#   GET /users/{username}   the user from USERS, or 404 with detail "No user named <username>"
#   POST /users/{username}  answers 201: store {"name": username.title()} and return it,
#                           or 409 with detail "Username already taken" if it exists
#   a TestClient loop       run each (name, method, url) in CALLS with client.request(method, url)
#                           and print name, status and JSON
#
# Expected output:
#   get ada 200 {'name': 'Ada'}
#   get bob 404 {'detail': 'No user named bob'}
#   create bob 201 {'name': 'Bob'}
#   create ada 409 {'detail': 'Username already taken'}
#   get bob 200 {'name': 'Bob'}
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
USERS = {"ada": {"name": "Ada"}}
CALLS = [
    ("get ada", "GET", "/users/ada"),
    ("get bob", "GET", "/users/bob"),
    ("create bob", "POST", "/users/bob"),
    ("create ada", "POST", "/users/ada"),
    ("get bob", "GET", "/users/bob"),
]

???
`,
    codeIncludes: ['status_code=404', 'status_code=409', 'TestClient(app)'],
    printPatterns: [
      "^get ada 200 \\{'name': 'Ada'\\}$",
      "^get bob 404 \\{'detail': 'No user named bob'\\}$",
      "^create bob 201 \\{'name': 'Bob'\\}$",
      "^create ada 409 \\{'detail': 'Username already taken'\\}$",
      "^get bob 200 \\{'name': 'Bob'\\}$",
    ],
    hints: [
      'Not found is 404. Conflict with existing state is 409.',
      'client.request(method, url) sends any method, so one loop covers GET and POST.',
    ],
    predict: {
      prompt: 'POST /users/ada when ada already exists. Best status?',
      answer: '409 Conflict',
      distractors: ['200 OK', '404 Not Found'],
    },
    compare: {
      note: 'Raise the error; do not return it with a 200.',
      wrong: 'return {"error": "Username already taken"}',
      fixed: 'raise HTTPException(status_code=409, detail="Username already taken")',
    },
    stretch:
      'Stretch: reject usernames shorter than three characters with 422 and a detail that says why, and add that call to the list.',
  }),
  build({
    id: 'fastapi-depends',
    number: 15,
    topic: 'Build it: a shared Depends',
    pipeline: ['call the dependency', 'read its query params', 'pass the result in', 'run the route'],
    goal:
      'Write the whole API under the data, imports included: one pagination dependency shared by /books and /authors with Depends, and the calls that print each page.',
    why:
      'From here you write the whole file: imports, app, routes and calls. Several routes need the same inputs, so Depends(fn) calls fn per request, resolving its own query parameters, and passes the result in. Write the rule once, reuse it everywhere.',
    tasks: [
      'Import FastAPI, Depends and TestClient and create the app',
      'Write pagination and the two routes that depend on it',
      'Call the four URLs and print the expected lines',
    ],
    code: `# FastAPI — build it: a shared Depends
# Depends(fn) calls fn for each request and passes its return value in.
# fn's own parameters (skip, limit) are read from the request like a route's.
# In place of the question-mark line, write the whole API:
#   imports               FastAPI and Depends from fastapi, TestClient from fastapi.testclient
#   pagination            skip defaults to 0, limit to 2; returns {"skip": ..., "limit": ...}
#   GET /books, /authors  both take page = Depends(pagination) and return that slice of the list
#   the calls             GET /books, /books?skip=2, /authors?limit=1, /authors?skip=3&limit=5;
#                         print url, status and JSON
#
# Expected output:
#   /books 200 ['Dune', 'Emma']
#   /books?skip=2 200 ['Ulysses', 'Beloved']
#   /authors?limit=1 200 ['Austen']
#   /authors?skip=3&limit=5 200 ['Morrison']
BOOKS = ["Dune", "Emma", "Ulysses", "Beloved"]
AUTHORS = ["Austen", "Eliot", "Joyce", "Morrison"]

???
`,
    codeIncludes: ['from fastapi import', 'Depends(pagination)', 'TestClient(app)'],
    printPatterns: [
      "^/books 200 \\['Dune', 'Emma'\\]$",
      "^/books\\?skip=2 200 \\['Ulysses', 'Beloved'\\]$",
      "^/authors\\?limit=1 200 \\['Austen'\\]$",
      "^/authors\\?skip=3&limit=5 200 \\['Morrison'\\]$",
    ],
    hints: [
      'Pass the function itself, without calling it: Depends(pagination).',
      'Slice with BOOKS[page["skip"] : page["skip"] + page["limit"]].',
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
  build({
    id: 'fastapi-yield-dependency',
    number: 16,
    topic: 'Build it: a yield dependency',
    pipeline: ['open the session', 'yield it to the route', 'run the route', 'close it in finally'],
    goal:
      'Write the whole API under the data: a get_db yield dependency that always closes its session, a note route that uses it, and the calls, so the log shows open and close for the 200 and the 404.',
    why:
      'A database session must be closed after every request, even when the route raises. Code before yield runs first, the yielded value goes to the route, and a finally block runs afterwards whatever happened.',
    tasks: [
      'Import what you need and write get_db with yield and finally',
      'Write GET /notes/{note_id} that depends on get_db and raises 404',
      'Call both URLs, then print the log',
    ],
    code: `# FastAPI — build it: a yield dependency
# Code before yield runs before the route; the yielded value is what the route gets.
# finally runs after the route, even if it raised an error.
# In place of the question-mark line, write the whole API:
#   imports                Depends, FastAPI and HTTPException from fastapi, TestClient
#   get_db                 make a FakeSession, LOG.append("open"), yield it,
#                          and in finally close it and LOG.append("close")
#   GET /notes/{note_id}   takes db from Depends(get_db); returns
#                          {"id": ..., "text": ..., "session_open": db.open}, or 404 "Note not found"
#   the calls              GET /notes/1 and /notes/9, print url, status and JSON, then print "log", LOG
#
# Expected output:
#   /notes/1 200 {'id': 1, 'text': 'Buy milk', 'session_open': True}
#   /notes/9 404 {'detail': 'Note not found'}
#   log ['open', 'close', 'open', 'close']
LOG = []
NOTES = {1: "Buy milk"}

class FakeSession:
    def __init__(self):
        self.open = True
    def close(self):
        self.open = False

???
`,
    codeIncludes: ['yield db', 'finally:', 'Depends(get_db)', 'TestClient(app)'],
    printPatterns: [
      "^/notes/1 200 \\{'id': 1, 'text': 'Buy milk', 'session_open': True\\}$",
      "^/notes/9 404 \\{'detail': 'Note not found'\\}$",
      "^log \\['open', 'close', 'open', 'close'\\]$",
    ],
    hints: [
      'yield db hands the session to the route and waits there until the route is done.',
      'Put the close in finally, so it runs even after the 404.',
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
  build({
    id: 'api-fastapi-api-key',
    number: 17,
    topic: 'Build it: API keys in headers',
    pipeline: ['read the header', 'know the caller 401', 'check the role 403', 'run the handler'],
    goal:
      'Write the whole API under the data: a require_user dependency that reads X-API-Key, /me and an admin-only /admin/cache, and the five calls, which print 401, 401, 200, 403 and 200.',
    why:
      '401 means "who are you?" and 403 means "I know you, and no". Putting the key check in one dependency means every route that needs a user gets the same rules, and none can forget them.',
    tasks: [
      'Write require_user, which reads the X-API-Key header or answers 401',
      'Write /me and an admin-only DELETE /admin/cache that answers 403',
      'Send the five calls with their headers and print the expected lines',
    ],
    code: `# FastAPI — build it: API keys in headers
# Header(None) reads an optional header; a parameter named x_api_key reads X-API-Key.
# In place of the question-mark line, write the whole API:
#   require_user            no header: 401 "Missing X-API-Key header"; unknown key: 401 "Unknown API key";
#                           otherwise return the user name from API_KEYS
#   GET /me                 {"user": <name>}
#   DELETE /admin/cache     403 "Admins only" unless the user is in ADMINS, else {"cleared": True}
#   the calls               no key, key "nope", key-alice on /me; key-bob, then key-alice on /admin/cache;
#                           print a short name for each call, the status and the JSON
#
# Expected output:
#   no key 401 {'detail': 'Missing X-API-Key header'}
#   bad key 401 {'detail': 'Unknown API key'}
#   alice 200 {'user': 'alice'}
#   bob clears cache 403 {'detail': 'Admins only'}
#   alice clears cache 200 {'cleared': True}
API_KEYS = {"key-alice": "alice", "key-bob": "bob"}
ADMINS = {"alice"}

???
`,
    codeIncludes: ['Header(None)', 'status_code=403', 'TestClient(app)'],
    printPatterns: [
      "^no key 401 \\{'detail': 'Missing X-API-Key header'\\}$",
      "^bad key 401 \\{'detail': 'Unknown API key'\\}$",
      "^alice 200 \\{'user': 'alice'\\}$",
      "^bob clears cache 403 \\{'detail': 'Admins only'\\}$",
      "^alice clears cache 200 \\{'cleared': True\\}$",
    ],
    hints: [
      'Without Header(...), FastAPI looks for x_api_key in the query string, not the headers.',
      'Bob has a valid key, so this is not 401. He is just not allowed: 403.',
    ],
    predict: {
      prompt: 'A valid key for a user who is not an admin calls an admin route. Status?',
      answer: '403 Forbidden',
      distractors: ['401 Unauthorized', '404 Not Found'],
    },
    compare: {
      note: 'Missing or unknown credentials are 401; known but not allowed is 403.',
      wrong: 'raise HTTPException(status_code=401, detail="Admins only")',
      fixed: 'raise HTTPException(status_code=403, detail="Admins only")',
    },
    stretch:
      'Stretch: compare keys with secrets.compare_digest instead of a dict lookup on the raw key, and explain in a comment why timing matters for key checks.',
  }),
  build({
    id: 'fastapi-current-user',
    number: 18,
    topic: 'Build it: current user and admin-only',
    pipeline: ['read Authorization', 'look up the token', '401 or the user', 'check the role 403'],
    goal:
      'Write the whole API under the data: current_user and admin_only dependencies for Bearer tokens, /me and an admin-only DELETE /cache, and the five calls, which print 401, 200, 401, 403 and 200.',
    why:
      'Most APIs need "who is calling?" on almost every route. A current_user dependency answers it once; an admin_only dependency builds on it, and dependencies=[...] protects a route that does not need the user value.',
    tasks: [
      'Write current_user, which reads "Authorization: Bearer <token>"',
      'Write admin_only on top of it, then /me and DELETE /cache',
      'Send the five calls and print the expected lines',
    ],
    code: `# FastAPI — build it: current user and admin-only
# In place of the question-mark line, write the whole API:
#   current_user     reads the Authorization header; missing or not "Bearer ...": 401 "Not signed in";
#                    unknown token: 401 "Invalid token"; otherwise the user dict from TOKENS
#   admin_only       depends on current_user; 403 "Admins only" unless role is "admin"
#   GET /me          {"name": <user name>}
#   DELETE /cache    protected with dependencies=[Depends(admin_only)]; returns {"cleared": True}
#   the calls        (GET /me, no token), (GET /me, token-ada), (GET /me, nope),
#                    (DELETE /cache, token-bob), (DELETE /cache, token-ada);
#                    print method, url, token, status and JSON
#
# Expected output:
#   GET /me None 401 {'detail': 'Not signed in'}
#   GET /me token-ada 200 {'name': 'Ada'}
#   GET /me nope 401 {'detail': 'Invalid token'}
#   DELETE /cache token-bob 403 {'detail': 'Admins only'}
#   DELETE /cache token-ada 200 {'cleared': True}
TOKENS = {
    "token-ada": {"name": "Ada", "role": "admin"},
    "token-bob": {"name": "Bob", "role": "reader"},
}

???
`,
    codeIncludes: ['Depends(current_user)', 'Depends(admin_only)', 'TestClient(app)'],
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
  build({
    id: 'fastapi-routers',
    number: 19,
    topic: 'Build it: split the app with APIRouter',
    pipeline: ['group routes in a router', 'give it a prefix', 'include it in the app', 'call the full paths'],
    goal:
      'Write the whole API under the data as two routers, notes and users, each with its own prefix, include both in one app, and call /notes, /notes/1 and /users.',
    why:
      'One file with fifty routes is hard to read and review. APIRouter groups related routes, usually one router per file, and the prefix keeps their paths short. The app just includes each router.',
    tasks: [
      'Write a notes router with prefix /notes and two routes',
      'Write a users router with prefix /users and include both in the app',
      'Call the three paths and print the expected lines',
    ],
    code: `# FastAPI — build it: split the app with APIRouter
# A router collects routes; prefix="/notes" is added in front of each of its paths.
# app.include_router(router) adds the router's routes to the app.
# In place of the question-mark line, write the whole API:
#   notes router   prefix "/notes": GET "/" lists the note texts, GET "/{note_id}" returns {"id": ..., "text": ...}
#   users router   prefix "/users": GET "/" returns USERS
#   the app        includes both routers
#   the calls      GET /notes, /notes/1 and /users; print url, status and JSON
#
# Expected output:
#   /notes 200 ['Buy milk', 'Call mom']
#   /notes/1 200 {'id': 1, 'text': 'Buy milk'}
#   /users 200 ['ada', 'grace']
NOTES = {1: "Buy milk", 2: "Call mom"}
USERS = ["ada", "grace"]

???
`,
    codeIncludes: ['APIRouter(prefix=', 'include_router(', 'TestClient(app)'],
    printPatterns: [
      "^/notes 200 \\['Buy milk', 'Call mom'\\]$",
      "^/notes/1 200 \\{'id': 1, 'text': 'Buy milk'\\}$",
      "^/users 200 \\['ada', 'grace'\\]$",
    ],
    hints: [
      'Router routes use the router as the decorator: @notes.get("/").',
      'A router does nothing until the app calls include_router with it.',
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
  build({
    id: 'api-fastapi-pagination',
    number: 20,
    topic: 'Build it: pagination with limit and offset',
    pipeline: ['cap the limit', 'slice the page', 'compute next_offset', 'stop at the end'],
    goal:
      'Write the whole API under the data: GET /items with a capped limit, an offset and next_offset, and a client that walks 23 items ten at a time, then checks that limit=500 is capped at 20.',
    why:
      'Every list endpoint needs paging before the data grows. A capped limit protects the server, and next_offset tells clients when to stop instead of letting them guess.',
    tasks: [
      'Write GET /items returning items, total and next_offset',
      'Walk the pages until next_offset is None',
      'Print the expected page lines and the capped size',
    ],
    code: `# FastAPI — build it: pagination with limit and offset
# In place of the question-mark line, write the whole API:
#   GET /items      limit defaults to 5 and is capped at MAX_LIMIT, offset defaults to 0;
#                   return {"items": <that page>, "total": len(ITEMS),
#                           "next_offset": <offset of the next page, or None after the last one>}
#   the page walk   start at offset 0 and request limit=10 until next_offset is None; for each page print
#                   "offset", the offset, the first item, "to", the last item, "next", next_offset
#   the cap         finally print "capped" and how many items GET /items?limit=500 returns
#
# Expected output:
#   offset 0 item-1 to item-10 next 10
#   offset 10 item-11 to item-20 next 20
#   offset 20 item-21 to item-23 next None
#   capped 20
ITEMS = [f"item-{n}" for n in range(1, 24)]
MAX_LIMIT = 20

???
`,
    codeIncludes: ['min(limit, MAX_LIMIT)', 'TestClient(app)'],
    printPatterns: [
      '^offset 0 item-1 to item-10 next 10$',
      '^offset 10 item-11 to item-20 next 20$',
      '^offset 20 item-21 to item-23 next None$',
      '^capped 20$',
    ],
    hints: [
      'A page is ITEMS[offset:offset + limit].',
      'There is a next page only while offset + limit is below len(ITEMS).',
    ],
    predict: {
      prompt: 'ITEMS has 23 entries. With limit 10, how many pages?',
      answer: '3',
      distractors: ['2', '23'],
    },
    compare: {
      note: 'Cap the limit on the server; never trust a client to ask for a sane page size.',
      wrong: 'page = ITEMS[offset:offset + limit]  # limit=500 returns everything',
      fixed: 'limit = min(limit, MAX_LIMIT)\npage = ITEMS[offset:offset + limit]',
    },
    stretch:
      'Stretch: switch to cursor paging that returns the last item name as next_cursor, and explain in a comment why cursors survive inserts better than offsets.',
  }),
  build({
    id: 'fastapi-dependency-overrides',
    number: 21,
    topic: 'Build it: swap a dependency in tests',
    pipeline: ['route depends on get_db', 'override get_db in tests', 'call the route', 'clear the override'],
    goal:
      'Write the whole file: a /notes route that depends on get_db, a fake_db, and the calls that print the real notes, the fake notes under dependency_overrides, and the real ones again after clearing it.',
    why:
      'Tests must not touch the real database or call paid APIs. Because routes ask for get_db through Depends, a test can swap it for a fake without changing the route.',
    tasks: [
      'Write get_db, fake_db and GET /notes that depends on get_db',
      'Override get_db with fake_db, then clear the override',
      'Print the before, override and after lines',
    ],
    code: `# FastAPI — build it: swap a dependency in tests
# app.dependency_overrides[real] = fake makes every Depends(real) call fake instead.
# In place of the question-mark line, write the whole file:
#   get_db       returns {"notes": ["real note"]}   (imagine a real database here)
#   fake_db      returns {"notes": ["fake 1", "fake 2"]}
#   GET /notes   takes db from Depends(get_db) and returns db["notes"]
#   the calls    print "before" with the notes, override get_db with fake_db and print "override",
#                then clear the overrides and print "after"
#
# Expected output:
#   before ['real note']
#   override ['fake 1', 'fake 2']
#   after ['real note']

???
`,
    codeIncludes: ['dependency_overrides[get_db] = fake_db', 'dependency_overrides.clear()', 'TestClient(app)'],
    printPatterns: [
      "^before \\['real note'\\]$",
      "^override \\['fake 1', 'fake 2'\\]$",
      "^after \\['real note'\\]$",
    ],
    hints: [
      'The key is the real dependency function, get_db, not a call to it.',
      'dependency_overrides is a plain dict on the app; clear() removes every override.',
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
  build({
    id: 'fastapi-test-asserts',
    number: 22,
    topic: 'Build it: tests that assert on responses',
    pipeline: ['call the route', 'assert the status', 'assert the body', 'report pass or fail'],
    goal:
      'Write three tests for the given API, one each for the health check, a missing note and creating a note, and a runner loop that prints PASS or FAIL for each, so all three print PASS.',
    why:
      'A test is a function that calls the API and asserts on what comes back. Run with pytest, each failing assert names the broken behavior before a user finds it. Printing a response is not a test.',
    tasks: [
      'Write test_health and test_missing_note with status and body asserts',
      'Write test_create_note that checks 201 and the returned text',
      'Run the three tests in a loop and print PASS or FAIL',
    ],
    code: `# FastAPI — build it: tests that assert on responses
# pytest runs every function named test_*; here you write the tests and a small loop that runs them.
# In place of the question-mark line, write:
#   test_health        GET /health answers 200 with {"status": "ok"}
#   test_missing_note  GET /notes/99 answers 404 with {"detail": "Note not found"}
#   test_create_note   POST /notes with {"text": "Buy milk"} answers 201 and returns that text
#   the runner         call each test; print "PASS <name>", or "FAIL <name>" on an AssertionError
#
# Expected output:
#   PASS test_health
#   PASS test_missing_note
#   PASS test_create_note
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

???
`,
    codeIncludes: ['def test_health', 'def test_missing_note', 'def test_create_note', 'assert '],
    printPatterns: [
      '^PASS test_health$',
      '^PASS test_missing_note$',
      '^PASS test_create_note$',
    ],
    hints: [
      'A test is a plain function: call the client, then assert on response.status_code and response.json().',
      'test.__name__ gives the function name for the PASS and FAIL lines.',
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
