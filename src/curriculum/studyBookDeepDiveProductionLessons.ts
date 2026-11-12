import type { LessonDraft } from '../examples'

/**
 * Deterministic, browser-local deep dives for the study book's API,
 * ingestion, and infrastructure material. Product and protocol names explain
 * engineering roles; the exercises never contact a network or managed system.
 */
export const STUDY_BOOK_DEEP_DIVE_PRODUCTION_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'api-function-calling-capacity',
    difficulty: 'api',
    number: 38,
    topic: 'Function calling & capacity',
    chapter: 'API engineering deep dives',
    goal:
      'Validate and repair a typed function call, calculate jittered retries, and estimate token cost, concurrency waves, streaming latency, embedding batches, and small-versus-large model routing.',
    why:
      'A production function call needs deterministic contract repair and bounded resilience, while capacity decisions must connect traffic volume, tokens, prices, caching, concurrency, streaming, and batch efficiency.',
    tasks: [
      'Validate a typed function-call contract and repair one malformed argument payload',
      'Add deterministic jitter to bounded exponential retry delays',
      'Calculate integrated capacity evidence and route work by model trade-off',
    ],
    taskInstructions: [
      'Keep validation checking the function name, required and unexpected fields, field types, and call identifier before any local implementation can run.',
      'Replace ??? with jitter[attempt] so each exponential delay receives its corresponding deterministic offset without changing the bounded attempt count.',
      'Inspect the capacity report and verify cache-adjusted input tokens, total output tokens, concurrency waves, first streamed output, embedding batches, and model trade-offs remain separate.',
    ],
    code: `# Lesson 38 — Function calling and capacity
# Calls, retry outcomes, prices, and traffic are fixed local fixtures.

import json
import math

FUNCTION = {
    "name": "lookup_policy",
    "required": {"tenant", "policy_id"},
    "allowed": {"tenant", "policy_id"},
    "types": {"tenant": str, "policy_id": str},
}

def validate_call(call):
    errors = []
    if call.get("name") != FUNCTION["name"]:
        errors.append("unknown function")
    if not isinstance(call.get("call_id"), str):
        errors.append("call_id required")
    arguments = call.get("arguments")
    if not isinstance(arguments, dict):
        errors.append("arguments must be an object")
        return {"valid": False, "errors": errors}
    missing = sorted(FUNCTION["required"] - set(arguments))
    unexpected = sorted(set(arguments) - FUNCTION["allowed"])
    wrong_types = sorted(
        key
        for key, value in arguments.items()
        if key in FUNCTION["types"] and not isinstance(value, FUNCTION["types"][key])
    )
    if missing:
        errors.append(f"missing: {missing}")
    if unexpected:
        errors.append(f"unexpected: {unexpected}")
    if wrong_types:
        errors.append(f"wrong types: {wrong_types}")
    return {"valid": not errors, "errors": errors}

def repair_call(call):
    repaired = dict(call)
    arguments = repaired.get("arguments")
    if isinstance(arguments, str):
        try:
            repaired["arguments"] = json.loads(arguments)
        except json.JSONDecodeError:
            pairs = [piece.strip() for piece in arguments.split(",") if "=" in piece]
            repaired["arguments"] = {
                key.strip(): value.strip()
                for key, value in (pair.split("=", 1) for pair in pairs)
            }
    return {
        "repaired": repaired != call,
        "call": repaired,
        "validation": validate_call(repaired),
    }

def retry_schedule(attempts, base, jitter):
    return [
        round(base * (2 ** attempt) + ???, 2)
        for attempt in range(attempts)
    ]

MODELS = {
    "small": {
        "input_per_1k": 0.001,
        "output_per_1k": 0.002,
        "quality": 0.78,
        "p95_ms": 220,
    },
    "large": {
        "input_per_1k": 0.006,
        "output_per_1k": 0.012,
        "quality": 0.92,
        "p95_ms": 760,
    },
}

def capacity(plan):
    model = MODELS[plan["model"]]
    billable_input = int(
        plan["daily_calls"] * plan["input_tokens"] * (1 - plan["cache_hit"])
    )
    output_tokens = plan["daily_calls"] * plan["output_tokens"]
    daily_cost = (
        billable_input / 1000 * model["input_per_1k"]
        + output_tokens / 1000 * model["output_per_1k"]
    )
    waves = math.ceil(plan["daily_calls"] / plan["concurrency"])
    embedding_batches = math.ceil(plan["documents"] / plan["embedding_batch_size"])
    return {
        "billable_input_tokens": billable_input,
        "output_tokens": output_tokens,
        "daily_cost": round(daily_cost, 2),
        "concurrency_waves": waves,
        "first_streamed_output_ms": plan["first_streamed_output_ms"],
        "embedding_batches": embedding_batches,
    }

def choose_model(task):
    if task["complexity"] == "low" and task["quality_floor"] <= MODELS["small"]["quality"]:
        return {"model": "small", "reason": "lower cost and latency"}
    return {"model": "large", "reason": "higher quality for difficult work"}

valid = {
    "call_id": "call-1",
    "name": "lookup_policy",
    "arguments": {"tenant": "blue", "policy_id": "p7"},
}
malformed = {
    "call_id": "call-2",
    "name": "lookup_policy",
    "arguments": "tenant=blue, policy_id=p7",
}
plan = {
    "model": "small",
    "daily_calls": 1000,
    "input_tokens": 1000,
    "output_tokens": 200,
    "cache_hit": 0.25,
    "concurrency": 25,
    "first_streamed_output_ms": 180,
    "documents": 250,
    "embedding_batch_size": 32,
}

print("valid", validate_call(valid))
print("malformed", validate_call(malformed))
print("repaired", repair_call(malformed))
print("retry", retry_schedule(3, 0.25, [0.01, 0.03, 0.02]))
print("capacity", capacity(plan))
print("models", MODELS)
print("routes", [
    choose_model({"complexity": "low", "quality_floor": 0.75}),
    choose_model({"complexity": "high", "quality_floor": 0.90}),
])
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'validate_call',
        'repair_call',
        'json.JSONDecodeError',
        'retry_schedule',
        'cache_hit',
        'concurrency_waves',
        'first_streamed_output_ms',
        'embedding_batches',
      ],
      printPatterns: [
        "valid.*'valid': True.*'errors': \\[\\]",
        "malformed.*'valid': False.*arguments must be an object",
        "repaired.*'repaired': True.*tenant.*blue.*policy_id.*p7.*'valid': True",
        "retry.*0\\.26.*0\\.53.*1\\.02",
        "capacity.*billable_input_tokens.*750000.*output_tokens.*200000.*daily_cost.*1\\.15.*concurrency_waves.*40.*first_streamed_output_ms.*180.*embedding_batches.*8",
        "models.*small.*quality.*0\\.78.*p95_ms.*220.*large.*quality.*0\\.92.*p95_ms.*760",
        "routes.*small.*lower cost and latency.*large.*higher quality",
      ],
      minNonEmptyPrints: 7,
    },
    hints: [
      'The retry blank is the jitter value at the current attempt index; exponential backoff and jitter should be added, not multiplied together.',
      'Streaming improves time to first visible output but does not reduce billed output tokens, while embedding batches reduce the number of separate embedding operations.',
    ],
    predict: {
      prompt:
        'A low-complexity extraction meets its quality floor on the small model; which route best balances the measured quality requirement, cost, and latency?',
      choices: [
        'Use the small model and retain the measured quality gate',
        'Always use the largest model regardless of evidence',
        'Remove the quality floor from routing',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Counting calls alone hides the real capacity drivers because cache-adjusted input tokens, generated tokens, price tiers, concurrency, streaming, and embedding batch size change different constraints.',
      wrong: 'capacity = daily_calls',
      fixed:
        'volume x tokens x price, adjusted for cache -> concurrency waves -> streamed first output -> batched embedding operations -> quality-aware model route',
    },
    stretch:
      'Stretch: add a retry budget that stops before the next jittered delay would exceed two seconds, then print the skipped attempt and the final cumulative delay.',
    pipeline: [
      'receive typed call',
      'validate or repair',
      'execute with bounded retries',
      'estimate token cost',
      'plan concurrency & batches',
      'route by quality trade-off',
    ],
  },
  {
    id: 'api-ingestion-crawler-policy',
    difficulty: 'api',
    number: 39,
    topic: 'Ingestion crawler policy',
    chapter: 'Ingestion & data systems',
    goal:
      'Build a freshness, storage and acquisition model with replay, dead letters and backpressure. Done when Results selects realtime/batch ingestion, assigns five store roles, enforces crawler/API rules and keeps link repair subject to review.',
    why:
      'Production ingestion must balance freshness with operational cost while preserving replay and failure evidence; acquisition also needs robots, rate, authentication, parser, status, and human-review boundaries.',
    tasks: [
      'Select ingestion freshness and assign PostgreSQL, Mongo, vector, ClickHouse, and Kafka roles',
      'Process replayable Kafka-style events with dead letters and backpressure',
      'Enforce acquisition policy and classify HEAD/GET, redirects, 403, 429, and soft-404 evidence',
    ],
    taskInstructions: [
      'Replace ??? with 5 so sources needing data within five minutes use realtime ingestion while the nightly source remains a lower-cost batch workflow.',
      'Keep the ordered offsets available for replay, route malformed events to the dead-letter list, and mark backpressure when pending events exceed consumer capacity.',
      'Use HTMLParser for local markup, respect robots, rate, and authentication fixtures, and leave every proposed link rewrite unapplied until human_review is explicitly true.',
    ],
    code: `# Lesson 39 — Ingestion crawler policy
