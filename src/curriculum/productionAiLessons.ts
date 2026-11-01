import type { LessonDraft } from '../examples'

/**
 * Browser-local simulations of production AI service patterns.
 *
 * These lessons model contracts and control flow with ordinary Python data.
 * They do not claim to contact a real server, identity provider, or model.
 */
export const PRODUCTION_AI_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'api-schema-validation',
    difficulty: 'api',
    number: 10,
    topic: 'Schema validation',
    chapter: 'Contracts & validation',
    goal:
      'Accept a non-empty name with max_tokens from 1 through 512, then visibly reject 513 and an unexpected field.',
    why:
      'Model and API inputs are untrusted; deterministic validation keeps malformed or oversized requests away from expensive work.',
    tasks: [
      'Enforce the inclusive max_tokens boundary',
      'Reject fields outside the request contract',
      'Run valid, boundary, oversized, and extra-field cases',
    ],
    taskInstructions: [
      'Replace ??? with 512 so both 1 and 512 are accepted while 0, booleans, and 513 remain invalid.',
      'Keep the allowed-field set and unexpected-field calculation intact so unknown input cannot silently pass through.',
      'Inspect all four printed results: two must be valid, one must name max_tokens, and one must name unexpected.',
    ],
    code: `# Lesson 10 — Schema validation
# This is a local dictionary validator, not a live web server.

def validate_request(payload):
    errors = []

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("name must be non-empty text")

    max_tokens = payload.get("max_tokens")
    if (
        not isinstance(max_tokens, int)
        or isinstance(max_tokens, bool)
        or not 1 <= max_tokens <= ???
    ):
        errors.append("max_tokens must be an integer from 1 to 512")

    allowed = {"name", "max_tokens"}
    unexpected = sorted(set(payload) - allowed)
    if unexpected:
        errors.append(f"unexpected fields: {unexpected}")

    return {"valid": not errors, "errors": errors}

cases = {
    "normal": {"name": "Ada", "max_tokens": 120},
    "boundary": {"name": "Ada", "max_tokens": 512},
    "oversized": {"name": "Ada", "max_tokens": 513},
    "extra": {"name": "Ada", "max_tokens": 120, "admin": True},
}

for label, payload in cases.items():
    print(label, validate_request(payload))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['isinstance', 'unexpected', '1 <= max_tokens <='],
      printPatterns: [
        "normal.*'valid': True",
        "boundary.*'valid': True",
        "oversized.*max_tokens",
        "extra.*unexpected",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'The upper boundary belongs in the chained comparison: 1 <= max_tokens <= 512.',
      'Remember that bool is a subclass of int in Python, so reject it explicitly.',
    ],
    predict: {
      prompt: 'With an inclusive limit of 512, which value should still be accepted?',
      choices: ['512', '513', 'True'],
      correctIndex: 0,
    },
    compare: {
      note: 'Checking only that a key exists does not validate its type, range, or neighboring fields.',
      wrong: 'if "max_tokens" in payload:\n    return {"valid": True}',
      fixed:
        'if isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 512:\n    ...',
    },
    stretch:
      'Stretch: add a mode field that accepts only "fast" or "careful", then print one rejected mode.',
    pipeline: ['receive local dict', 'validate type & range', 'reject extras', 'accept or explain'],
  },
  {
    id: 'api-error-contracts',
    difficulty: 'api',
    number: 11,
    topic: 'Error contracts',
    chapter: 'Contracts & validation',
    goal:
      'Return 422, 404, and 503 failures with the same nested error shape and preserve a visible request id in every case.',
    why:
      'Stable machine-readable errors let clients retry, display, and diagnose failures without parsing changing prose.',
    tasks: [
      'Preserve the request id in the shared error helper',
      'Create three failures through the same contract',
      'Prove every error body exposes identical keys',
    ],
    taskInstructions: [
      'Replace ??? with request_id so the correlation value supplied by the caller is copied into the nested error object.',
      'Leave validation_error, missing_error, and provider_error using api_error rather than returning unrelated dictionaries.',
      'Check that the three statuses print as 422, 404, and 503 and that same_shape prints True for all error bodies.',
    ],
    code: `# Lesson 11 — Error contracts
# These dictionaries simulate HTTP-shaped failures in the browser.

def api_error(status, code, message, request_id):
    return {
        "status": status,
        "body": {
            "error": {
                "code": code,
                "message": message,
                "request_id": ???,
            }
        },
    }

validation_error = api_error(422, "invalid_request", "question is required", "req-7")
missing_error = api_error(404, "document_not_found", "document d9 was not found", "req-8")
provider_error = api_error(503, "provider_unavailable", "try again later", "req-9")

errors = [validation_error, missing_error, provider_error]
for item in errors:
    print(item)

