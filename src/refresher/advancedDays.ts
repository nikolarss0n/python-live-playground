import type { CheckDefinition, ConsolidationDay, MockDay, MockVariant, PracticeDay, RefresherDay } from './types'

const PYTHON = { label: 'Official Python tutorial', url: 'https://docs.python.org/3/tutorial/' }
const ASYNCIO = { label: 'Coroutines, tasks and cancellation', url: 'https://docs.python.org/3/library/asyncio-task.html' }

const DATA_MOCKS: MockVariant[] = [
  {
    id: 'a', title: 'Meeting-room usage',
    prompt: 'Implement summarize_slots(bookings). Each booking has exactly room (nonempty str), start and end (nonnegative integer minutes, start < end). Sum booked minutes and count bookings per room. Return dictionaries with room, minutes and bookings, ordered by minutes descending then room ascending. Overlapping bookings count separately; this is usage accounting, not interval merging. Do not mutate input.',
    starter: 'def summarize_slots(bookings):\n    # Clarify the contract, plan, then implement and test.\n    raise NotImplementedError\n',
    requirements: ['[] returns []; reject a non-list or invalid booking with ValueError.', 'Booleans are not valid integer times; reject extra or missing keys and blank room names.', 'Example: [{"room":"B","start":0,"end":10},{"room":"A","start":5,"end":15}] → [{"room":"A","minutes":10,"bookings":1},{"room":"B","minutes":10,"bookings":1}].', 'Explain grouping, tie order, complexity and your edge-case tests.'],
  },
  {
    id: 'b', title: 'Warehouse adjustment ledger',
    prompt: 'Implement reconcile_stock(events). Each event has exactly item (nonempty str) and delta (integer, including zero and negatives). Return one dictionary per item with item, balance (sum of deltas) and changes (event count), sorted by item ascending. Keep items whose final balance is zero. Do not mutate input.',
    starter: 'def reconcile_stock(events):\n    # Clarify the contract, plan, then implement and test.\n    raise NotImplementedError\n',
    requirements: ['[] returns []; reject a non-list or malformed event with ValueError.', 'Reject booleans as deltas, blank item names, and extra or missing keys.', 'Example: [{"item":"pen","delta":3},{"item":"pen","delta":-3}] → [{"item":"pen","balance":0,"changes":2}].', 'Explain why negative stock is retained rather than silently corrected.'],
  },
  {
    id: 'c', title: 'Sensor summary ranking',
    prompt: 'Implement rank_readings(readings, limit=3). Each reading has exactly sensor (nonempty str) and value (finite int or float, excluding bool). Group by sensor and calculate the arithmetic mean. Return at most limit dictionaries with sensor, mean and samples, ordered by mean descending then sensor ascending. Do not round or mutate input.',
    starter: 'def rank_readings(readings, limit=3):\n    # Clarify the contract, plan, then implement and test.\n    raise NotImplementedError\n',
    requirements: ['Validate every reading even when limit is zero; [] returns [].', 'limit is a nonnegative integer excluding bool; invalid arguments or malformed readings raise ValueError.', 'Example: [{"sensor":"B","value":2},{"sensor":"A","value":1},{"sensor":"A","value":3}] → [{"sensor":"A","mean":2.0,"samples":2},{"sensor":"B","mean":2.0,"samples":1}].', 'Explain tie order, numeric validation and time/space complexity.'],
  },
]