# Markup, source policy, statuses, and event logs are fixed local fixtures.

from html.parser import HTMLParser

STORE_ROLES = {
    "PostgreSQL": "transactions, constraints, and relational joins",
    "MongoDB": "flexible document records",
    "vector store": "semantic retrieval",
    "ClickHouse": "high-volume analytical events",
    "Kafka": "ordered event log, replay, and fan-out",
}

def ingestion_mode(freshness_minutes):
    return "realtime" if freshness_minutes <= ??? else "batch"

def consume_log(events, checkpoint, capacity):
    pending = [event for event in events if event["offset"] >= checkpoint]
    processed, dead_letter = [], []
    for event in pending[:capacity]:
        if not isinstance(event.get("payload"), dict) or "record_id" not in event["payload"]:
            dead_letter.append({"offset": event["offset"], "reason": "invalid payload"})
            continue
        processed.append(event["payload"]["record_id"])
    return {
        "replay_from": checkpoint,
        "available_offsets": [event["offset"] for event in pending],
        "processed": processed,
        "dead_letter": dead_letter,
        "backpressure": len(pending) > capacity,
        "next_checkpoint": checkpoint + min(len(pending), capacity),
    }

def acquisition_policy(source):
    if source["kind"] == "crawler" and source["robots"] != "allow":
        return {"allowed": False, "reason": "robots"}
    if not source["rate_budget"]:
        return {"allowed": False, "reason": "rate"}
    if source["kind"] == "api" and not source["authenticated"]:
        return {"allowed": False, "reason": "authentication"}
    return {"allowed": True, "reason": "policy passed"}

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attributes = dict(attrs)
            if "href" in attributes:
                self.links.append(attributes["href"])