expected_keys = {"code", "message", "request_id"}
same_shape = all(set(item["body"]["error"]) == expected_keys for item in errors)
print({"same_shape": same_shape, "statuses": [item["status"] for item in errors]})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def api_error', '"request_id"', 'same_shape'],
      printPatterns: [
        "'status': 422",
        "'status': 404",
        "'status': 503",
        "'same_shape': True",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'The helper already receives request_id; copy that variable into the returned dictionary.',
      'Error codes should stay stable even when human-facing messages change.',
    ],
    predict: {
      prompt: 'Which error field is most useful for reliable client branching?',
      choices: ['A stable code', 'A changing sentence', 'Dictionary print order'],
      correctIndex: 0,
    },
    compare: {
      note: 'One shared envelope is easier for both people and programs to understand.',
      wrong: 'return {"message": "bad"}  # every route invents a shape',
      fixed:
        'return {"status": 422, "body": {"error": {"code": "invalid_request", "message": "...", "request_id": request_id}}}',
    },
    stretch:
      'Stretch: add a retryable boolean that is True only for the simulated 503 provider failure.',
    pipeline: ['detect failure', 'choose status & code', 'build shared envelope', 'return traceable error'],
  },
  {
    id: 'api-idempotency',
    difficulty: 'api',
    number: 12,
    topic: 'Idempotency',
    chapter: 'Reliability & access',
    goal:
      'Create one job for two identical keyed requests, mark the second as replayed, and return 409 when the key is reused with different input.',
    why:
      'Retries are unavoidable, so write operations need idempotency keys to prevent duplicated jobs, charges, or tool actions.',
    tasks: [
      'Store the first response under its idempotency key',
      'Replay an identical request without creating again',
      'Reject key reuse when the request fingerprint changes',
    ],
    taskInstructions: [
      'Replace ??? with a dictionary containing fingerprint and response so later calls can compare input and reuse the result.',
      'Keep the replay branch before job creation; the second identical request must return job-1 without growing created_jobs.',
      'Run the conflicting third request and confirm it returns status 409 while the final created_count remains exactly 1.',
    ],
    code: `# Lesson 12 — Idempotency
# This local store simulates one process handling repeated create requests.

created_jobs = []
idempotency_store = {}

def create_job(request):
    key = request.get("idempotency_key")
    if not key:
        return {"status": 400, "body": {"error": "idempotency key required"}}

    fingerprint = (request.get("tenant"), request.get("question"))
    previous = idempotency_store.get(key)
    if previous:
        if previous["fingerprint"] != fingerprint:
            return {"status": 409, "body": {"error": "key reused with different input"}}
        return {**previous["response"], "replayed": True}

    job = {"id": f"job-{len(created_jobs) + 1}", "question": request["question"]}
    created_jobs.append(job)
    response = {"status": 201, "body": job, "replayed": False}
    idempotency_store[key] = ???
    return response

first = {"tenant": "blue", "question": "Summarize A", "idempotency_key": "key-1"}
same = {"tenant": "blue", "question": "Summarize A", "idempotency_key": "key-1"}
conflict = {"tenant": "blue", "question": "Summarize B", "idempotency_key": "key-1"}

print("first", create_job(first))
print("same", create_job(same))
print("conflict", create_job(conflict))
print({"created_count": len(created_jobs)})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['idempotency_store[key]', 'fingerprint', 'replayed'],
      printPatterns: [
        "first.*'status': 201.*'replayed': False",
        "same.*job-1.*'replayed': True",
        "conflict.*'status': 409",
        "'created_count': 1",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Store {"fingerprint": fingerprint, "response": response} for the first successful request.',
      'An idempotency key identifies one operation, not every operation from the same tenant.',
    ],
    predict: {
      prompt: 'What should an identical retry with the same idempotency key do?',
      choices: ['Return the saved result', 'Create job-2', 'Ignore the key'],
      correctIndex: 0,
    },
    compare: {
      note: 'Caching only by key is unsafe unless the original input is also checked.',
      wrong: 'created_jobs.append(job)  # every retry creates again',
      fixed:
        'if key in store:\n    verify the fingerprint\n    return the saved response',
    },
    stretch:
      'Stretch: store a simulated created_at value and expire key-1 only after an explicit cleanup pass.',
    pipeline: ['fingerprint request', 'look up key', 'replay or reject conflict', 'create once'],
  },
  {
    id: 'api-authn-authorization',
    difficulty: 'api',
    number: 13,
    topic: 'Authentication vs authorization',
    chapter: 'Reliability & access',
    goal:
      'Return 401 for an unknown identity, 403 for cross-tenant access, and 200 only for a token with the required document scope.',
    why:
      'Authentication proves who is calling; authorization separately limits which tenant data and actions that identity may access.',
    tasks: [
      'Require the document-read scope',
      'Keep tenant authorization separate from identity lookup',
      'Exercise unauthenticated, forbidden, and allowed requests',
    ],
    taskInstructions: [
      'Replace ??? with "read:docs" so an authenticated caller still needs the exact scope before protected data is returned.',
      'Preserve the tenant comparison before document lookup; authorization must prevent another tenant identifier from becoming visible.',
      'Inspect the three printed statuses in order: unknown token 401, cross-tenant request 403, and authorized own-tenant request 200.',
    ],
    code: `# Lesson 13 — Authentication vs authorization
# Token claims and documents are local examples, not a real identity system.

TOKENS = {
    "alice-token": {"user": "alice", "tenant": "blue", "scopes": {"read:docs"}},
    "viewer-token": {"user": "vic", "tenant": "green", "scopes": set()},
}

DOCUMENTS = {
    ("blue", "d1"): {"title": "Blue roadmap"},
    ("green", "d1"): {"title": "Green roadmap"},
}

def get_document(token, requested_tenant, document_id):
    claims = TOKENS.get(token)
    if claims is None:
        return {"status": 401, "body": {"error": "authentication required"}}

    if claims["tenant"] != requested_tenant:
        return {"status": 403, "body": {"error": "tenant forbidden"}}

    if ??? not in claims["scopes"]:
        return {"status": 403, "body": {"error": "scope forbidden"}}

    document = DOCUMENTS.get((requested_tenant, document_id))
    if document is None:
        return {"status": 404, "body": {"error": "missing"}}
    return {"status": 200, "body": document}

print("unknown", get_document("bad-token", "blue", "d1"))
print("cross-tenant", get_document("alice-token", "green", "d1"))
print("allowed", get_document("alice-token", "blue", "d1"))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['claims["tenant"]', 'claims["scopes"]', '"status": 403'],
      printPatterns: [
        "unknown.*'status': 401",
        "cross-tenant.*'status': 403",
        "allowed.*'status': 200.*Blue roadmap",
      ],
      minNonEmptyPrints: 3,
    },
    hints: [
      'The required scope is the string "read:docs", matching the set on alice-token.',
      'A known token is not automatically authorized for every tenant or operation.',
    ],
    predict: {
      prompt: 'A valid identity trying to read another tenant should receive…',
      choices: ['403 Forbidden', '401 Unauthenticated', '200 OK'],
      correctIndex: 0,
    },
    compare: {
      note: 'Authentication alone is not a permission check.',
      wrong: 'if token in TOKENS:\n    return DOCUMENTS[(tenant, document_id)]',
      fixed:
        'authenticate token, then check tenant and scope before reading the document',
    },
    stretch:
      'Stretch: add a blue-token without read:docs and prove it receives the scope-specific 403 branch.',
    pipeline: ['authenticate identity', 'check tenant', 'check scope', 'read or deny'],
  },
  {
    id: 'api-retries-backoff',
    difficulty: 'api',
    number: 14,
    topic: 'Timeouts/retries/backoff',
    chapter: 'Reliability & access',
    goal:
      'Retry simulated 503 and 429 outcomes with 0.25 then 0.5 second schedules, succeed on attempt three, and stop immediately on 400.',
    why:
      'Providers fail transiently, but bounded retries must distinguish retryable faults from permanent client errors and avoid synchronized retry storms.',
    tasks: [
      'Complete exponential backoff growth',
      'Retry only the explicitly transient outcomes',
      'Compare recovery with a non-retryable failure',
    ],
    taskInstructions: [
      'Replace ??? with 2 so each scheduled delay doubles without actually sleeping inside this browser-local simulation.',
      'Keep 429, 503, and timeout in the retryable set while leaving status 400 outside it so bad requests stop immediately.',
      'Verify the recovery trace reaches attempt 3 with delays [0.25, 0.5], while the bad request trace contains only attempt 1.',
    ],
    code: `# Lesson 14 — Timeouts, retries & backoff
# Outcomes and delays are simulated; this lesson performs no network calls or waits.

RETRYABLE = {429, 502, 503, 504, "timeout"}

def call_with_retry(outcomes, max_attempts=4, base_delay=0.25):
    trace = []
    scheduled_delays = []

    for attempt, outcome in enumerate(outcomes[:max_attempts], start=1):
        trace.append({"attempt": attempt, "outcome": outcome})
        if outcome == 200:
            return {
                "ok": True,
                "attempts": attempt,
                "delays": scheduled_delays,
                "trace": trace,
            }
        if outcome not in RETRYABLE:
            return {
                "ok": False,
                "reason": "non_retryable",
                "delays": scheduled_delays,
                "trace": trace,
            }
        if attempt < max_attempts:
            scheduled_delays.append(base_delay * (??? ** (attempt - 1)))

    return {
        "ok": False,
        "reason": "attempts_exhausted",
        "delays": scheduled_delays,
        "trace": trace,
    }

print("recovered", call_with_retry([503, 429, 200]))
print("bad-request", call_with_retry([400, 200]))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['RETRYABLE', 'max_attempts', 'scheduled_delays'],
      printPatterns: [
        "recovered.*'ok': True.*'attempts': 3.*\\[0\\.25, 0\\.5\\]",
        "bad-request.*'reason': 'non_retryable'.*'attempt': 1",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Exponential backoff commonly doubles: base_delay * (2 ** retry_index).',
      'The trace represents what would happen; no real sleep is needed to learn the policy.',
    ],
    predict: {
      prompt: 'Should a malformed request returning 400 be retried unchanged?',
      choices: ['No, stop immediately', 'Yes, forever', 'Only after a longer sleep'],
      correctIndex: 0,
    },
    compare: {
      note: 'Retrying every error wastes capacity and can repeat unsafe work.',
      wrong: 'while status != 200:\n    call_again()',
      fixed:
        'retry only transient outcomes with a maximum attempt count and backoff',
    },
    stretch:
      'Stretch: add deterministic jitter values [0.01, 0.03] to the two scheduled delays and print the adjusted schedule.',
    pipeline: ['attempt', 'classify outcome', 'schedule bounded backoff', 'recover or stop'],
  },
  {
    id: 'api-tenant-rate-limits',
    difficulty: 'api',
    number: 15,
    topic: 'Per-tenant rate limits',
    chapter: 'Reliability & access',
    goal:
      'Allow tenant blue exactly two requests totaling eight tokens, reject its next request with 429, and leave tenant green unaffected.',
    why:
      'Per-tenant quotas prevent one noisy customer or runaway agent from consuming capacity that belongs to everyone else.',
    tasks: [
      'Enforce the tenant token boundary',
      'Track request and token usage separately',
      'Prove one tenant cannot exhaust another tenant quota',
    ],
    taskInstructions: [
      'Replace ??? with limits["tokens"] so a request reaching exactly eight cumulative tokens passes but any amount above it fails.',
      'Keep request count and token count as separate checks because a tenant can exhaust either budget before the other.',
      'Inspect the four decisions: blue receives 200, 200, then 429, while green still receives 200 with independent usage.',
    ],
    code: `# Lesson 15 — Per-tenant rate limits
# The quota window is a deterministic local dictionary for this exercise.

LIMITS = {
    "blue": {"requests": 2, "tokens": 8},
    "green": {"requests": 2, "tokens": 8},
}
USAGE = {
    tenant: {"requests": 0, "tokens": 0}
    for tenant in LIMITS
}

def admit(tenant, requested_tokens):
    limits = LIMITS[tenant]
    state = USAGE[tenant]

    if state["requests"] >= limits["requests"]:
        return {"status": 429, "reason": "request limit", "usage": dict(state)}
    if state["tokens"] + requested_tokens > ???:
        return {"status": 429, "reason": "token limit", "usage": dict(state)}

    state["requests"] += 1
    state["tokens"] += requested_tokens
    return {"status": 200, "reason": "admitted", "usage": dict(state)}

print("blue-1", admit("blue", 3))
print("blue-2-boundary", admit("blue", 5))
print("blue-3", admit("blue", 1))
print("green-1", admit("green", 5))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['LIMITS', 'USAGE[tenant]', '"status": 429'],
      printPatterns: [
        "blue-1.*'status': 200",
        "blue-2-boundary.*'status': 200.*'tokens': 8",
        "blue-3.*'status': 429",
        "green-1.*'status': 200.*'requests': 1",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Compare cumulative tokens with limits["tokens"], not the current request alone.',
      'Each tenant owns a distinct usage dictionary in this simulated quota window.',
    ],
    predict: {
      prompt: 'If blue reaches its limit, what should happen to green?',
      choices: ['Green keeps its own quota', 'Green is also blocked', 'All usage resets'],
      correctIndex: 0,
    },
    compare: {
      note: 'A single global counter lets one tenant starve every other tenant.',
      wrong: 'global_requests += 1\nif global_requests > limit: reject()',
      fixed:
        'state = usage[tenant]\ncompare that tenant with that tenant’s limits',
    },
    stretch:
      'Stretch: add a reset_window() function and prove both tenants return to zero without changing their configured limits.',
    pipeline: ['identify tenant', 'read tenant budget', 'admit or return 429', 'record isolated usage'],
  },
  {
    id: 'api-typed-streaming',
    difficulty: 'api',
    number: 16,
    topic: 'Typed streaming events',
    chapter: 'Streaming, caching & routing',
    goal:
      'Emit start, indexed token, and done events in order, validate every event, and visibly reject a token event missing its text field.',
    why:
      'Typed events let a client render partial results safely without guessing whether a chunk is text, a tool call, an error, or completion.',
    tasks: [
      'Emit token events with the correct type',
      'Validate required fields for every event kind',
      'Prove the sequence is valid and malformed data is rejected',
    ],
    taskInstructions: [
      'Replace ??? with "token" so each streamed text piece selects the token schema instead of becoming an unknown event type.',
      'Keep required.issubset(event) in the validator so start, token, and done events cannot omit fields their consumers need.',
      'Inspect the printed type sequence and validity flags: the complete stream must be True and the malformed token must be False.',
    ],
    code: `# Lesson 16 — Typed streaming events
# A generator simulates a stream locally; no network connection is opened.

EVENT_FIELDS = {
    "start": {"request_id"},
    "token": {"index", "text"},
    "done": {"finish_reason"},
}

def valid_event(event):
    event_type = event.get("type")
    required = EVENT_FIELDS.get(event_type)
    return required is not None and required.issubset(event)

def stream_response(pieces):
    yield {"type": "start", "request_id": "req-16"}
    for index, text in enumerate(pieces):
        yield {"type": ???, "index": index, "text": text}
    yield {"type": "done", "finish_reason": "stop"}

events = list(stream_response(["Python", " streams", " safely"]))
print({"types": [event["type"] for event in events]})
print({"all_valid": all(valid_event(event) for event in events)})
print({"malformed_valid": valid_event({"type": "token", "index": 0})})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['EVENT_FIELDS', 'yield', 'required.issubset'],
      printPatterns: [
        "'types': \\['start', 'token', 'token', 'token', 'done'\\]",
        "'all_valid': True",
        "'malformed_valid': False",
      ],
      minNonEmptyPrints: 3,
    },
    hints: [
      'The loop emits token data, so use the exact event type string "token".',
      'Typed streaming still needs ordinary validation before a client trusts an event.',
    ],
    predict: {
      prompt: 'Why should a done event be distinct from a token event?',
      choices: ['It communicates completion explicitly', 'It makes text longer', 'It authenticates the user'],
      correctIndex: 0,
    },
    compare: {
      note: 'A stream of unrelated strings cannot safely represent lifecycle or error state.',
      wrong: 'yield "START"\nyield text\nyield "DONE"',
      fixed:
        'yield {"type": "start", ...}\nyield {"type": "token", ...}\nyield {"type": "done", ...}',
    },
    stretch:
      'Stretch: add a typed error event requiring code and message fields, then validate one complete and one incomplete example.',
    pipeline: ['start event', 'typed token events', 'done event', 'schema validation'],
  },
  {
    id: 'api-dynamic-batching',
    difficulty: 'api',
    number: 17,
    topic: 'Dynamic batching',
    chapter: 'Streaming, caching & routing',
    goal:
      'Flush one batch at size three, one at the four-millisecond wait boundary, and preserve the final two-request partial batch in arrival order.',
    why:
      'Dynamic batching improves throughput, but a maximum wait prevents low traffic from sitting indefinitely for a full batch.',
    tasks: [
      'Flush a batch at the configured size',
      'Flush an older batch at the wait boundary',
      'Preserve order and the final partial batch',
    ],
    taskInstructions: [
      'Replace ??? with max_size so the fourth request first flushes the three requests already collected in the batch.',
      'Leave the elapsed-time comparison inclusive so a request arriving exactly four milliseconds later triggers a latency-bound flush.',
      'Confirm the printed batch sizes are [3, 1, 2] and every request id remains in its original arrival order.',
    ],
    code: `# Lesson 17 — Dynamic batching
# Arrival times are small deterministic numbers, not a real clock.

def make_batches(requests, max_size=3, max_wait_ms=4):
    batches = []
    batch = []
    batch_started_at = None

    for request in requests:
        waited_too_long = (
            batch
            and request["at_ms"] - batch_started_at >= max_wait_ms
        )
        if batch and (len(batch) >= ??? or waited_too_long):
            batches.append(batch)
            batch = []
            batch_started_at = None

        if not batch:
            batch_started_at = request["at_ms"]
        batch.append(request)

    if batch:
        batches.append(batch)
    return batches

requests = [
    {"id": "r1", "at_ms": 0},
    {"id": "r2", "at_ms": 1},
    {"id": "r3", "at_ms": 2},
    {"id": "r4", "at_ms": 10},
    {"id": "r5", "at_ms": 14},
    {"id": "r6", "at_ms": 15},
]

batches = make_batches(requests)
print({"batch_ids": [[item["id"] for item in batch] for batch in batches]})
print({"batch_sizes": [len(batch) for batch in batches]})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['max_wait_ms', 'waited_too_long', 'if batch:'],
      printPatterns: [
        "'batch_ids': \\[\\['r1', 'r2', 'r3'\\], \\['r4'\\], \\['r5', 'r6'\\]\\]",
        "'batch_sizes': \\[3, 1, 2\\]",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'The size condition compares len(batch) with the max_size parameter.',
      'Always append a non-empty final batch after the input loop finishes.',
    ],
    predict: {
      prompt: 'What protects a low-traffic request from waiting forever for a full batch?',
      choices: ['A maximum wait', 'A larger batch', 'Removing timestamps'],
      correctIndex: 0,
    },
    compare: {
      note: 'Waiting only for a full batch can make throughput look good while latency becomes unbounded.',
      wrong: 'if len(batch) == max_size:\n    flush(batch)',
      fixed:
        'flush when the size limit OR the maximum wait boundary is reached',
    },
    stretch:
      'Stretch: add a maximum total-token limit of 12 and flush before adding a request that would exceed it.',
    pipeline: ['queue arrivals', 'check size & wait', 'flush batch', 'preserve partial tail'],
  },
  {
    id: 'api-embedding-cache',
    difficulty: 'api',
    number: 18,
    topic: 'Embedding cache',
    chapter: 'Streaming, caching & routing',
    goal:
      'Reuse one normalized-text embedding within model v1, recompute for model v2, and visibly finish with two computations and two cache entries.',
    why:
      'Embedding caches save latency and cost, but cache keys must include normalized input and model version to avoid stale vector reuse.',
    tasks: [
      'Cache the computed embedding under the full key',
      'Normalize equivalent text into one cache entry',
      'Separate embeddings produced by different model versions',
    ],
    taskInstructions: [
      'Replace ??? with raw_embed(normalized, model_version) so only a cache miss performs the simulated expensive calculation.',
      'Keep strip, lowercase, and whitespace normalization in normalize_text so cosmetic input differences share one safe cache key.',
      'Verify repeated v1 text returns equal vectors without another computation, while v2 creates the second cache entry.',
    ],
    code: `# Lesson 18 — Embedding cache
# raw_embed returns a deterministic toy vector; it does not call an embedding provider.

COMPUTATIONS = 0
CACHE = {}

def normalize_text(text):
    return " ".join(text.strip().lower().split())

def raw_embed(text, model_version):
    global COMPUTATIONS
    COMPUTATIONS += 1
    return [
        len(text),
        sum(ord(char) for char in text) % 101,
        sum(ord(char) for char in model_version) % 101,
    ]

def embed(text, model_version):
    normalized = normalize_text(text)
    key = (model_version, normalized)
    if key not in CACHE:
        CACHE[key] = ???
    return CACHE[key]

first = embed("Python   Lists", "embed-v1")
same = embed(" python lists ", "embed-v1")
new_version = embed("Python Lists", "embed-v2")

print({"same_vector": first == same, "different_version": first != new_version})
print({"computations": COMPUTATIONS, "cache_entries": len(CACHE)})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['normalize_text', 'model_version', 'CACHE[key]'],
      printPatterns: [
        "'same_vector': True.*'different_version': True",
        "'computations': 2.*'cache_entries': 2",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Compute and store raw_embed(normalized, model_version) only inside the cache-miss branch.',
      'Changing an embedding model invalidates semantic compatibility even when the text is identical.',
    ],
    predict: {
      prompt: 'Why include model version in an embedding cache key?',
      choices: ['Different models can produce incompatible vectors', 'Versions remove whitespace', 'It makes every call a hit'],
      correctIndex: 0,
    },
    compare: {
      note: 'A text-only key can silently serve vectors from an obsolete embedding model.',
      wrong: 'key = normalized_text',
      fixed: 'key = (model_version, normalized_text)',
    },
    stretch:
      'Stretch: add a revision field for the normalization rules and show that changing it produces a separate cache entry.',
    pipeline: ['normalize text', 'build versioned key', 'reuse or compute', 'return deterministic vector'],
  },
  {
    id: 'api-provider-routing',
    difficulty: 'api',
    number: 19,
    topic: 'Provider fallback/routing',
    chapter: 'Streaming, caching & routing',
    goal:
      'Route a structured-output request from a simulated 503 primary to a successful secondary, then return unavailable when no provider meets the cost constraint.',
    why:
      'Fallback routing should honor capability, cost, and failure policy rather than blindly sending every request to any available model.',
    tasks: [
      'Filter providers by structured-output capability',
      'Fallback only after a retryable provider outcome',
      'Return a clear result when no route is eligible',
    ],
    taskInstructions: [
      'Replace ??? with provider["supports_json"] so requests requiring structured output never route to the text-only provider.',
      'Keep the retryable-outcome check before continuing; a permanent client error should stop instead of being hidden by fallback.',
      'Inspect both examples: the first trace must show accurate then fast, and the strict cost case must report no eligible provider.',
    ],
    code: `# Lesson 19 — Provider fallback and routing
# Provider metadata and outcomes are local fixtures, not live services.

PROVIDERS = [
    {"name": "accurate", "cost": 0.80, "supports_json": True},
    {"name": "fast", "cost": 0.30, "supports_json": True},
    {"name": "cheap-text", "cost": 0.10, "supports_json": False},
]
RETRYABLE = {429, 502, 503, 504, "timeout"}

def route(request, outcomes):
    eligible = [
        provider
        for provider in PROVIDERS
        if provider["cost"] <= request["max_cost"]
        and (not request["requires_json"] or ???)
    ]
    if not eligible:
        return {"ok": False, "reason": "no eligible provider", "trace": []}

    trace = []
    for provider in eligible:
        outcome = outcomes.get(provider["name"], 503)
        trace.append({"provider": provider["name"], "outcome": outcome})
        if outcome == 200:
            return {"ok": True, "provider": provider["name"], "trace": trace}
        if outcome not in RETRYABLE:
            return {"ok": False, "reason": "non-retryable provider error", "trace": trace}

    return {"ok": False, "reason": "all eligible providers failed", "trace": trace}

request = {"requires_json": True, "max_cost": 1.00}
print("fallback", route(request, {"accurate": 503, "fast": 200}))
print("too-cheap", route({"requires_json": True, "max_cost": 0.20}, {}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['supports_json', 'max_cost', 'RETRYABLE'],
      printPatterns: [
        "fallback.*'ok': True.*'provider': 'fast'.*accurate.*503.*fast.*200",
        "too-cheap.*'reason': 'no eligible provider'",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Use provider["supports_json"] in the capability branch of the list comprehension.',
      'Fallback changes the serving path, not the request’s required output contract.',
    ],
    predict: {
      prompt: 'Should a JSON-required request route to a text-only provider just because it is cheap?',
      choices: ['No, capability is part of eligibility', 'Yes, cost is the only rule', 'Only after deleting the schema'],
      correctIndex: 0,
    },
    compare: {
      note: 'A fallback that ignores requirements can turn an outage into a silent contract violation.',
      wrong: 'for provider in PROVIDERS:\n    return call(provider)',
      fixed:
        'filter by capability and budget, then continue only for retryable failures',
    },
    stretch:
      'Stretch: add a region field and require a same-region provider before considering cross-region fallback.',
    pipeline: ['filter capability & cost', 'try preferred route', 'classify failure', 'fallback or fail clearly'],
  },
  {
    id: 'api-token-cost-budgets',
    difficulty: 'api',
    number: 20,
    topic: 'Token & cost budgets',
    chapter: 'Cost & observability',
    goal:
      'Accept exactly 1,000 total tokens within a 1.50 budget, reject 1,001 for context overflow, and reject a smaller request that exceeds cost.',
    why:
      'Admission-time token and cost estimates bound latency and spend before a model request consumes scarce capacity.',
    tasks: [
      'Calculate both input and output token cost',
      'Enforce the inclusive context boundary',
      'Distinguish context rejection from cost rejection',
    ],
    taskInstructions: [
      'Replace ??? with price["output"] so expensive generated tokens contribute to the estimate instead of counting only the prompt.',
      'Keep total_tokens <= context_limit inclusive so the exact 1,000-token boundary is admitted while 1,001 is rejected.',
      'Check the three printed decisions: accepted, context_limit, and cost_limit must appear as distinct visible outcomes.',
    ],
    code: `# Lesson 20 — Token and cost budgets
# Prices are invented per-token values for deterministic local arithmetic.

PRICES = {
    "model-a": {"input": 0.001, "output": 0.002},
}

def estimate_and_admit(model, input_tokens, output_tokens, context_limit, cost_budget):
    price = PRICES[model]
    total_tokens = input_tokens + output_tokens
    estimated_cost = (
        input_tokens * price["input"]
        + output_tokens * ???
    )

    if total_tokens > context_limit:
        return {
            "admitted": False,
            "reason": "context_limit",
            "tokens": total_tokens,
            "cost": round(estimated_cost, 3),
        }
    if estimated_cost > cost_budget:
        return {
            "admitted": False,
            "reason": "cost_limit",
            "tokens": total_tokens,
            "cost": round(estimated_cost, 3),
        }
    return {
        "admitted": True,
        "reason": "accepted",
        "tokens": total_tokens,
        "cost": round(estimated_cost, 3),
    }

print("boundary", estimate_and_admit("model-a", 800, 200, 1000, 1.50))
print("overflow", estimate_and_admit("model-a", 801, 200, 1000, 1.50))
print("too-costly", estimate_and_admit("model-a", 500, 200, 1000, 0.50))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['input_tokens', 'output_tokens', 'cost_budget'],
      printPatterns: [
        "boundary.*'admitted': True.*'tokens': 1000.*'cost': 1\\.2",
        "overflow.*'reason': 'context_limit'.*'tokens': 1001",
        "too-costly.*'reason': 'cost_limit'",
      ],
      minNonEmptyPrints: 3,
    },
    hints: [
      'Multiply output_tokens by price["output"] before adding input cost.',
      'Token capacity and monetary budget are independent admission controls.',
    ],
    predict: {
      prompt: 'When input and output prices differ, what must the estimate do?',
      choices: ['Price each token class separately', 'Count only input', 'Use the cheaper rate for all'],
      correctIndex: 0,
    },
    compare: {
      note: 'Checking cost after generation is observability, not a preventative budget.',
      wrong: 'response = call_model()\nif response.cost > budget: log("too late")',
      fixed:
        'estimate input plus maximum output cost and reject before the call',
    },
    stretch:
      'Stretch: add a cached_input price of 0.0002 and compare the same request with zero and 600 cached input tokens.',
    pipeline: ['count planned tokens', 'estimate split cost', 'check context', 'admit or reject'],
  },
  {
    id: 'api-safe-logging',
    difficulty: 'api',
    number: 21,
    topic: 'Safe structured logging',
    chapter: 'Cost & observability',
    goal:
      'Preserve request id, status, and token counts while redacting an authorization secret, masking an email, and proving neither raw value remains.',
    why:
      'Logs need enough structure for operations and audit without becoming a second database of credentials, prompts, or personal data.',
    tasks: [
      'Classify the authorization field as sensitive',
      'Mask email data while preserving a useful domain',
      'Prove operational fields remain and secrets do not',
    ],
    taskInstructions: [
      'Replace ??? with "authorization" so the bearer value is replaced with [REDACTED] before the record is serialized.',
      'Keep mask_email preserving only the first character and domain; the raw local-part must not survive in structured output.',
      'Inspect contains_secret and contains_raw_email: both must print False while request_id, status, and tokens remain visible.',
    ],
    code: `# Lesson 21 — Safe structured logging
# The record is local and contains invented sample values.

import json

SENSITIVE_KEYS = {"api_key", ???, "prompt"}

def mask_email(value):
    local, domain = value.split("@", 1)
    return local[:1] + "***@" + domain

def sanitize(record):
    safe = {}
    for key, value in record.items():
        if key in SENSITIVE_KEYS:
            safe[key] = "[REDACTED]"
        elif key == "email":
            safe[key] = mask_email(value)
        else:
            safe[key] = value
    return safe

record = {
    "request_id": "req-21",
    "status": 200,
    "tokens": 84,
    "authorization": "Bearer secret-123",
    "api_key": "sk-example",
    "email": "ada@example.com",
    "prompt": "private account question",
}

serialized = json.dumps(sanitize(record), sort_keys=True)
print(serialized)
print({
    "contains_secret": "secret-123" in serialized or "sk-example" in serialized,
    "contains_raw_email": "ada@example.com" in serialized,
})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['SENSITIVE_KEYS', 'mask_email', 'json.dumps'],
      printPatterns: [
        '"request_id": "req-21".*"status": 200.*"tokens": 84',
        '"authorization": "\\[REDACTED\\]"',
        'a\\*\\*\\*@example\\.com',
        "'contains_secret': False.*'contains_raw_email': False",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Add the exact string "authorization" to the sensitive-key set.',
      'Redaction should happen before serialization or transport, not after a raw log is already written.',
    ],
    predict: {
      prompt: 'Which field should remain visible in a safe operational log?',
      choices: ['request_id', 'Bearer token', 'raw private prompt'],
      correctIndex: 0,
    },
    compare: {
      note: 'Logging a whole request dictionary is convenient but can leak credentials and PII.',
      wrong: 'print(json.dumps(request))',
      fixed:
        'sanitize known sensitive fields, mask PII, then serialize the structured record',
    },
    stretch:
      'Stretch: make sanitize recurse into a nested headers dictionary and prove a nested authorization value is also redacted.',
    pipeline: ['collect operational fields', 'redact secrets', 'mask PII', 'serialize safe record'],
  },
  {
    id: 'api-tracing-observability',
    difficulty: 'api',
    number: 22,
    topic: 'Tracing & observability',
    chapter: 'Cost & observability',
    goal:
      'Link validate, retrieve, and generate spans under one trace id, report 111 total milliseconds, identify generate as slowest, and flag a 100 ms budget breach.',
    why:
      'A trace connects latency and failure evidence across an AI pipeline so teams can find which stage changed instead of guessing from one total.',
    tasks: [
      'Set the end-to-end latency budget',
      'Build ordered spans with one correlation id',
      'Summarize total latency and the slowest stage',
    ],
    taskInstructions: [
      'Replace ??? with 100 so the simulated 111 millisecond trace visibly exceeds its end-to-end latency budget.',
      'Keep trace_id on every span and advance the start time after each duration so the ordered timeline can be reconstructed.',
      'Verify the summary names generate as slowest, reports total_ms 111, and prints over_budget True beside the shared trace id.',
    ],
    code: `# Lesson 22 — Tracing and observability
# Durations are deterministic fixtures; no wall-clock timing is performed.

trace_id = "trace-22"
budget_ms = ???
durations = [
    ("validate", 4),
    ("retrieve", 32),
    ("generate", 75),
]

spans = []
cursor_ms = 0
for name, duration_ms in durations:
    spans.append({
        "trace_id": trace_id,
        "name": name,
        "start_ms": cursor_ms,
        "duration_ms": duration_ms,
    })
    cursor_ms += duration_ms

total_ms = sum(span["duration_ms"] for span in spans)
slowest = max(spans, key=lambda span: span["duration_ms"])
summary = {
    "trace_id": trace_id,
    "total_ms": total_ms,
    "slowest": slowest["name"],
    "over_budget": total_ms > budget_ms,
    "tokens": 84,
}

for span in spans:
    print("span", span)
print("summary", summary)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['trace_id', 'duration_ms', 'max(spans'],
      printPatterns: [
        "span.*trace-22.*validate",
        "span.*trace-22.*retrieve",
        "span.*trace-22.*generate",
        "summary.*'total_ms': 111.*'slowest': 'generate'.*'over_budget': True",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Set budget_ms to 100; the three stage durations add up to 111.',
      'A correlation id is useful only when every stage carries the same value.',
    ],
    predict: {
      prompt: 'Which span should you inspect first when it dominates total latency?',
      choices: ['The slowest span', 'The alphabetically first span', 'An unrelated request'],
      correctIndex: 0,
    },
    compare: {
      note: 'One end-to-end duration cannot reveal which pipeline stage caused a regression.',
      wrong: 'print({"request_ms": 111})',
      fixed:
        'record correlated stage spans, then derive total and slowest-stage summaries',
    },
    stretch:
      'Stretch: attach status="error" to retrieve, then add a summary field naming the first failing span.',
    pipeline: ['start trace', 'record stage spans', 'aggregate metrics', 'flag budget breach'],
  },
  {
    id: 'api-version-registry',
    difficulty: 'api',
    number: 23,
    topic: 'Version registry & rollback',
    chapter: 'Release safety',
    goal:
      'Reject a release referencing an unknown prompt, promote release-2 with recorded history, and visibly roll active state back to release-1.',
    why:
      'Prompts, models, and indexes are coupled versioned artifacts; a registry makes every result reproducible and a bad release reversible.',
    tasks: [
      'Validate every referenced artifact before promotion',
      'Record the previous active release in history',
      'Restore the previous release during rollback',
    ],
    taskInstructions: [
      'Keep validate_release checking prompt, model, and index names so release-bad is rejected before it can become active.',
      'Leave promotion appending ACTIVE to HISTORY before assignment; rollback needs that exact prior release as its recovery target.',
      'Replace ??? with previous and confirm the final active release is release-1 after release-2 is first promoted successfully.',
    ],
    code: `# Lesson 23 — Version registry and rollback
# This in-memory registry simulates release metadata, not a deployment platform.

ARTIFACTS = {
    "prompts": {"prompt-v1", "prompt-v2"},
    "models": {"model-v1", "model-v2"},
    "indexes": {"index-v1", "index-v2"},
}
RELEASES = {
    "release-1": {"prompt": "prompt-v1", "model": "model-v1", "index": "index-v1"},
    "release-2": {"prompt": "prompt-v2", "model": "model-v2", "index": "index-v2"},
    "release-bad": {"prompt": "prompt-v99", "model": "model-v2", "index": "index-v2"},
}

ACTIVE = "release-1"
HISTORY = []

def validate_release(name):
    release = RELEASES.get(name)
    if release is None:
        return {"valid": False, "missing": ["release"]}
    artifact_groups = {
        "prompt": "prompts",
        "model": "models",
        "index": "indexes",
    }
    missing = [
        kind
        for kind, artifact in release.items()
        if artifact not in ARTIFACTS[artifact_groups[kind]]
    ]
    return {"valid": not missing, "missing": missing}

def promote(name):
    global ACTIVE
    validation = validate_release(name)
    if not validation["valid"]:
        return {"promoted": False, **validation, "active": ACTIVE}
    HISTORY.append(ACTIVE)
    ACTIVE = name
    return {"promoted": True, "active": ACTIVE, "previous": HISTORY[-1]}

def rollback():
    global ACTIVE
    if not HISTORY:
        return {"rolled_back": False, "active": ACTIVE}
    previous = HISTORY.pop()
    ACTIVE = ???
    return {"rolled_back": True, "active": ACTIVE}

print("invalid", promote("release-bad"))
print("promote", promote("release-2"))
print("rollback", rollback())
print({"active": ACTIVE, "history": HISTORY})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['validate_release', 'HISTORY.append', 'def rollback'],
      printPatterns: [
        "invalid.*'promoted': False.*prompt",
        "promote.*'promoted': True.*release-2.*release-1",
        "rollback.*'rolled_back': True.*release-1",
        "'active': 'release-1'.*'history': \\[\\]",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Rollback assigns the popped previous release to ACTIVE.',
      'Artifact validation must finish before changing ACTIVE or HISTORY.',
    ],
    predict: {
      prompt: 'What makes a rollback deterministic?',
      choices: ['A recorded previous version', 'The newest model name', 'Deleting all history'],
      correctIndex: 0,
    },
    compare: {
      note: 'Changing model or prompt names in place destroys reproducibility and makes rollback ambiguous.',
      wrong: 'ACTIVE_CONFIG.update(candidate)',
      fixed:
        'register immutable artifact versions, promote a release, and retain the prior release id',
    },
    stretch:
      'Stretch: promote release-2 again after rollback and print the exact prompt, model, and index versions now active.',
    pipeline: ['validate artifacts', 'record previous release', 'promote candidate', 'rollback if needed'],
  },
  {
    id: 'api-evaluation-gate',
    difficulty: 'api',
    number: 24,
    topic: 'Evaluation release gate',
    chapter: 'Release safety',
    goal:
      'Approve a candidate exactly on all quality and operational boundaries, then block another candidate for citation and cost failures.',
    why:
      'A release gate turns evaluation expectations into deterministic policy so prompt or model changes cannot ship on impressions alone.',
    tasks: [
      'Apply every release threshold inclusively',
      'Report all failed checks instead of only the first',
      'Compare an exact-boundary candidate with a regression',
    ],
    taskInstructions: [
      'Replace ??? with LIMITS["quality_min"] so a quality score equal to 0.80 passes the inclusive release boundary.',
      'Keep the failed list collecting every false check; simultaneous citation and cost regressions must both remain visible.',
      'Verify boundary is approved with no failures and regression is blocked with citation_support and cost in that order.',
    ],
    code: `# Lesson 24 — Evaluation release gate
# Metrics are fixed local fixtures from an imagined offline evaluation run.

LIMITS = {
    "quality_min": 0.80,
    "citation_min": 0.75,
    "p95_latency_max": 500,
    "cost_max": 0.020,
}

def release_gate(metrics):
    checks = {
        "quality": metrics["quality"] >= ???,
        "citation_support": metrics["citation_support"] >= LIMITS["citation_min"],
        "p95_latency": metrics["p95_latency"] <= LIMITS["p95_latency_max"],
        "cost": metrics["cost"] <= LIMITS["cost_max"],
    }
    failed = [name for name, passed in checks.items() if not passed]
    return {"approved": not failed, "failed": failed, "checks": checks}

boundary = {
    "quality": 0.80,
    "citation_support": 0.75,
    "p95_latency": 500,
    "cost": 0.020,
}
regression = {
    "quality": 0.82,
    "citation_support": 0.60,
    "p95_latency": 480,
    "cost": 0.025,
}

print("boundary", release_gate(boundary))
print("regression", release_gate(regression))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['LIMITS', 'failed =', '"citation_support"'],
      printPatterns: [
        "boundary.*'approved': True.*'failed': \\[\\]",
        "regression.*'approved': False.*'failed': \\['citation_support', 'cost'\\]",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Use LIMITS["quality_min"] on the right side of the quality comparison.',
      'Minimum metrics use >=, while maximum latency and cost metrics use <=.',
    ],
    predict: {
      prompt: 'What should happen when quality improves but citation support regresses below its gate?',
      choices: ['Block the release', 'Ignore citation support', 'Delete the eval set'],
      correctIndex: 0,
    },
    compare: {
      note: 'A single average can hide a serious safety, latency, or cost regression.',
      wrong: 'approved = metrics["quality"] >= 0.8',
      fixed:
        'evaluate quality, grounding, latency, and cost as separate required gates',
    },
    stretch:
      'Stretch: add refusal_rate with an inclusive maximum of 0.05 and demonstrate a candidate failing only that check.',
    pipeline: ['load candidate metrics', 'apply all thresholds', 'collect failures', 'approve or block'],
  },
  {
    id: 'api-drift-detection',
    difficulty: 'api',
    number: 25,
    topic: 'Drift detection',
    chapter: 'Release safety',
    goal:
      'Calculate population stability for two three-bin windows, keep the near-baseline window below 0.10, and alert on the shifted window.',
    why:
      'Input distributions can move after release even when code does not; drift signals where quality needs investigation or retraining.',
    tasks: [
      'Complete the population stability contribution',
      'Apply one explicit alert threshold',
      'Distinguish a stable window from a shifted window',
    ],
    taskInstructions: [
      'Replace ??? with actual / expected so each bin compares its changed proportion with the baseline inside the logarithm.',
      'Keep the epsilon clamp before division and log so an empty bin cannot create a zero-division or logarithm error.',
      'Inspect both assessments: stable must report drift False and shifted must report drift True with a much larger score.',
    ],
    code: `# Lesson 25 — Drift detection
# These proportions are local monitoring snapshots, not live production traffic.

import math

def population_stability(expected_bins, actual_bins, epsilon=1e-6):
    score = 0.0
    for expected, actual in zip(expected_bins, actual_bins):
        expected = max(expected, epsilon)
        actual = max(actual, epsilon)
        score += (actual - expected) * math.log(???)
    return score

def assess(expected, actual, threshold=0.10):
    score = population_stability(expected, actual)
    return {"score": round(score, 3), "drift": score > threshold}

baseline = [0.50, 0.30, 0.20]
stable_window = [0.48, 0.31, 0.21]
shifted_window = [0.20, 0.30, 0.50]

print("stable", assess(baseline, stable_window))
print("shifted", assess(baseline, shifted_window))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['math.log', 'epsilon', 'threshold=0.10'],
      printPatterns: [
        "stable.*'drift': False",
        "shifted.*'score': 0\\.55.*'drift': True",
      ],
      minNonEmptyPrints: 2,
    },
    hints: [
      'The logarithm receives actual / expected for each corresponding bin.',
      'Drift is a signal to investigate; it does not by itself prove model quality has fallen.',
    ],
    predict: {
      prompt: 'What does detected input drift prove by itself?',
      choices: ['The input distribution changed', 'The model is certainly wrong', 'The provider is offline'],
      correctIndex: 0,
    },
    compare: {
      note: 'Comparing only overall row counts misses changes in the distribution of values.',
      wrong: 'drift = len(current_rows) != len(baseline_rows)',
      fixed:
        'compare aligned distribution bins and alert when the stability score crosses a calibrated threshold',
    },
    stretch:
      'Stretch: require two consecutive shifted windows before alerting and print the alert decision for [stable, shifted, shifted].',
    pipeline: ['collect comparable bins', 'calculate stability', 'compare threshold', 'alert for investigation'],
  },
  {
    id: 'api-production-capstone',
    difficulty: 'api',
    number: 26,
    topic: 'Production AI endpoint capstone',
    chapter: 'Production capstone',
    goal:
      'Reject an unknown identity with 401, fallback from a simulated 503 primary to backup, and replay the keyed success without another provider call or quota charge.',
    why:
      'A production AI endpoint is a chain of deterministic controls around probabilistic work, and their ordering decides whether failures stay safe.',
    tasks: [
      'Enforce identity, tenant, scope, and token budget',
      'Trace retryable provider fallback into a cited response',
      'Replay the idempotent result before charging quota again',
    ],
    taskInstructions: [
      'Replace ??? with "ask:ai" so the endpoint requires the explicit AI-operation scope after authentication and tenant authorization.',
      'Keep the provider loop recording primary 503 before backup 200; the returned body must name backup and include citation d1.',
      'Leave idempotency lookup before quota admission so the replay returns the stored job with replayed True while usage remains exactly one.',
    ],
    code: `# Lesson 26 — Production endpoint capstone
# Every identity, quota, provider outcome, answer, and citation is simulated locally.

TOKENS = {
    "alice-token": {"user": "alice", "tenant": "blue", "scopes": {"ask:ai"}},
}
QUOTA = {"blue": 1}
USAGE = {"blue": 0}
IDEMPOTENCY = {}
PROVIDERS = ["primary", "backup"]
RETRYABLE = {429, 502, 503, 504, "timeout"}

def error(status, code, request_id):
    return {
        "status": status,
        "body": {"error": {"code": code, "request_id": request_id}},
    }

def endpoint(request, provider_outcomes):
    trace = []
    request_id = request.get("request_id", "missing")
    claims = TOKENS.get(request.get("token"))

    if claims is None:
        return error(401, "authentication_required", request_id)
    if claims["tenant"] != request.get("tenant"):
        return error(403, "tenant_forbidden", request_id)
    if ??? not in claims["scopes"]:
        return error(403, "scope_forbidden", request_id)

    question = request.get("question")
    if not isinstance(question, str) or not question.strip():
        return error(422, "question_required", request_id)

    key = request.get("idempotency_key")
    fingerprint = (claims["tenant"], question, request.get("max_output_tokens"))
    previous = IDEMPOTENCY.get(key)
    if previous:
        if previous["fingerprint"] != fingerprint:
            return error(409, "idempotency_conflict", request_id)
        return {**previous["response"], "replayed": True}

    planned_tokens = len(question.split()) + request.get("max_output_tokens", 0)
    if planned_tokens > 50:
        return error(422, "token_budget_exceeded", request_id)
    if USAGE[claims["tenant"]] >= QUOTA[claims["tenant"]]:
        return error(429, "tenant_rate_limited", request_id)

    selected = None
    for provider in PROVIDERS:
        outcome = provider_outcomes.get(provider, 503)
        trace.append({"provider": provider, "outcome": outcome})
        if outcome == 200:
            selected = provider
            break
        if outcome not in RETRYABLE:
            return error(502, "non_retryable_provider_error", request_id)

    if selected is None:
        return error(503, "providers_unavailable", request_id)

    USAGE[claims["tenant"]] += 1
    response = {
        "status": 200,
        "body": {
            "answer": "Simulated grounded answer",
            "provider": selected,
            "citations": ["d1"],
            "request_id": request_id,
        },
        "trace": trace,
        "replayed": False,
    }
    IDEMPOTENCY[key] = {"fingerprint": fingerprint, "response": response}
    return response

request = {
    "token": "alice-token",
    "tenant": "blue",
    "question": "Summarize document d1",
    "max_output_tokens": 20,
    "idempotency_key": "capstone-key",
    "request_id": "req-26",
}

print("unauthenticated", endpoint({**request, "token": "bad"}, {}))
print("first", endpoint(request, {"primary": 503, "backup": 200}))
print("replay", endpoint(request, {"primary": 503, "backup": 503}))
print({"tenant_usage": USAGE["blue"], "stored_operations": len(IDEMPOTENCY)})
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['IDEMPOTENCY', 'planned_tokens', 'trace.append', 'citations'],
      printPatterns: [
        "unauthenticated.*'status': 401",
        "first.*'status': 200.*'provider': 'backup'.*'citations': \\['d1'\\].*primary.*503.*backup.*200.*'replayed': False",
        "replay.*'status': 200.*'provider': 'backup'.*'replayed': True",
        "'tenant_usage': 1.*'stored_operations': 1",
      ],
      minNonEmptyPrints: 4,
    },
    hints: [
      'The required scope string is "ask:ai", matching alice-token claims.',
      'A saved idempotent response must be returned before checking a quota already charged by the first execution.',
      'Provider outcomes are fixtures; the trace simply demonstrates the fallback decision.',
    ],
    predict: {
      prompt: 'Why should idempotent replay happen before quota charging?',
      choices: ['The same operation should not be charged twice', 'It disables authorization', 'It creates a second provider call'],
      correctIndex: 0,
    },
    compare: {
      note: 'Calling a model before deterministic checks makes failures expensive and side effects difficult to control.',
      wrong: 'answer = provider.generate(request)\nthen validate auth and budget',
      fixed:
        'authenticate, authorize, validate, replay, budget, route, trace, then store the successful response',
    },
    stretch:
      'Stretch: run both providers as 503 and prove the 503 result neither increments tenant_usage nor creates an idempotency entry.',
    pipeline: ['authenticate & authorize', 'validate & replay', 'budget & quota', 'fallback & trace', 'store once'],
  },
]
