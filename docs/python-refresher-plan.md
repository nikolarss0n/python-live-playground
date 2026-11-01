**Here’s your 14-day Python refresher, starting with syntax and building toward a one-hour live-coding interview.** This assumes **60–90 minutes daily**; the interview format is still unconfirmed.

Each session follows the same sequence: **recall yesterday’s work → explain new syntax → guided exercise → independent attempt → review mistakes.** Early sessions include worked examples; later sessions gradually remove hints.

| Day | Refresh, in this order | Exercise and checkpoint |
|---|---|---|
| **1 — Basic syntax** | Running a Python file; indentation; colons; comments; variables; `str`, `int`, `float`, `bool`, `None`; conversions; `print`; f-strings; a simple `def` and `return`. | Write a function that formats a tool’s name, duration and success status. Explain each line and distinguish printing from returning. |
| **2 — Conditions and loops** | Comparisons; `if`/`elif`/`else`; `and`/`or`/`not`; truthiness; `is None`; `for`; `while`; `range`; `enumerate`; `break` and `continue`. | Count successful and failed runs. Handle an empty input and trace the loop aloud. |
| **3 — Lists, tuples and sets** | Creating collections; indexing; slicing; `append`; tuple unpacking; membership with `in`; sets and `.add()`. | Complete **`unique_ids`**, preserving order. Explain why you use both a set and a list. |
| **4 — Dictionaries and nested data** | Keys and values; indexing versus `.get()`; updating entries; `.items()`; lists of dictionaries; missing keys. | Complete **`latest_by_id`**. Handle repeated IDs and tied timestamps without changing the input. |
| **5 — Functions and mutation** | Parameters versus arguments; positional and keyword arguments; defaults; return values; scope; type hints; mutable objects; shallow copies; mutable-default pitfalls. | Split a record-processing task into small functions. Explain which operations modify existing objects. |
| **6 — Common problem-solving patterns** | String cleanup with `strip`, `split`, `join`; counting and grouping; comprehensions after ordinary loops; `sorted` with `key`; `Counter`; basic time and space complexity. | Find the three most-used tools in a log. Explain how ties are ordered and why repeated nested searches can be expensive. |
| **7 — Errors, debugging and tests** | Reading tracebacks; `try`/`except`/`finally`; `raise`; specific exceptions; assertions; pytest tests, parametrization and exception checks. | Validate records and test normal, empty and malformed inputs. Diagnose a deliberately broken implementation. [pytest guide](https://docs.pytest.org/en/stable/getting-started.html) |
| **8 — Modules, files and data models** | Imports; virtual environments and packages; `__main__`; `with open(...)`; JSON parsing; basic classes, `self`, `__init__` and dataclasses. | Read saved tool results from JSON and represent one result with a dataclass. Explain malformed JSON versus invalid record contents. |
| **9 — API-shaped tasks and retries** | Request/response data; status codes; timeouts; retryable versus permanent failures; bounded retries; backoff; idempotency. | Write a synchronous retry wrapper around a fake operation that fails twice, then succeeds. Test exhaustion and permanent failure. |
| **10 — Async fundamentals** | `async def`; `await`; coroutines; `asyncio.run`; creating tasks; concurrent execution; blocking versus non-blocking work. | Run three simulated tool calls sequentially, then concurrently. Explain where execution can pause. [asyncio guide](https://docs.python.org/3/library/asyncio.html) |
| **11 — Reliable async execution** | Concurrency limits; timeouts; cancellation; cleanup; per-task exceptions; preserving result order. | Build a small runner with at most two active calls. Return a result for each call, including failures. Use this day for foundation catch-up if needed. |
| **12 — Mock interview 1** | Collections, transformations, functions, edge cases and complexity. | Solve an unseen data-processing problem in **60 minutes**, without AI assistance. Review the solution afterward. |
| **13 — Mock interview 2** | Backend reliability, testing and follow-up requirements. | Solve an unseen tool-execution or retry problem in **60 minutes**, including a requirement change halfway through. |
| **14 — Consolidation** | Your recurring syntax mistakes, weak concepts and interview workflow. | Reimplement two previously difficult functions from memory. Check the coding environment and keep the final session light. |

For each mock, use **5 minutes to clarify → 5 to plan → 30 to implement → 15 to test/debug → 5 to explain trade-offs**. We’ll assess correctness, readable Python, edge cases, debugging and communication.

Keep three rules throughout:

- **Write from memory after the walkthrough:** recognising a solution is easier than producing one.
- **Keep a mistake log:** record the error, its cause and the correct pattern.
- **Prioritise fluency:** defer AWS setup, frameworks and advanced Python features until the core exercises feel comfortable.

Use the [official Python tutorial](https://docs.python.org/3/tutorial/) as a reference alongside practice.

**We’ll begin with Day 1: variables, basic types, indentation and a small function—then work toward `unique_ids`.**