def parse_links(markup):
    parser = LinkParser()
    parser.feed(markup)
    return parser.links

def classify_link(probe):
    head = probe["HEAD"]
    get = probe.get("GET")
    if head == 403:
        return {"class": "restricted", "action": "authenticate or human review"}
    if head == 429:
        return {"class": "rate limited", "action": "defer with backoff"}
    if head == 405 and get is None:
        return {"class": "unknown", "action": "run GET fallback"}
    status = get if head == 405 else head
    if status in {301, 302, 307, 308}:
        return {
            "class": "redirect",
            "action": "propose redirect target",
            "target": probe.get("redirect_target"),
        }
    if probe.get("soft_404"):
        return {"class": "soft 404", "action": "manual replacement search"}
    if status == 404:
        return {"class": "broken", "action": "manual replacement search"}
    return {"class": "healthy", "action": "none"}

def rewrite_proposal(link_id, replacement, human_review=False):
    return {
        "link_id": link_id,
        "replacement": replacement,
        "review_required": True,
        "applied": human_review is True,
    }

events = [
    {"offset": 10, "payload": {"record_id": "r10"}},
    {"offset": 11, "payload": "malformed"},
    {"offset": 12, "payload": {"record_id": "r12"}},
    {"offset": 13, "payload": {"record_id": "r13"}},
]
sources = [
    {"name": "public-crawl", "kind": "crawler", "robots": "allow", "rate_budget": True, "authenticated": False},
    {"name": "blocked-crawl", "kind": "crawler", "robots": "deny", "rate_budget": True, "authenticated": False},
    {"name": "partner-api", "kind": "api", "robots": "n/a", "rate_budget": True, "authenticated": True},
    {"name": "unauthed-api", "kind": "api", "robots": "n/a", "rate_budget": True, "authenticated": False},
    {"name": "busy-crawl", "kind": "crawler", "robots": "allow", "rate_budget": False, "authenticated": False},
]
probes = {
    "healthy": {"HEAD": 200},
    "fallback-redirect": {"HEAD": 405, "GET": 301, "redirect_target": "document-new"},
    "restricted": {"HEAD": 403},
    "limited": {"HEAD": 429},
    "soft": {"HEAD": 200, "soft_404": True},
}