const RELIABILITY_MOCKS: MockVariant[] = [
  {
    id: 'a', title: 'Batch job dispatcher',
    prompt: 'Implement dispatch_jobs(jobs, execute). jobs is a list of dictionaries with exactly job_id (nonempty str) and payload (dict). Validate the entire batch before executing anything. For each job call execute(payload) once and return {"job_id": id, "ok": True, "value": result}, or {"job_id": id, "ok": False, "error": exception_class_name} on an ordinary Exception. Preserve order and continue after a failed job. Do not change input.',
    starter: 'def dispatch_jobs(jobs, execute):\n    # Write tests as you build. Keep this signature for the later requirement.\n    raise NotImplementedError\n',
    requirements: ['[] returns []; malformed jobs raise ValueError before any execute call.', 'Use safe exception class names, not exception messages or tracebacks.', 'Example: two jobs with payloads {"n":2} and {"n":3}, execute=lambda p:p["n"]*2 → successful values 4 and 6 in order.'],
    followUp: {
      prompt: 'New requirement: duplicate job IDs represent retries of one logical job. Keep the same function signature.',
      requirements: ['An identical job_id and payload reuses the first result, including a failed result, without executing again.', 'The same job_id with a different payload returns {"job_id": id, "ok": False, "error": "conflict"} without execution.', 'Keep one output per input job in input order; other jobs still execute.'],
    },
  },
  {
    id: 'b', title: 'Named workflow steps',
    prompt: 'Implement run_plan(steps, handlers). steps is a list of dictionaries with exactly name (nonempty str) and input (dict). handlers maps names to callables. Validate the whole step list first. Execute each matching handler(input), preserving order. Return {"name": name, "ok": True, "value": result}; unknown names return {"name": name, "ok": False, "error": "unknown_handler"}; ordinary exceptions return the same shape with the exception class name. Do not mutate inputs.',
    starter: 'def run_plan(steps, handlers):\n    # Write tests as you build. Keep this signature for the later requirement.\n    raise NotImplementedError\n',
    requirements: ['[] returns []; malformed steps raise ValueError before any handler runs.', 'Independent steps continue after a failure or an unknown handler.', 'Example: handlers={"double":lambda p:p["n"]*2}; a double step with input {"n":3} returns value 6.'],
    followUp: {
      prompt: 'New requirement: a step may optionally contain depends_on, a list of earlier step indices. Keep the same function signature.',
      requirements: ['Default dependencies are []; every dependency must be an integer excluding bool with 0 <= index < current step index.', 'Validate all dependencies before executing any step; malformed dependencies raise ValueError.', 'If any dependency failed or was skipped, do not call that step; return {"name": name, "ok": False, "error": "dependency_failed"}. Independent steps still run.'],
    },
  },
  {
    id: 'c', title: 'Batch delivery with limited retries',
    prompt: 'Implement execute_batch(items, send, max_attempts=2). items is a list of dictionaries with exactly id (nonempty str) and body (str). send(item) returns an HTTP-like integer status. Retry only 503, up to max_attempts total calls for that item. Return one {"id": id, "status": final_status, "attempts": count} per item in order. All other statuses are final. Do not change input.',
    starter: 'def execute_batch(items, send, max_attempts=2):\n    # Write tests as you build. Keep this signature for the later requirement.\n    raise NotImplementedError\n',
    requirements: ['max_attempts is an integer from 1 to 3, excluding bool; validate it and the full item list before any sends.', '[] returns []; malformed items raise ValueError. send is a fixture that returns statuses, not a network call.', 'Example: one item receives 503 then 200 → {"id": original_id,"status":200,"attempts":2}. Permanent 403 gets one call.'],
    followUp: {
      prompt: 'New requirement: a 429 response pauses the entire batch. Keep the same function signature.',
      requirements: ['Return the 429 item with its actual status and attempt count; never retry 429.', 'Do not send any later items; return {"id": id, "status": None, "attempts": 0, "error": "paused"} for each.', 'Keep earlier results and output order; a later 503 must not restart a paused batch.'],
    },
  },
]

