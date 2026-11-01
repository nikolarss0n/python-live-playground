import type { LessonDraft, LessonFullstack } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * Full-stack data: one in-memory SQLite database (`playdb`), a FastAPI app that reads and writes it, and the View tab
 * that charts what a route returns. Datasets come from a seed, so Shuffle in the Data tab gives new rows; goals check
 * shape and invariants rather than exact numbers.
 */
const fullstack = (
  spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>,
  tabs: LessonFullstack,
): LessonDraft => {
  const draft = practice({ ...spec, difficulty: 'api', chapter: 'Full-stack data', bookChapter: '' })
  delete draft.bookChapter
  return { ...draft, fullstack: tabs }
}

export const FULLSTACK_LESSON_DRAFTS: LessonDraft[] = [
  fullstack({
    id: 'api-fullstack-seed-table',
    number: 55,
    topic: 'Create and seed a table',
    pipeline: ['connect', 'CREATE TABLE', 'INSERT rows', 'open the Data tab'],
    goal:
      'Create a small products table by hand, load the 40 practice orders with playdb.load, and count both tables. Then open the Data tab to see the columns, their types and the rows.',
    why:
      'Almost every web app keeps its data in a database table. Seeing the table next to the code that filled it makes rows, columns and types concrete before any API is involved.',
    tasks: [
      'Load the "orders" practice dataset into the database',
      'Count the rows of the orders table',
      'Run, then open the Data tab and press Shuffle data',
    ],
    code: `# Full-stack data — Create and seed a table
import playdb

db = playdb.connect()
db.execute("CREATE TABLE products (name TEXT, price REAL, stock INTEGER)")
db.executemany(
    "INSERT INTO products VALUES (?, ?, ?)",
    [("Tent", 129.0, 4), ("Lamp", 24.5, 12), ("Stove", 59.9, 0)],
)
playdb.load(db, ???)

orders = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
products = db.execute("SELECT COUNT(*) FROM ???").fetchone()[0]
print("orders rows:", orders)
print("products rows:", products)
print("first order:", dict(db.execute("SELECT * FROM orders ORDER BY id LIMIT 1").fetchone()))
`,
    codeIncludes: ['COUNT(*) FROM products'],
    printPatterns: [
      '^orders rows: 40$',
      '^products rows: 3$',
      "^first order: \\{'id': 1, 'day': '2026-10-0\\d', 'city': '\\w+', 'product': '\\w+', 'amount': [\\d.]+\\}$",
    ],
    hints: [
      'playdb.load takes the database and a dataset name as a string: "orders", "weather", "students" or "tickets".',
      'COUNT(*) counts every row of the table you name after FROM.',
    ],
    predict: {
      prompt: 'You press Shuffle data and the code runs again. What happens to "orders rows"?',
      answer: 'It stays 40; only the values inside the rows change',
      distractors: ['It becomes a random number', 'It doubles because the rows are loaded twice'],
    },
    compare: {
      note: 'Give every column a type. The Data tab shows it, and SQLite uses it to store numbers as numbers.',
      wrong: 'CREATE TABLE products (name, price, stock)',
      fixed: 'CREATE TABLE products (name TEXT, price REAL, stock INTEGER)',
    },
    stretch: 'Stretch: add a fourth product with stock 0 and print how many products are out of stock with a WHERE clause.',
  }, { calls: [] }),
  fullstack({
    id: 'api-fullstack-select-where',
    number: 56,
    topic: 'SELECT with WHERE',
    pipeline: ['load weather', 'filter with WHERE', 'pass values as parameters', 'sort with ORDER BY'],
    goal:
      'Finish rainy_days so it returns only the chosen city’s days with at least min_rain millimetres, using ? parameters, and list the warmest readings first.',
    why:
      'Filtering in SQL means the database sends back only the rows you need. Passing values as ? parameters instead of pasting them into the string is what keeps user input from rewriting your query.',
    tasks: [
      'Pass the city as the first query parameter',
      'Sort the warmest readings first',
      'Run and check the filtered counts',
    ],
    code: `# Full-stack data — SELECT with WHERE
import playdb

db = playdb.connect()
playdb.load(db, "weather")

def rainy_days(city, min_rain):
    rows = db.execute(
        "SELECT day, city, rain_mm FROM weather WHERE city = ? AND rain_mm >= ? ORDER BY day",
        (???, min_rain),
    ).fetchall()
    return [dict(row) for row in rows]

print("Oslo days:", len(rainy_days("Oslo", 0)))
wet = rainy_days("Oslo", 2.5)
print("only Oslo:", all(row["city"] == "Oslo" for row in wet))
print("only wet:", all(row["rain_mm"] >= 2.5 for row in wet))

warmest = db.execute("SELECT city, day, temp_c FROM weather ORDER BY ??? LIMIT 3").fetchall()
temps = [row["temp_c"] for row in warmest]
print("warmest first:", temps == sorted(temps, reverse=True), len(temps))
`,
    codeIncludes: ['(city, min_rain)'],
    printPatterns: ['^Oslo days: 7$', '^only Oslo: True$', '^only wet: True$', '^warmest first: True 3$'],
    hints: [
      'The values tuple matches the ? marks in order: the first ? is the city.',
      'ORDER BY a column sorts low to high; add DESC to put the largest first.',
    ],
    predict: {
      prompt: 'How many rows does rainy_days("Oslo", 0) return?',
      answer: '7, one reading per day for that city',
      distractors: ['28, every row in the table', 'It depends on the shuffle seed'],
    },
    compare: {
      note: 'Never build SQL with f-strings from user input. A name like "x\' OR 1=1 --" would return every row.',
      wrong: 'db.execute(f"SELECT * FROM weather WHERE city = \'{city}\'")',
      fixed: 'db.execute("SELECT * FROM weather WHERE city = ?", (city,))',
    },
    stretch: 'Stretch: add a max_temp parameter to rainy_days and join it to the city filter with a second AND condition.',
  }, { calls: [] }),
  fullstack({
    id: 'api-fullstack-group-by-chart',
    number: 57,
    topic: 'GROUP BY into a chart',
    pipeline: ['load orders', 'GROUP BY city', 'COUNT and SUM', 'chart the route'],
    goal:
      'Group the orders by city so each city gets one row with its order count and revenue, check the counts add up to all 40 orders, then open the View tab to see the revenue chart.',
    why:
      'Dashboards are mostly GROUP BY queries: one row per category with a total. Returning those rows from a route is all a frontend needs to draw a bar chart.',
    tasks: [
      'Group the rows by city',
      'Check that the per-city counts add up to every order',
      'Run, then open the View tab and switch between Bars and Line',
    ],
    code: `# Full-stack data — GROUP BY into a chart
import playdb
from fastapi import FastAPI

db = playdb.connect()
playdb.load(db, "orders")

def revenue_by_city():
    rows = db.execute(
        "SELECT city, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue "
        "FROM orders GROUP BY ??? ORDER BY revenue DESC"
    ).fetchall()
    return [dict(row) for row in rows]

totals = revenue_by_city()
print(len(totals), "cities")
print("orders add up:", sum(row["orders"] for row in totals) == ???)
print("biggest first:", totals[0]["revenue"] >= totals[-1]["revenue"])

app = FastAPI()

@app.get("/revenue/by-city")
def by_city():
    return revenue_by_city()
`,
    codeIncludes: ['GROUP BY city'],
    printPatterns: ['^4 cities$', '^orders add up: True$', '^biggest first: True$'],
    hints: [
      'GROUP BY city makes one output row per distinct city; COUNT and SUM then work inside each group.',
      'The practice orders table always has 40 rows, whatever the seed.',
    ],
    predict: {
      prompt: 'Without GROUP BY, how many rows would this query return?',
      answer: 'One row with the totals of all orders',
      distractors: ['40 rows, one per order', 'An error, COUNT needs GROUP BY'],
    },
    compare: {
      note: 'Let the database add things up. Looping in Python over every row moves all the data just to throw most of it away.',
      wrong: 'for row in db.execute("SELECT * FROM orders"): totals[row["city"]] += row["amount"]',
      fixed: 'db.execute("SELECT city, SUM(amount) AS revenue FROM orders GROUP BY city")',
    },
    stretch: 'Stretch: add a /revenue/by-product route with the same GROUP BY shape, then pick it in the View tab’s route menu.',
  }, { calls: ['/revenue/by-city'], view: { call: 0, y: 'revenue', kind: 'bar' } }),
  fullstack({
    id: 'api-fullstack-route',
    number: 58,
    topic: 'A route that queries the database',
    pipeline: ['request /students/Ada', 'query by name', '404 when missing', 'return JSON rows'],
    goal:
      'Make /students/{name} return that student’s grades and a 404 for unknown names, and make /averages return one row per subject. Then try other names in the API tab.',
    why:
      'This is the core of a backend: a URL comes in, the route turns it into a query, and the rows go back as JSON. A clear 404 tells the frontend the difference between “no data” and “wrong address”.',
    tasks: [
      'Raise a 404 when no rows match the name',
      'Return the average rows as a list of dicts',
      'Run, then edit the path in the API tab to /students/Grace',
    ],
    code: `# Full-stack data — A route that queries the database
import playdb
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

db = playdb.connect()
playdb.load(db, "students")
app = FastAPI()

@app.get("/students/{name}")
def report(name: str):
    rows = db.execute(
        "SELECT subject, grade FROM students WHERE name = ? ORDER BY subject", (name,)
    ).fetchall()
    if not rows:
        raise HTTPException(status_code=???, detail="Student not found")
    return [dict(row) for row in rows]

@app.get("/averages")
def averages():
    rows = db.execute(
        "SELECT subject, ROUND(AVG(grade), 1) AS average FROM students GROUP BY subject ORDER BY subject"
    ).fetchall()
    return ???

client = TestClient(app)
ada = client.get("/students/Ada")
print(ada.status_code, [row["subject"] for row in ada.json()])
print(client.get("/students/Zed").status_code)
print([row["subject"] for row in client.get("/averages").json()])
`,
    codeIncludes: ['status_code=404'],
    printPatterns: ["^200 \\['Biology', 'History', 'Maths'\\]$", '^404$', "^\\['Biology', 'History', 'Maths'\\]$"],
    hints: [
      '404 means “not found”: the address is fine, but there is no student with that name.',
      'sqlite3.Row is not JSON. Turn each row into a dict, the same way report() does.',
    ],
    predict: {
      prompt: 'What does /students/ada (lower case) return?',
      answer: 'A 404, because SQL = compares text exactly',
      distractors: ['Ada’s grades, names ignore case', 'A 500 error'],
    },
    compare: {
      note: 'An empty list with 200 hides a typo in the URL. Say “not found” when the thing itself does not exist.',
      wrong: 'return [dict(row) for row in rows]  # [] for unknown names',
      fixed: 'if not rows:\n    raise HTTPException(status_code=404, detail="Student not found")',
    },
    stretch: 'Stretch: add /students/{name}/best that returns only the highest grade, with the same 404 rule.',
  }, { calls: ['/students/Ada', '/averages'], view: { call: 1, kind: 'bar' } }),
  fullstack({
    id: 'api-fullstack-query-filters',
    number: 59,
    topic: 'Query filters like ?city=',
    pipeline: ['read ?city= and ?limit=', 'add WHERE only when set', 'bind the values', 'chart per day'],
    goal:
      'Let /orders take an optional city filter and a limit, adding the WHERE clause only when a city is given. Then change ?city=Oslo to another city in the API tab and watch the View chart follow.',
    why:
      'Most list endpoints take filters as query parameters. Building the SQL piece by piece while still binding every value keeps the route flexible and safe.',
    tasks: [
      'Bind the city value when the filter is set',
      'Bind the limit value',
      'Run, then try /orders/daily?city=Paris in the API tab',
    ],
    code: `# Full-stack data — Query filters like ?city=
import playdb
from fastapi import FastAPI
from fastapi.testclient import TestClient

db = playdb.connect()
playdb.load(db, "orders")
app = FastAPI()

@app.get("/orders")
def list_orders(city: str = "", limit: int = 5):
    sql = "SELECT id, day, city, product, amount FROM orders"
    params = []
    if city:
        sql += " WHERE city = ?"
        params.append(???)
    sql += " ORDER BY id LIMIT ?"
    params.append(???)
    return [dict(row) for row in db.execute(sql, params).fetchall()]

@app.get("/orders/daily")
def daily(city: str = ""):
    rows = db.execute(
        "SELECT day, ROUND(SUM(amount), 2) AS revenue FROM orders "
        "WHERE ? = '' OR city = ? GROUP BY day ORDER BY day",
        (city, city),
    ).fetchall()
    return [dict(row) for row in rows]

client = TestClient(app)
oslo = client.get("/orders?city=Oslo&limit=40").json()
print("only Oslo:", all(row["city"] == "Oslo" for row in oslo))
print("limit works:", len(client.get("/orders?limit=3").json()))
print("every order:", len(client.get("/orders?limit=40").json()))
`,
    codeIncludes: ['params.append(city)', 'params.append(limit)'],
    printPatterns: ['^only Oslo: True$', '^limit works: 3$', '^every order: 40$'],
    hints: [
      'params must line up with the ? marks: the city first (only when it is set), then the limit.',
      'FastAPI already turned ?limit=3 into the int 3, so append the parameter itself.',
    ],
    predict: {
      prompt: 'What does /orders return with no query string at all?',
      answer: 'The first 5 orders from any city',
      distractors: ['An error, city is required', 'All 40 orders'],
    },
    compare: {
      note: 'Optional filters change the SQL text, but values still go through parameters.',
      wrong: 'sql += f" WHERE city = \'{city}\'"',
      fixed: 'sql += " WHERE city = ?"\nparams.append(city)',
    },
    stretch: 'Stretch: add an optional product filter to /orders that can be combined with the city filter using AND.',
  }, { calls: ['/orders/daily?city=Oslo', '/orders?city=Oslo'], view: { call: 0, kind: 'line' } }),
  fullstack({
    id: 'api-fullstack-post-row',
    number: 60,
    topic: 'POST a row',
    pipeline: ['POST JSON', 'validate with a model', 'INSERT and commit', 'reads see the new row'],
    goal:
      'Finish the POST /tickets route so it stores the new ticket with its minutes and answers 201, and check the open count grows by one. The API tab also posts a ticket after each run, so watch the Data and View tabs change.',
    why:
      'Writing is where the stack comes together: the frontend sends JSON, the model validates it, the route inserts a row, and every later read sees it. 201 Created tells the client a new thing exists now.',
    tasks: [
      'Store the ticket’s minutes in the new row',
      'Answer 201 Created for a new ticket',
      'Run, then check tickets in the Data tab and the chart in View',
    ],
    code: `# Full-stack data — POST a row
import playdb
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

db = playdb.connect()
playdb.load(db, "tickets")
app = FastAPI()

class NewTicket(BaseModel):
    topic: str
    minutes: int

@app.post("/tickets", status_code=???)
def create(ticket: NewTicket):
    new_id = db.execute("SELECT MAX(id) + 1 FROM tickets").fetchone()[0]
    db.execute(
        "INSERT INTO tickets (id, topic, status, minutes) VALUES (?, ?, 'open', ?)",
        (new_id, ticket.topic, ???),
    )
    db.commit()
    return {"id": new_id, "topic": ticket.topic}

@app.get("/tickets/open-by-topic")
def open_by_topic():
    rows = db.execute(
        "SELECT topic, COUNT(*) AS open FROM tickets WHERE status = 'open' GROUP BY topic ORDER BY topic"
    ).fetchall()
    return {row["topic"]: row["open"] for row in rows}

client = TestClient(app)
before = sum(client.get("/tickets/open-by-topic").json().values())
created = client.post("/tickets", json={"topic": "billing", "minutes": 12})
print(created.status_code, created.json()["id"])
after = sum(client.get("/tickets/open-by-topic").json().values())
print("open tickets grew by", after - before)
`,
    codeIncludes: ['status_code=201', 'ticket.minutes'],
    printPatterns: ['^201 31$', '^open tickets grew by 1$'],
    hints: [
      '201 means Created. Pass it to the decorator, the same way the default 200 would be.',
      'The model instance holds the parsed JSON: ticket.topic and ticket.minutes.',
    ],
    predict: {
      prompt: 'The run posts one ticket and the API tab posts another. How many rows does the Data tab show?',
      answer: '32: the 30 practice tickets plus both new ones',
      distractors: ['30, the posts are not saved', '31, only the code’s post counts'],
    },
    compare: {
      note: 'Bind the parsed fields, not the raw JSON text. The model already checked the types.',
      wrong: 'db.execute(f"INSERT INTO tickets VALUES ({new_id}, \'{ticket.topic}\', \'open\', {ticket.minutes})")',
      fixed: 'db.execute("INSERT INTO tickets VALUES (?, ?, \'open\', ?)", (new_id, ticket.topic, ticket.minutes))',
    },
    stretch: 'Stretch: add PATCH /tickets/{id} that closes a ticket, then add the call in the API tab and watch the open chart shrink.',
  }, {
    calls: ['POST /tickets {"topic": "shipping", "minutes": 20}', '/tickets/open-by-topic'],
    view: { call: 1, kind: 'bar' },
  }),
  fullstack({
    id: 'api-fullstack-sandbox',
    number: 61,
    topic: 'Sandbox: all four datasets',
    pipeline: ['load every dataset', 'one route per question', 'compare in View', 'shuffle and rerun'],
    goal:
      'Load all four practice datasets in a loop, then explore: each route answers one question, and the View tab lets you switch between them. Change a query, add a route, or shuffle the data.',
    why:
      'A free sandbox is where the pieces become yours. Asking your own questions of familiar data is the fastest way to get fluent with SQL, routes and charts together.',
    tasks: [
      'Loop over the four dataset names',
      'Run and pick each route in the View tab',
      'Write one new route that answers your own question',
    ],
    code: `# Full-stack data — Sandbox: all four datasets
import playdb
from fastapi import FastAPI

db = playdb.connect()
TABLES = ["orders", "weather", "students", "tickets"]
for name in ???:
    playdb.load(db, name)

print(len(TABLES), "tables loaded")
print({name: db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in TABLES})

app = FastAPI()

def rows(sql, params=()):
    return [dict(row) for row in db.execute(sql, params).fetchall()]

@app.get("/orders/by-product")
def by_product():
    return rows("SELECT product, ROUND(SUM(amount), 2) AS revenue FROM orders GROUP BY product ORDER BY revenue DESC")

@app.get("/weather/average")
def average_temp():
    return rows("SELECT city, ROUND(AVG(temp_c), 1) AS temp_c, ROUND(SUM(rain_mm), 1) AS rain_mm FROM weather GROUP BY city")

@app.get("/students/top")
def top_students(limit: int = 5):
    return rows("SELECT name, ROUND(AVG(grade), 1) AS average FROM students GROUP BY name ORDER BY average DESC LIMIT ?", (limit,))

@app.get("/tickets/minutes")
def minutes_by_topic():
    return rows("SELECT topic, SUM(minutes) AS minutes FROM tickets GROUP BY topic ORDER BY minutes DESC")
`,
    codeIncludes: ['for name in TABLES'],
    printPatterns: ['^4 tables loaded$', "^\\{'orders': 40, 'weather': 28, 'students': 24, 'tickets': 30\\}$"],
    hints: [
      'TABLES already lists the four dataset names; loop over it.',
      'Each route returns a list of dicts with a text column and number columns, which is what the chart needs.',
    ],
    predict: {
      prompt: 'Why does the weather table have 28 rows?',
      answer: '4 cities times 7 days',
      distractors: ['It is random per seed', 'One row per hour of one day, plus four'],
    },
    compare: {
      note: 'Keep the list of tables in one place, so a new dataset is one edit instead of four.',
      wrong: 'playdb.load(db, "orders")\nplaydb.load(db, "weather")\n...',
      fixed: 'for name in TABLES:\n    playdb.load(db, name)',
    },
    stretch: 'Stretch: join students and their averages to list who is above the class average in every subject.',
  }, {
    calls: ['/orders/by-product', '/weather/average', '/students/top?limit=8', '/tickets/minutes'],
    view: { call: 0, kind: 'bar' },
  }),
]
