"""Practice datasets and one shared in-memory SQLite database for the full-stack lessons.

Datasets are generated from a seed, so Shuffle in the Data tab gives new but repeatable rows. After every run the
playground reads the tables of the connection made with connect() and shows them in the Data tab.
"""

import random
import sqlite3
from datetime import date, timedelta

SEED = 1
_connection = None

CITIES = ["Berlin", "Lisbon", "Oslo", "Paris"]
PRODUCTS = {"Tent": (60, 180), "Lamp": (12, 40), "Stove": (35, 90), "Mat": (15, 55)}
SUBJECTS = ["Maths", "History", "Biology"]
STUDENTS = ["Ada", "Alan", "Grace", "Linus", "Margaret", "Tim", "Katherine", "Guido"]
TOPICS = ["shipping", "billing", "product", "account"]
CITY_TEMP = {"Berlin": 9, "Lisbon": 18, "Oslo": 4, "Paris": 12}

COLUMNS = {
    "orders": [("id", "INTEGER"), ("day", "TEXT"), ("city", "TEXT"), ("product", "TEXT"), ("amount", "REAL")],
    "weather": [("day", "TEXT"), ("city", "TEXT"), ("temp_c", "REAL"), ("rain_mm", "REAL")],
    "students": [("name", "TEXT"), ("subject", "TEXT"), ("grade", "INTEGER")],
    "tickets": [("id", "INTEGER"), ("topic", "TEXT"), ("status", "TEXT"), ("minutes", "INTEGER")],
}


def configure(seed=1):
    """Set the seed for the next rows() calls and drop the previous run's database."""
    global SEED, _connection
    SEED = int(seed)
    if _connection is not None:
        _connection.close()
    _connection = None


def _days(count=7):
    first = date(2026, 10, 1)
    return [(first + timedelta(days=offset)).isoformat() for offset in range(count)]


def rows(name):
    """The rows of one practice dataset as a list of dicts: orders, weather, students or tickets."""
    rng = random.Random(f"{name}:{SEED}")
    if name == "orders":
        days = _days()
        out = []
        for order_id in range(1, 41):
            product = rng.choice(list(PRODUCTS))
            low, high = PRODUCTS[product]
            out.append({
                "id": order_id,
                "day": rng.choice(days),
                "city": rng.choice(CITIES),
                "product": product,
                "amount": round(rng.uniform(low, high), 2),
            })
        return sorted(out, key=lambda row: (row["day"], row["id"]))
    if name == "weather":
        return [
            {
                "day": day,
                "city": city,
                "temp_c": round(CITY_TEMP[city] + rng.uniform(-4, 4), 1),
                "rain_mm": round(max(0.0, rng.gauss(2, 3)), 1),
            }
            for day in _days()
            for city in CITIES
        ]
    if name == "students":
        return [
            {"name": student, "subject": subject, "grade": rng.randint(52, 100)}
            for student in STUDENTS
            for subject in SUBJECTS
        ]
    if name == "tickets":
        return [
            {
                "id": ticket_id,
                "topic": rng.choice(TOPICS),
                "status": rng.choice(["open", "closed", "closed"]),
                "minutes": rng.randint(5, 90),
            }
            for ticket_id in range(1, 31)
        ]
    raise ValueError(f"unknown dataset {name!r}; choose one of {', '.join(COLUMNS)}")


def connect():
    """The shared in-memory database for this run. Rows come back as sqlite3.Row, so dict(row) works."""
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(":memory:")
        _connection.row_factory = sqlite3.Row
    return _connection


def load(db, name):
    """Create table `name` with its columns and insert the dataset's rows once. Returns the table's row count."""
    columns = COLUMNS[name]
    db.execute(f"CREATE TABLE IF NOT EXISTS {name} ({', '.join(f'{col} {kind}' for col, kind in columns)})")
    existing = db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    if existing:
        return existing
    data = rows(name)
    placeholders = ", ".join("?" for _ in columns)
    db.executemany(
        f"INSERT INTO {name} VALUES ({placeholders})",
        [tuple(row[col] for col, _ in columns) for row in data],
    )
    db.commit()
    return len(data)


def snapshot(limit=100):
    """Tables of the shared database for the Data tab: name, columns, first rows and row count."""
    if _connection is None:
        return []
    tables = []
    try:
        names = [row[0] for row in _connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        for name in names:
            info = _connection.execute(f'PRAGMA table_info("{name}")').fetchall()
            columns = [{"name": col[1], "type": col[2] or ""} for col in info]
            count = _connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
            data = [
                [value.hex() if isinstance(value, bytes) else value for value in row]
                for row in _connection.execute(f'SELECT * FROM "{name}" LIMIT {int(limit)}')
            ]
            tables.append({"name": name, "columns": columns, "rows": data, "count": count})
    except sqlite3.Error:
        return tables
    return tables
