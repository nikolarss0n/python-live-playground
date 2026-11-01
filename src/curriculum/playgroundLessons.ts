import type { LessonDraft } from '../examples'

/**
 * Playground: free space with no goal or checks. Plain Python, the practice database (playdb), FastAPI routes and the
 * Data · API · View tabs are all available, so anything from the lessons can be tried in one place.
 */
export const PLAYGROUND_DRAFTS: LessonDraft[] = [
  {
    id: 'playground',
    difficulty: 'playground',
    number: 1,
    topic: 'Everything is available',
    chapter: 'Playground',
    goal: 'Free space: write any Python. The practice database, FastAPI routes and the Data, API and View tabs are all here, with no goal to meet.',
    why: 'A place to try ideas from any lesson without a checklist.',
    tasks: [],
    code: `# Playground — write anything; nothing is checked.
# Data tab → Project data: pick the tables you want; they are loaded before every run.
# FastAPI: routes listed in the API tab are called after every run; View charts them.

import playdb
from fastapi import FastAPI

db = playdb.connect()

app = FastAPI()

@app.get("/revenue/by-city")
def revenue_by_city():
    rows = db.execute(
        "SELECT city, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue "
        "FROM orders GROUP BY city ORDER BY revenue DESC"
    ).fetchall()
    return [dict(row) for row in rows]

@app.get("/weather/{city}")
def weather(city: str):
    rows = db.execute("SELECT day, temp_c, rain_mm FROM weather WHERE city = ? ORDER BY day", (city,)).fetchall()
    return [dict(row) for row in rows]

numbers = [3, 1, 4, 1, 5, 9, 2, 6]
print(sorted(numbers), sum(numbers))
print({word: len(word) for word in "write anything you like".split()})
`,
    stretch: 'Try a route of your own, add it in the API tab, and chart it in View.',
    fullstack: {
      calls: ['/revenue/by-city', '/weather/Oslo'],
      view: { call: 0, y: 'revenue', kind: 'bar' },
      datasets: ['orders', 'weather'],
    },
  },
]