const ADVANCED_CONTENT: (Omit<PracticeDay, 'consolidation'> | MockDay | ConsolidationDay)[] = [
  {
    id: 'refresher-08', day: 8, kind: 'practice', support: 'partial', minutes: 75,
    title: 'Modules, files and data models',
    recall: 'From memory, validate a dictionary with a required nonempty text field. Name the exception for invalid contents.',
    concepts: [
      { term: 'Imports and modules', explanation: 'A module is a Python file or installed module. import json binds the module; from dataclasses import dataclass binds one name. Keep imports near the top.', example: 'import json\nfrom dataclasses import dataclass\nrecord = json.loads(\'{"ok": true}\')' },
      { term: 'Virtual environments and packages', explanation: 'On your own computer, a virtual environment isolates installed packages. Run these commands in a terminal, not in the Python editor. This browser already supplies Python and its standard library; no pip or AWS setup is needed.', example: '# Terminal only:\n# python -m venv .venv\n# .venv/bin/python -m pip install pytest\n# Windows: .venv\\Scripts\\python -m pip install pytest' },
      { term: '__main__', explanation: 'When a file is run as a script, __name__ is "__main__". An if guard keeps demonstration code from running on import. Browser code is executed as __main__, but there is no project-file tree.', example: 'def label():\n    return "demo"\n\nif __name__ == "__main__":\n    print(label())' },
      { term: 'with open', explanation: 'The context manager closes the file even if parsing raises. Files created here live in the worker’s temporary browser filesystem; Stop or refresh may discard them. They are not your computer’s files.', example: 'with open("/tmp/example.json", "w", encoding="utf-8") as file:\n    file.write(\'[{"tool":"search","duration_ms":12,"ok":true}]\')\nwith open("/tmp/example.json", encoding="utf-8") as file:\n    data = json.load(file)' },
      { term: 'JSON syntax versus record contents', explanation: 'JSON uses true, false and null. json.load reads a file; json.loads reads a string. Broken JSON raises JSONDecodeError. Valid JSON can still have missing fields or wrong types, which your validation rejects separately.', example: 'json.loads(\'{"ok": true}\')  # syntax succeeds\njson.loads(\'{"ok":\')       # JSONDecodeError\n# {"ok": "yes"} parses but violates a bool field.' },
      { term: 'Classes, self and __init__', explanation: 'A class defines an object. __init__ initializes each instance; self names that instance. Store fields as self.name to keep them on the object.', example: 'class Label:\n    def __init__(self, name):\n        self.name = name\n\nlabel = Label("search")\nprint(label.name)' },
      { term: 'Dataclasses', explanation: '@dataclass generates common methods, including __init__, from annotated fields. An annotation alone does not validate incoming JSON, so validate values before constructing the object.', example: '@dataclass\nclass Timing:\n    name: str\n    elapsed_ms: int\n\nprint(Timing("search", 12))' },
    ],
    workedExample: 'import json\nfrom dataclasses import dataclass\n\n@dataclass\nclass Label:\n    name: str\n\nwith open("/tmp/labels.json", "w", encoding="utf-8") as file:\n    json.dump([{"name": "alpha"}], file)\nwith open("/tmp/labels.json", encoding="utf-8") as file:\n    rows = json.load(file)\nlabels = [Label(row["name"]) for row in rows]\nprint(labels)\n',
    guidedStarter: 'import json\nfrom dataclasses import dataclass\n\n@dataclass\nclass ToolResult:\n    tool: str\n    duration_ms: int\n    ok: bool\n\ndef load_tool_results(path):\n    with open(path, encoding="utf-8") as file:\n        rows = json.load(file)\n    # Validate the array and each exact record before constructing results.\n    raise NotImplementedError("Validate rows and return ToolResult objects")\n',
    independentStarter: '# Rebuild the file reader and dataclass from memory.\n# Required: ToolResult(tool, duration_ms, ok), load_tool_results(path).\n',
    problem: 'Read a JSON array from path with with open. Return a list of ToolResult dataclass instances in file order. Each row must have exactly tool, duration_ms and ok. tool is nonblank str (preserve its text); duration_ms is a nonnegative int excluding bool; ok is bool. Invalid record contents raise ValueError. Preserve JSONDecodeError for malformed JSON and FileNotFoundError for a missing file.',
    acceptance: ['Valid arrays produce typed objects; [] produces [].', 'Malformed JSON and well-formed invalid records remain distinguishable exception types.', 'Read the supplied file each time, close it, and leave its contents unchanged.'],
    hints: ['First validate that rows is a list. Then validate each dictionary and its exact keys.', 'type(duration_ms) is int excludes True, which otherwise behaves like an int.', 'Construct ToolResult only after checking the row; return the collected objects after the loop.'],
    reviewPrompts: ['Explain import, self and __init__ without running code.', 'What did with guarantee when json.load failed?', 'Which commands require a terminal, and where do browser-created files live?'],
    resources: [PYTHON, { label: 'Reading files and JSON', url: 'https://docs.python.org/3/tutorial/inputoutput.html' }, { label: 'Dataclasses', url: 'https://docs.python.org/3/library/dataclasses.html' }],
    checks: [{ id: 'file-models', label: 'Load real JSON files into dataclasses' }, { id: 'json-boundaries', label: 'Distinguish syntax errors from invalid records' }, { id: 'file-lifecycle', label: 'Close the supplied file without changing it' }],
  },
  {
    id: 'refresher-09', day: 9, kind: 'practice', support: 'partial', minutes: 75,
    title: 'API-shaped tasks and retries',
    recall: 'Explain the difference between invalid JSON and a well-formed response containing an error status.',
    concepts: [
      { term: 'Requests and responses', explanation: 'A request carries a method, path, headers or body; a response has a status and body. Our operation is a fake callable, not an HTTP client.', example: 'request = {"method": "POST", "path": "/jobs", "body": {"tool": "search"}}\nresponse = {"status": 200, "body": {"job_id": "j1"}}' },
      { term: 'Status codes and failure classes', explanation: '2xx indicates success. 400/401/403/422 need input or permission fixes. For this exercise only 429, 503 and 504 are retryable; classify failures before repeating work.', example: 'retryable = {429, 503, 504}\nshould_retry = response["status"] in retryable' },
      { term: 'Timeouts', explanation: 'A synchronous blocking operation needs its own client timeout. This wrapper cannot interrupt an arbitrary blocked function. It catches TimeoutError from the injected fake and maps it to a 504 fixture response.', example: 'try:\n    response = operation("request-1")\nexcept TimeoutError:\n    response = {"status": 504, "body": {"error": "timeout"}}' },
      { term: 'Bounded attempts and backoff', explanation: 'An attempt includes the first call. Wait only if another retry is allowed. Inject sleep so tests can record 0.1, 0.2, ... seconds without actually waiting.', example: 'delays = []\nsleep = delays.append\nsleep(0.1)\nprint(delays)' },
      { term: 'Idempotency', explanation: 'Retries must reuse the same logical operation key. A receiving service must actually implement deduplication; merely sending a key does not make a write safe. Our exercise uses local fixtures and performs no real writes.', example: 'operation("request-1")\n# An authorized retry reuses "request-1", not a newly generated key.' },
    ],
    workedExample: 'responses = iter([{"status": 503}, {"status": 200}])\nfirst = next(responses)\nif first["status"] == 503:\n    second = next(responses)\n    print(second)\n# This two-call demonstration still lacks a reusable loop, budget and backoff.\n',
    guidedStarter: 'def retry_request(operation, sleep, max_attempts=3, idempotency_key="request-1"):\n    # Validate a 1..5 integer budget and a nonempty text key first.\n    # Call operation(idempotency_key); inspect each response before retrying.\n    raise NotImplementedError\n',
    independentStarter: 'def retry_request(operation, sleep, max_attempts=3, idempotency_key="request-1"):\n    raise NotImplementedError\n',
    problem: 'Return {"attempts": count, "response": last_response}. Retry only statuses 429/503/504 and TimeoutError, converted to {"status":504,"body":{"error":"timeout"}}. Return other responses unchanged immediately. Use 1..5 total attempts, exponential delays 0.1 * 2 ** retry_index before retries, and the same nonempty string idempotency_key on every call. Invalid budget/key raises ValueError before any operation. Let unexpected exceptions propagate.',
    acceptance: ['A fake that fails twice then succeeds makes three calls and records delays [0.1, 0.2].', 'Exhaustion returns the last failure; permanent failures make one call; no sleep occurs after the final attempt.', 'TimeoutError is handled, unexpected exceptions remain visible, and the operation key never changes.'],
    hints: ['Use a for loop over max_attempts, not an unlimited while loop.', 'Return when the status is permanent or the current attempt is the last.', 'Inject delays.append as sleep; assert the list and the operation-call count.'],
    reviewPrompts: ['Why is retrying an authorization denial unhelpful?', 'What must the remote service do for an idempotency key to protect a write?', 'Why does this wrapper not impose a hard timeout on a synchronous callable?'],
    resources: [PYTHON],
    checks: [{ id: 'retry-recovery', label: 'Recover after two failures with measured backoff' }, { id: 'retry-stop', label: 'Stop on exhaustion and permanent failures' }, { id: 'retry-contract', label: 'Preserve the key and validate the retry boundary' }],
  },
  {
    id: 'refresher-10', day: 10, kind: 'practice', support: 'minimal', minutes: 75,
    title: 'Async fundamentals',
    recall: 'Write the retry budget and explain which work is blocking. Name one safe place to pause.',
    concepts: [
      { term: 'async def and coroutine objects', explanation: 'Calling an async function creates a coroutine. It does not finish the work immediately. Await it or schedule it as a task.', example: 'async def one():\n    return 1\n\n# pending = one() creates a coroutine; result = await one() runs it.' },
      { term: 'await and non-blocking waits', explanation: 'await pauses the current coroutine while other tasks may run. asyncio.sleep yields; time.sleep blocks the event-loop thread. CPU-heavy work does not become parallel just because it sits inside async def.', example: 'async def tool():\n    await asyncio.sleep(0.01)\n    return "done"' },
      { term: 'Sequential versus concurrent', explanation: 'Awaiting call A before creating B is sequential. Scheduling all three first allows independent waits to overlap. Keep output order explicit.', example: '# Sequential inside an async function:\n# a = await first(); b = await second()\n# Concurrent:\n# a, b = await asyncio.gather(first(), second())' },
      { term: 'Creating tasks', explanation: 'asyncio.create_task schedules a coroutine and returns a Task. Keep the task reference and await its result; do not leave forgotten background tasks.', example: 'async def paired(first, second):\n    left = asyncio.create_task(first())\n    right = asyncio.create_task(second())\n    return await asyncio.gather(left, right)' },
      { term: 'asyncio.run and the environment', explanation: 'A normal command-line script can start its event loop with asyncio.run(main()) under __main__. The browser already owns a running event loop: define async functions here and let checks await them; do not nest asyncio.run.', example: '# Terminal Python file only:\n# if __name__ == "__main__":\n#     asyncio.run(main())' },
    ],
    workedExample: 'import asyncio\n\nasync def say_word(word):\n    await asyncio.sleep(0.01)\n    return word\n\nasync def pair():\n    tasks = [asyncio.create_task(say_word(word)) for word in ("hello", "world")]\n    return await asyncio.gather(*tasks)\n# The browser checker awaits coroutines; CLI scripts may use asyncio.run(pair()).\n',
    guidedStarter: 'import asyncio\n\nasync def run_sequential(calls):\n    # calls contains zero-argument async functions, not already-used coroutines.\n    raise NotImplementedError\n\nasync def run_concurrent(calls):\n    raise NotImplementedError\n',
    independentStarter: 'import asyncio\n\nasync def run_sequential(calls):\n    raise NotImplementedError\n\nasync def run_concurrent(calls):\n    raise NotImplementedError\n',
    problem: 'Implement both async functions for a list of zero-argument async callables. Run three simulated calls sequentially in run_sequential and concurrently in run_concurrent. Return their values in input order, regardless of completion order. Call each exactly once; an empty input returns []. Ordinary task errors must remain visible rather than become invented results.',
    acceptance: ['Sequential calls start only after the previous call finishes.', 'All three concurrent calls can start before any must finish; returned order matches input order.', 'Empty inputs work and a failing callable raises its original exception.'],
    hints: ['An ordinary loop with await is enough for the sequential version.', 'Create tasks before awaiting their results, or use gather on all fresh coroutines.', 'Use small asyncio.sleep calls to demonstrate overlap; do not compare fragile wall-clock thresholds.'],
    reviewPrompts: ['Point to every await and explain what can run while it pauses.', 'How are a coroutine object and a Task different?', 'Where can asyncio.run be called, and why not inside this browser loop?'],
    resources: [ASYNCIO],
    checks: [{ id: 'async-sequential', label: 'Run three calls in sequence' }, { id: 'async-concurrent', label: 'Overlap three calls while preserving result order' }, { id: 'async-boundaries', label: 'Handle empty work and expose task failures' }],
  },
  {
    id: 'refresher-11', day: 11, kind: 'practice', support: 'minimal', minutes: 75,
    title: 'Reliable async execution',
    recall: 'Rebuild run_concurrent from memory and explain why gathering three calls does not impose a concurrency limit.',
    concepts: [
      { term: 'Concurrency limit', explanation: 'asyncio.Semaphore(2) admits at most two active operations. Acquire it before starting each operation, not after creating all operation tasks.', example: 'async with semaphore:\n    result = await call()' },
      { term: 'Per-call timeouts', explanation: 'Use wait_for while holding the semaphore. The timeout begins when the call starts, not while it waits in the queue. A timeout cancels the call and waits for its cancellation handling.', example: 'async with semaphore:\n    result = await asyncio.wait_for(call(), timeout=timeout_s)' },
      { term: 'Cancellation and cleanup', explanation: 'finally releases resources on success, error and cancellation. Do not turn CancelledError from an external cancellation into success; let it propagate after cleanup.', example: 'async def operation():\n    try:\n        await asyncio.sleep(1)\n    finally:\n        release_local_resource()  # conceptual cleanup helper' },
      { term: 'One result per input', explanation: 'Catch ordinary exceptions inside the per-item wrapper, then gather wrappers in input order. Report a safe exception class name, not the raw message.', example: 'try:\n    value = await call()\nexcept Exception as error:\n    return {"ok": False, "error": type(error).__name__}' },
      { term: 'Catch-up is a valid session', explanation: 'If loops, functions or Day 10 still feel uncertain, use today to rebuild those foundations. Keep the mistake log; return to this runner later. Do not claim completion of the runner until its checks pass.', example: '# Catch-up: rewrite a previous function from memory,\n# test an empty input, explain a failure, then retry Day 11.' },
    ],
    workedExample: 'import asyncio\n\nasync def one_result(call):\n    try:\n        return {"ok": True, "value": await call()}\n    except Exception as error:\n        return {"ok": False, "error": type(error).__name__}\n# This wrapper still needs the semaphore, timeout and ordered gathering.\n',
    guidedStarter: 'import asyncio\n\nasync def run_limited(calls, timeout_s=0.05):\n    # Validate the timeout, create a semaphore, then wrap each call.\n    raise NotImplementedError\n',
    independentStarter: 'import asyncio\n\nasync def run_limited(calls, timeout_s=0.05):\n    raise NotImplementedError\n',
    problem: 'Run zero-argument async callables with at most two active calls. Return ordered results: {"ok":True,"value":value}, {"ok":False,"error":"timeout"}, or {"ok":False,"error": exception_class_name}. Each call gets timeout_s only after admission. Cancel and await timed-out work, preserve external cancellation, and continue other calls after an ordinary failure. timeout_s must be a positive finite int/float excluding bool; invalid values raise ValueError before starting work. Catch-up option: revisit a weak foundation today and return to this runner later.',
    acceptance: ['At most two calls overlap, both slots can be used, and all results remain in input order.', 'Ordinary errors produce per-call failures; [] returns [].', 'Timed-out calls finish cancellation cleanup before return; external cancellation is not swallowed.'],
    hints: ['Create one semaphore per run and use async with inside each wrapper.', 'Catch TimeoutError separately, then Exception; do not catch BaseException.', 'Use gather on the wrappers. Let wait_for cancel and await the underlying call.'],
    reviewPrompts: ['What counts as active work versus queued work?', 'Why must cleanup complete before the runner returns?', 'Was today better used for catch-up? Record the specific concept and one next practice.'],
    resources: [ASYNCIO],
    checks: [{ id: 'limited-concurrency', label: 'Use at most two active calls' }, { id: 'limited-results', label: 'Preserve ordered success and failure results' }, { id: 'limited-cleanup', label: 'Await timeout cleanup and preserve cancellation' }],
  },
  {
    id: 'refresher-12', day: 12, kind: 'mock', minutes: 60,
    title: 'Mock interview 1', recall: 'Recall your workflow, not a memorized solution. The selected problem is revealed only when you start.',
    concepts: [
      { term: 'After-mock reflection', explanation: 'After finishing, assess correctness, readable Python, edge cases, debugging and communication. Use evidence from your code and tests rather than a single pass/fail label.', example: '# Which assumption did I clarify? Which test changed my implementation?' },
    ],
    workedExample: '# Available after finishing: use a tiny input to trace your own loop and compare it with the contract.\n',
    guidedStarter: '', independentStarter: '',
    problem: 'Complete one unseen data-processing variant in 60 minutes without AI assistance. Spend 5 minutes clarifying, 5 planning, 30 implementing, 15 testing/debugging and 5 explaining trade-offs. Replaying a seen variant is practice, not an unseen mock.',
    acceptance: ['Clarify inputs, output ordering and invalid-data behavior before coding.', 'Write and run normal, empty, tie and malformed-input cases.', 'Explain time/space complexity and one trade-off after implementation.'],
    hints: [], reviewPrompts: ['Which requirement was unclear and how did you resolve it?', 'Which edge case found a real bug?', 'What would you simplify after the interview?'],
    resources: [PYTHON], variants: DATA_MOCKS,
    checks: [{ id: 'mock-valid', label: 'Meet the main transformation contract' }, { id: 'mock-boundaries', label: 'Handle empty inputs, ties and boundaries' }, { id: 'mock-inputs', label: 'Validate inputs without mutating them' }],
  },
  {
    id: 'refresher-13', day: 13, kind: 'mock', minutes: 60,
    title: 'Mock interview 2', recall: 'Recall how to make failures explicit and keep tests readable. The problem and later change remain undisclosed until their scheduled times.',
    concepts: [{ term: 'After-mock requirement review', explanation: 'After finishing, compare the original contract with the changed requirement. Check which tests stayed valid and which new ones protected the change.', example: '# Describe the requirement delta, its implementation and the regression tests.' }],
    workedExample: '# After finishing, trace one allowed call, one failure and the follow-up condition through your own solution.\n',
    guidedStarter: '', independentStarter: '',
    problem: 'Complete one unseen backend-reliability variant in 60 minutes without AI assistance. Follow 5/5/30/15/5 minutes for clarify/plan/implement/test/explain. At minute 30, adapt to a new requirement while keeping the public function signature. A repeated variant must be labeled as seen practice.',
    acceptance: ['Make the original behavior work and test before the change.', 'At minute 30, explain the new requirement and add regression coverage.', 'Keep failures explicit and explain the final control flow and trade-offs.'],
    hints: [], reviewPrompts: ['What changed at minute 30?', 'Which existing behavior did your new tests protect?', 'Where did you lose time: syntax, reasoning, testing or explanation?'],
    resources: [PYTHON], variants: RELIABILITY_MOCKS,
    checks: [{ id: 'mock-execution', label: 'Execute valid work and preserve result order' }, { id: 'mock-failures', label: 'Contain failures and validate before execution' }, { id: 'mock-follow-up', label: 'Meet the active reliability requirements' }],
  },
  {
    id: 'refresher-14', day: 14, kind: 'consolidation', minutes: 60,
    title: 'Consolidation and a light final session',
    recall: 'Choose two previously difficult functions from Days 1–11 using your mistake log. Name the difficulty before opening any old code.',
    concepts: [
      { term: 'Recall before rereading', explanation: 'Reimplement both selected functions from memory, test them, then compare with previous attempts. This session checks fluency in existing material rather than adding advanced topics.', example: '# Function 1: what is its input/output contract?\n# Function 2: what edge case caused difficulty?' },
      { term: 'Mistake patterns', explanation: 'Group recurring mistakes by syntax, data handling, mutation, control flow, testing and explanation. Record the cause and a correct pattern for each.', example: '# Error: shared mutable default.\n# Cause: one list reused across calls.\n# Pattern: default to None and create a fresh list.' },
      { term: 'Environment check', explanation: 'Confirm you can edit, run, stop and read a traceback. If your interview uses local Python, check the approved interpreter and test command in advance. The interview format is still unconfirmed.', example: '# Local terminal, when relevant:\n# python --version\n# python -m pytest\n# Browser: run print("ready"), stop a loop, and reload your saved work.' },
      { term: 'Keep it light', explanation: 'Use 5 minutes to recall, 5 to review selected contracts, 30 to rebuild two functions, 15 to test/review and 5 to check the environment. Defer new frameworks or AWS setup.', example: '# Finish with two explained functions and a short checklist, not a new feature.' },
    ],
    workedExample: '# Your selected previous functions supply the contracts. Hide their old implementations until after your independent attempt.\n',
    guidedStarter: '', independentStarter: '',
    problem: 'Select two different difficult functions from Days 1–11 and reimplement them from memory. The selected days supply the real behavior checks. Review recurring mistakes, practise explaining your choices, and check the likely coding environment. Keep the session to a light 60 minutes.',
    acceptance: ['Choose two distinct previous practice days and state why each was difficult.', 'Rebuild and test both functions before consulting old code.', 'Record one correction per function and complete the environment check.'],
    hints: [], reviewPrompts: ['What can you now produce without a walkthrough?', 'Which mistake still needs a small repeat exercise?', 'Can you run tests and explain a traceback in the intended environment?'],
    resources: [PYTHON], checks: [],
  },
]