print("freshness", {"live": ingestion_mode(2), "nightly": ingestion_mode(720)})
print("stores", STORE_ROLES)
print("kafka", consume_log(events, checkpoint=10, capacity=3))
print("acquisition", {source["name"]: acquisition_policy(source) for source in sources})
print("parser", parse_links('<nav><a href="/guide">Guide</a><a href="/policy">Policy</a></nav>'))
print("probes", {name: classify_link(probe) for name, probe in probes.items()})
print("proposal", rewrite_proposal("fallback-redirect", "document-new"))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'HTMLParser',
        'PostgreSQL',
        'MongoDB',
        'vector store',
        'ClickHouse',
        'Kafka',
        'dead_letter',
        'backpressure',
        '"HEAD"',
        '"GET"',
        'soft_404',
        'human_review',
      ],
      printPatterns: [
        "freshness.*live.*realtime.*nightly.*batch",
        "stores.*PostgreSQL.*relational joins.*MongoDB.*document.*vector store.*semantic retrieval.*ClickHouse.*analytical events.*Kafka.*replay",
        "kafka.*replay_from.*10.*available_offsets.*10.*11.*12.*13.*processed.*r10.*r12.*dead_letter.*11.*invalid payload.*backpressure.*True.*next_checkpoint.*13",
        "acquisition.*public-crawl.*allowed.*True.*blocked-crawl.*allowed.*False.*robots.*partner-api.*allowed.*True.*unauthed-api.*allowed.*False.*authentication.*busy-crawl.*allowed.*False.*rate",
        "parser.*/guide.*/policy",
        "probes.*healthy.*'class': 'healthy'.*fallback-redirect.*'class': 'redirect'.*document-new.*restricted.*'class': 'restricted'.*limited.*'class': 'rate limited'.*soft.*'class': 'soft 404'",
        "proposal.*fallback-redirect.*document-new.*review_required.*True.*applied.*False",
      ],
      minNonEmptyPrints: 7,
    },
    hints: [
      'The realtime boundary is five minutes inclusive; sources with a larger freshness allowance can use scheduled batch processing instead.',
      'HEAD may be unsupported, so a 405 uses the supplied GET fixture; redirects are proposals, while 403, 429, and soft-404 outcomes need distinct handling.',
    ],
    predict: {
      prompt:
        'A crawler finds a redirect target that responds successfully; what should the learning workflow do before changing the source document?',
      choices: [
        'Propose the rewrite and require human review',
        'Rewrite every source automatically',
        'Ignore robots and rate policy',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Regular expressions do not implement an HTML parser and a status-only crawler misses policy, authentication, redirects, throttling, soft-404 pages, replay, and reviewed source changes.',
      wrong: 'links = regex_find(markup); rewrite_all(links)',
      fixed:
        'check acquisition policy -> parse structured markup -> probe HEAD with GET fallback -> classify -> propose -> human review -> verify and monitor',
    },
    stretch:
      'Stretch: replay from offset eleven after fixing its payload, prove r11 is processed exactly once, and advance the checkpoint without losing offsets twelve and thirteen.',
    pipeline: [
      'choose realtime or batch',
      'acquire under policy',
      'parse structured content',
      'publish replayable events',
      'consume with DLQ & backpressure',
      'review, verify & monitor',
    ],
  },
  {
    id: 'api-container-serverless-mechanics',
    difficulty: 'api',
    number: 40,
    topic: 'Containers & serverless mechanics',
    chapter: 'Ingestion & data systems',
    goal:
      'Compare VM/container isolation, boot time, kernel sharing and density, then model external state and event-driven functions. Done when Results shows balanced stateless requests, serverless costs and risks, and a completed upload-to-resize flow.',
    why:
      'Infrastructure choices become clearer when learners model what is isolated, where state lives, how work is routed and billed, and which cold-start, density, and function-sprawl trade-offs follow.',
    tasks: [
      'Contrast virtual machines and containers by kernel, boot, density, and isolation',
      'Route stateless replicas through a load balancer with Redis and database state',
      'Calculate serverless evidence and complete the upload-triggered resize pipeline',
    ],
    taskInstructions: [
      'Keep the VM as a guest-kernel boundary and the container as a shared-host-kernel process boundary so their isolation, startup, and density trade-offs remain accurate.',
      'Preserve session data in Redis and durable metadata in the database; round-robin routing must not depend on which stateless replica handled the prior call.',
      'Replace ??? with "write object storage" so resize work begins only after the original upload is durable and its created event can be replayed safely.',
    ],
    code: `# Lesson 40 — Containers and serverless mechanics
# Runtime facts, traffic, billing, and events are deterministic local fixtures.

import math

RUNTIMES = {
    "VM": {
        "kernel": "separate guest kernel",
        "boot_seconds": 45,
        "density": "lower",
        "isolation": "strong machine boundary",
    },
    "container": {
        "kernel": "shared host kernel",
        "boot_seconds": 2,
        "density": "higher",
        "isolation": "process and namespace boundary",
    },
}
REPLICAS = ["app-1", "app-2", "app-3"]
REDIS = {}
DATABASE = {}

def load_balance(call_number):
    return REPLICAS[call_number % len(REPLICAS)]

def handle(call_number, user, value):
    replica = load_balance(call_number)
    REDIS[f"session:{user}"] = {"last_value": value}
    DATABASE[user] = {"saved_value": value}
    return {
        "replica": replica,
        "session_store": "Redis",
        "durable_store": "database",
        "value": value,
    }

def serverless_evidence(invocations, duration_ms, memory_mb, idle_minutes, function_count):
    compute_units = invocations * duration_ms * memory_mb
    billed_units = math.ceil(compute_units / 1_000_000)
    return {
        "trigger": "event",
        "billing": "pay per use",
        "billed_units": billed_units,
        "cold_start_risk": idle_minutes >= 15,
        "function_sprawl": function_count > 20,
    }

def resize_upload(event):
    if event.get("kind") != "upload_created":
        return {"ok": False, "error": "unsupported event"}
    stages = [
        "validate upload metadata",
        ???,
        "emit upload-created event",
        "resize image",
        "write resized derivative",
    ]
    return {
        "ok": True,
        "object_id": event["object_id"],
        "stages": stages,
        "replay_key": event["event_id"],
    }

print("runtimes", RUNTIMES)
print("routes", [handle(index, "alice", index + 10) for index in range(4)])
print("state", {"redis": REDIS, "database": DATABASE})
print("serverless-small", serverless_evidence(100, 200, 256, 20, 4))
print("serverless-sprawl", serverless_evidence(1000, 900, 512, 1, 24))
print("resize", resize_upload({
    "event_id": "evt-7",
    "kind": "upload_created",
    "object_id": "image-9",
}))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'separate guest kernel',
        'shared host kernel',
        'boot_seconds',
        'density',
        'load_balance',
        'REDIS',
        'DATABASE',
        'pay per use',
        'cold_start_risk',
        'function_sprawl',
        'upload_created',
      ],
      printPatterns: [
        "runtimes.*VM.*separate guest kernel.*boot_seconds.*45.*density.*lower.*strong machine boundary.*container.*shared host kernel.*boot_seconds.*2.*density.*higher.*process and namespace boundary",
        "routes.*app-1.*Redis.*database.*10.*app-2.*11.*app-3.*12.*app-1.*13",
        "state.*redis.*session:alice.*last_value.*13.*database.*alice.*saved_value.*13",
        "serverless-small.*event.*pay per use.*billed_units.*6.*cold_start_risk.*True.*function_sprawl.*False",
        "serverless-sprawl.*pay per use.*billed_units.*461.*cold_start_risk.*False.*function_sprawl.*True",
        "resize.*'ok': True.*image-9.*validate upload metadata.*write object storage.*emit upload-created event.*resize image.*write resized derivative.*evt-7",
      ],
      minNonEmptyPrints: 6,
    },
    hints: [
      'The missing stage writes the original object before publishing the resize event; durable-first ordering makes retries and event replay safe.',
      'A load-balanced application remains horizontally replaceable only when session and durable data live outside individual container memory.',
    ],
    predict: {
      prompt:
        'An image upload should trigger resize work that can be retried after a worker stops; which ordering preserves the original and supports replay?',
      choices: [
        'Write object storage, emit an event, then resize',
        'Resize only in temporary process memory',
        'Emit success before storing the upload',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Containers are not lightweight virtual machines: they share a host kernel, start faster, and pack more densely, while process isolation is a different boundary from a guest kernel.',
      wrong: 'container = small_VM_with_its_own_kernel',
      fixed:
        'VM: virtual hardware plus guest kernel; container: isolated processes sharing host kernel; externalize state before horizontal replication',
    },
    stretch:
      'Stretch: make resize idempotent by recording evt-7 in a processed-event set, then replay the event and prove no second derivative is written or billed.',
    pipeline: [
      'choose isolation boundary',
      'externalize state',
      'load-balance replicas',
      'receive event',
      'store original',
      'resize idempotently',
    ],
  },
]