const CONSOLIDATION_TARGETS: Record<string, {
  functionName: string
  starter: string
  problem?: string
  checks?: CheckDefinition[]
}> = {
  'refresher-08': {
    functionName: 'load_tool_results',
    starter: 'import json\nfrom dataclasses import dataclass\n\n@dataclass\nclass ToolResult:\n    tool: str\n    duration_ms: int\n    ok: bool\n\ndef load_tool_results(path):\n    """Read validated ToolResult objects from the supplied JSON file."""\n    pass\n',
    problem: 'Implement load_tool_results(path) using with open and json.load. Return ToolResult instances in file order. Each JSON array row has exactly tool (nonblank str, preserved), duration_ms (nonnegative int excluding bool), and ok (bool). [] returns []. Invalid record contents raise ValueError; malformed JSON preserves JSONDecodeError and missing paths preserve FileNotFoundError. Close the file on every path and do not change its contents. The dataclass boilerplate is supplied.',
  },
  'refresher-09': {
    functionName: 'retry_request',
    starter: 'def retry_request(operation, sleep, max_attempts=3, idempotency_key="request-1"):\n    """Return the final response and attempt count under the retry contract."""\n    pass\n',
    problem: 'Implement retry_request(operation, sleep, max_attempts=3, idempotency_key="request-1"). Call operation(key) and return {"attempts": count, "response": last_response}. Retry only 429/503/504 and TimeoutError mapped to {"status":504,"body":{"error":"timeout"}}. Use 1..5 total attempts, stable nonempty text key, and delays 0.1, 0.2, ... only before retries. Return other responses immediately; propagate unexpected exceptions. Invalid budget or key raises ValueError before any operation or sleep.',
  },
  'refresher-10': {
    functionName: 'run_concurrent',
    starter: 'import asyncio\n\nasync def run_concurrent(calls):\n    """Run fresh async callables concurrently and return values in input order."""\n    pass\n',
    problem: 'Implement async run_concurrent(calls) for a list of zero-argument async callables. Start all calls concurrently, call each exactly once, and return values in input order even when completion order differs. [] returns []. Preserve original ordinary exceptions instead of inventing success values. Do not call asyncio.run inside the browser. A sequential companion function is not required for this consolidation target.',
    checks: [
      { id: 'async-concurrent', label: 'Overlap three calls while preserving result order' },
      { id: 'concurrent-boundaries', label: 'Handle empty and single-call workloads' },
      { id: 'concurrent-errors', label: 'Expose the original task failure' },
    ],
  },
  'refresher-11': {
    functionName: 'run_limited',
    starter: 'import asyncio\nimport math\n\nasync def run_limited(calls, timeout_s=0.05):\n    """Return ordered per-call results with a two-call limit and timeout cleanup."""\n    pass\n',
    problem: 'Implement async run_limited(calls, timeout_s=0.05) for zero-argument async callables. Admit at most two active calls, with each timeout starting after admission. Return ordered {"ok":True,"value":value}, {"ok":False,"error":"timeout"}, or {"ok":False,"error":exception_class_name}; [] returns []. Await timeout cleanup, preserve external CancelledError, and continue after ordinary per-call failures. Require a positive finite int/float timeout excluding bool; invalid values raise ValueError before work starts.',
  },
}

export const ADVANCED_DAYS: RefresherDay[] = ADVANCED_CONTENT.map((day) => {
  if (day.kind !== 'practice') return day
  const target = CONSOLIDATION_TARGETS[day.id]
  if (!target) throw new Error(`Missing consolidation target for ${day.id}`)
  return {
    ...day,
    consolidation: {
      functionName: target.functionName,
      starter: target.starter,
      problem: target.problem ?? day.problem,
      checks: (target.checks ?? day.checks).map((check) => ({ ...check, label: `${target.functionName}: ${check.label}` })),
    },
  }
})
