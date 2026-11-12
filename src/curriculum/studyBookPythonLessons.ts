import type { LessonDraft } from '../examples'

type IntermediateStudyBookSpec = {
  id: string
  number: number
  topic: string
  chapter: string
  goal: string
  why: string
  tasks: [string, string, string]
  taskInstructions: [string, string, string]
  code: string
  codeIncludes: string[]
  printPatterns: string[]
  hints: string[]
  predict: {
    prompt: string
    answer: string
    distractors: [string, string]
  }
  compare: {
    note: string
    wrong: string
    fixed: string
  }
  stretch: string
}

function intermediateLesson(spec: IntermediateStudyBookSpec): LessonDraft {
  return {
    id: spec.id,
    difficulty: 'intermediate',
    number: spec.number,
    topic: spec.topic,
    chapter: spec.chapter,
    goal: spec.goal,
    why: spec.why,
    tasks: spec.tasks,
    taskInstructions: spec.taskInstructions,
    code: spec.code,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: spec.codeIncludes,
      printPatterns: spec.printPatterns,
      minNonEmptyPrints: spec.printPatterns.length,
    },
    hints: spec.hints,
    predict: {
      prompt: spec.predict.prompt,
      choices: [spec.predict.answer, ...spec.predict.distractors],
      correctIndex: 0,
    },
    compare: spec.compare,
    stretch: spec.stretch,
  }
}

export const STUDY_BOOK_PYTHON_LESSON_DRAFTS: LessonDraft[] = [
  intermediateLesson({
    id: 'mid-performance-profiling',
    number: 30,
    topic: 'Performance, memory & profiling',
    chapter: 'Python runtime',
    goal:
      'Choose a generator for a one-pass million-item stream, identify ranking as the measured hotspot, and match three memory problems to an appropriate Python lever.',
    why:
      'Performance work should start with measurements and data lifetime, because changing algorithms or representations usually matters more than guessing at micro-optimizations.',
    tasks: [
      'Choose the lazy representation for a one-pass stream',
      'Find the slowest stage from measured profile samples',
      'Match fixed records, binary slices, and caches to memory levers',
    ],
    taskInstructions: [
      'Set representation to the name of a Python object that produces items as needed instead of keeping a million items in memory. Results should describe a generator.',
      'In max(PROFILE_MS, key=...), supply a function that looks up each stage duration. Measured hotspot should identify rank at 21 ms.',
      'For binary_slice_tool, choose the MEMORY_LEVERS key describing a view of existing bytes. Results should show memoryview, alongside the four available memory tools.',
    ],
    code: `# Lesson 30 — Performance, memory, and profiling
# This deterministic profile avoids noisy wall-clock timing in the browser.

PROFILE_MS = {"parse": 3, "normalize": 5, "rank": 21, "format": 2}
MEMORY_LEVERS = {
    "many fixed-shape records": "__slots__",
    "slice bytes without copying": "memoryview",
    "cache must not own objects": "weakref",
    "dense numeric primitives": "array",
}

representation = ???
slowest = max(PROFILE_MS, key=???)
binary_slice_tool = MEMORY_LEVERS[???]

print("One-pass million-item stream:", representation)
print("Measured hotspot:", slowest, PROFILE_MS[slowest], "ms")
print("Binary slice lever:", binary_slice_tool)
print("Memory levers:", sorted(MEMORY_LEVERS.values()))
`,
    codeIncludes: ['"generator"', 'PROFILE_MS.get', '"slice bytes without copying"'],
    printPatterns: [
      'One-pass million-item stream: generator',
      'Measured hotspot: rank 21 ms',
      'Binary slice lever: memoryview',
      "Memory levers:.*__slots__.*array.*memoryview.*weakref",
    ],
    hints: [
      'A generator does not materialize every square at once.',
      'Pass PROFILE_MS.get as the key function to max.',
      'Use the exact "slice bytes without copying" key for memoryview.',
    ],
    predict: {
      prompt: 'What should happen before optimizing a suspected slow function?',
      answer: 'Measure it with a profiler',
      distractors: ['Rewrite every loop', 'Add a cache everywhere'],
    },
    compare: {
      note: 'A list keeps every result alive, while a generator produces values only as the consumer requests them.',
      wrong: 'values = [transform(row) for row in million_rows]',
      fixed: 'values = (transform(row) for row in million_rows)',
    },
    stretch:
      'Stretch: add a second profile where parsing is slowest, then prove the same max-with-key analysis selects parse without changing the analyzer.',
  }),
  intermediateLesson({
    id: 'mid-concurrency-gil',
    number: 31,
    topic: 'Concurrency, the GIL & races',
    chapter: 'Python runtime',
    goal:
      'Route blocking I/O, CPU-bound work, and many waiting operations to threads, processes, and asyncio, then expose a lost-update race from an interleaving trace.',
    why:
      'Python concurrency is a workload decision: the GIL limits parallel bytecode in one process, while races and cancellation bugs still require explicit engineering.',
    tasks: [
      'Choose threads for a small set of blocking I/O calls',
      'Choose processes for CPU-bound parallel work and asyncio for many waits',
      'Detect the lost update in a read-modify-write interleaving',
    ],
    taskInstructions: [
      'In choose_model, fill the final return with a quoted execution model suited to a few blocking calls. The Blocking I/O line should name threads.',
      'Fill the cpu and many branches of choose_model with model names for parallel calculation and many waiting operations. CPU work and Many waits should name processes and asyncio.',
      'Read the read and write values in interleaving before running. Race detected should be True with final: 1; expecting 2 would overlook the overwritten update.',
    ],
    code: `# Lesson 31 — Concurrency, the GIL, and races
# Choices are simulated so the lesson remains deterministic in every browser.

def choose_model(workload, many=False):
    if workload == "cpu":
        return ???
    if workload == "io" and many:
        return ???
    return ???

# Two workers read 0 before either writes. Both then write 1.
interleaving = [
    ("A", "read", 0),
    ("B", "read", 0),
    ("A", "write", 1),
    ("B", "write", 1),
]
final_value = interleaving[-1][2]
lost_update = final_value != 2

print("Blocking I/O:", choose_model("io"))
print("CPU work:", choose_model("cpu"))
print("Many waits:", choose_model("io", many=True))
print("Race detected:", lost_update, "final:", final_value)
`,
    codeIncludes: ['"processes"', '"asyncio"', '"threads"'],
    printPatterns: [
      'Blocking I/O: threads',
      'CPU work: processes',
      'Many waits: asyncio',
      'Race detected: True final: 1',
    ],
    hints: [
      'Processes can run CPU-heavy Python bytecode in separate interpreters.',
      'asyncio is a strong fit for many cooperative waits.',
      'Threads remain useful for a modest number of blocking I/O operations.',
    ],
    predict: {
      prompt: 'Does the GIL automatically prevent application-level race conditions?',
      answer: 'No, shared read-modify-write logic can still race',
      distractors: ['Yes, all shared state is safe', 'Only when asyncio is installed'],
    },
    compare: {
      note: 'Concurrency models solve different bottlenecks; thread count is not a universal performance dial.',
      wrong: 'model = "threads"  # for every workload',
      fixed: 'model = choose_by_io_cpu_and_concurrency_shape(workload)',
    },
    stretch:
      'Stretch: add a shared-lock policy that serializes each read-and-write pair and print evidence that the protected final value becomes two.',
  }),
  intermediateLesson({
    id: 'mid-oop-mro-data-model',
    number: 32,
    topic: 'MRO, contracts & the data model',
    chapter: 'Python object model',
    goal:
      'Complete an abstract validation contract, inspect the diamond-shaped method resolution order, and make a record expose a useful developer representation.',
    why:
      'Python objects cooperate through explicit contracts and dunder protocols, while understanding C3 method resolution prevents surprising behavior in multiple inheritance.',
    tasks: [
      'Mark the base validation method as an abstract contract',
      'Complete the diamond inheritance order and inspect its MRO',
      'Return a useful repr string from the concrete record',
    ],
    taskInstructions: [
      'Above Validated.validate, use the imported decorator that requires subclasses to implement this method. With Record implementing it, Valid should print True.',
      'In the Record parent list, add the other branch of the diamond after Left. The MRO line should visit Left, Right and then Root, without visiting Root twice.',
      'Inside Record.__repr__, return formatted text containing the class name and self._value. Repr should show Record(value=7), making the stored value readable.',
    ],
    code: `# Lesson 32 — MRO, contracts, and dunder methods

from abc import ABC, abstractmethod

class Validated(ABC):
    @???
    def validate(self):
        raise NotImplementedError

class Root:
    def source(self):
        return "root"

class Left(Root):
    pass

class Right(Root):
    pass

class Record(Left, ???, Validated):
    def __init__(self, value):
        self._value = value

    def validate(self):
        return self._value >= 0

    def __repr__(self):
        return ???

record = Record(7)
print("MRO:", [kind.__name__ for kind in Record.mro()])
print("Valid:", record.validate())
print("Repr:", repr(record))
`,
    codeIncludes: ['@abstractmethod', 'class Record(Left, Right, Validated)', 'return f"Record(value={self._value})"'],
    printPatterns: [
      "MRO:.*Record.*Left.*Right.*Root.*Validated.*ABC.*object",
      'Valid: True',
      'Repr: Record\\(value=7\\)',
    ],
    hints: [
      'Use the imported abstractmethod decorator without calling it.',
      'Right is the second branch of the diamond.',
      'Return f"Record(value={self._value})" from __repr__.',
    ],
    predict: {
      prompt: 'Which algorithm determines Python multiple-inheritance lookup order?',
      answer: 'The C3 method resolution order',
      distractors: ['Alphabetical class names', 'Random branch selection'],
    },
    compare: {
      note: 'Abstract contracts fail early at construction, whereas a comment asking subclasses to implement a method is not enforceable.',
      wrong: 'class Base:\n    # subclasses should validate someday',
      fixed: 'class Base(ABC):\n    @abstractmethod\n    def validate(self): ...',
    },
    stretch:
      'Stretch: add __eq__ so records compare by value, then print both an equal pair and an unequal pair as executable protocol evidence.',
  }),
  intermediateLesson({
    id: 'mid-java-core-bridge',
    number: 33,
    topic: 'Java core through Python',
    chapter: 'JVM bridges',
    goal:
      'Match Java garbage collection, interface contracts, immutable strings, and exception cleanup to precise concepts while implementing the closest Python contract.',
    why:
      'Cross-language comparisons make Java interview material memorable without pretending Python and the JVM have identical object, type, or garbage-collection semantics.',
    tasks: [
      'Complete the Java core concept map with immutable strings',
      'Implement the interface-like abstract method in Python',
      'Use finally to prove cleanup happens after an exception',
    ],
    taskInstructions: [
      'Fill JAVA_CORE["String"] with a quoted description of text that cannot change in place. The Java String line should describe immutable text.',
      'In JsonLikeFormatter.format, return a dictionary with a value key holding the argument. Contract should show a dictionary containing 7.',
      'In finally, append a quoted cleanup event to events. Exception flow should list work, handled, then cleanup, proving the last block still ran.',
    ],
    code: `# Lesson 33 — Java core concepts through a Python bridge

from abc import ABC, abstractmethod

JAVA_CORE = {
    "GC": "reclaims unreachable heap objects",
    "interface": "declares a contract implemented by classes",
    "String": ???,
    "checked exception": "must be declared or handled at compile time",
}

class Formatter(ABC):
    @abstractmethod
    def format(self, value):
        raise NotImplementedError

class JsonLikeFormatter(Formatter):
    def format(self, value):
        return ???

events = []
try:
    events.append("work")
    raise ValueError("simulated")
except ValueError:
    events.append("handled")
finally:
    events.append(???)

print("Java String:", JAVA_CORE["String"])
print("Contract:", JsonLikeFormatter().format(7))
print("Exception flow:", events)
`,
    codeIncludes: ['"immutable"', 'return {"value": value}', '"cleanup"'],
    printPatterns: [
      'Java String: immutable',
      "Contract: \\{'value': 7\\}",
      "Exception flow: \\['work', 'handled', 'cleanup'\\]",
    ],
    hints: [
      'Java String instances are immutable.',
      'Return a dictionary containing the input under the value key.',
      'Append the literal "cleanup" in the finally block.',
    ],
    predict: {
      prompt: 'Which Java feature has no exact Python equivalent?',
      answer: 'Compile-time checked exceptions',
      distractors: ['Classes', 'Immutable text values'],
    },
    compare: {
      note: 'Java interfaces and Python ABCs both express contracts, but enforcement happens at different points in their type systems.',
      wrong: '# implementers will remember the required method',
      fixed: 'declare an interface in Java or an ABC with @abstractmethod in Python',
    },
    stretch:
      'Stretch: add a second formatter implementation and show polymorphism by calling both through one list of Formatter-compatible objects.',
  }),
  intermediateLesson({
    id: 'mid-java-collections-bridge',
    number: 34,
    topic: 'Java collections through Python',
    chapter: 'JVM bridges',
    goal:
      'Simulate HashMap bucket collisions, distinguish list, set, and queue behavior, and reproduce a typed Java stream filter-and-sort pipeline with Python data.',
    why:
      'Java collection choices encode ordering, uniqueness, and access costs; a small Python simulation exposes those same trade-offs without hiding HashMap collision behavior.',
    tasks: [
      'Place names into deterministic hash buckets and preserve collisions',
      'Use a set for uniqueness and a list as a queue',
      'Filter and sort scores like a Java Stream pipeline',
    ],
    taskInstructions: [
      'Use the number of entries in buckets as the divisor after %. The Buckets line should retain repeated Ada entries instead of replacing names that share a bucket.',
      'Construct unique_names from names with a collection that removes duplicates, and use the front index in queue.pop. Unique should contain three names; Queue first should be Ada.',
      'Trace the score filter and descending sort in passing. Stream result should put Ada before Grace and omit Alan; a different order points to the sort direction.',
    ],
    code: `# Lesson 34 — Java collections and generics through Python

names = ["Ada", "Alan", "Grace", "Ada"]
buckets = {0: [], 1: [], 2: []}
for name in names:
    bucket = sum(ord(char) for char in name) % ???
    buckets[bucket].append(name)

unique_names = ???
queue = list(names)
first_out = queue.pop(???)
passing = sorted(
    ({"name": name, "score": score} for name, score in [("Ada", 91), ("Alan", 72), ("Grace", 88)] if score >= 80),
    key=lambda row: row["score"],
    reverse=True,
)

print("Buckets:", buckets)
print("Unique:", sorted(unique_names))
print("Queue first:", first_out)
print("Stream result:", passing)
`,
    codeIncludes: ['% 3', 'set(names)', 'queue.pop(0)'],
    printPatterns: [
      'Buckets:.*Ada.*Alan.*Grace',
      "Unique: \\['Ada', 'Alan', 'Grace'\\]",
      'Queue first: Ada',
      "Stream result:.*Ada.*91.*Grace.*88",
    ],
    hints: [
      'The bucket dictionary has three buckets, so use modulo 3.',
      'Construct set(names) to remove the duplicate Ada.',
      'A FIFO queue removes the element at index zero in this tiny simulation.',
    ],
    predict: {
      prompt: 'What is Java HashMap lookup complexity under ordinary well-distributed hashing?',
      answer: 'Average O(1), with collisions still handled',
      distractors: ['Always O(1) in every case', 'Always O(n log n)'],
    },
    compare: {
      note: 'List, Set, and Queue interfaces state different guarantees; choosing by habit can silently lose order or duplicate information.',
      wrong: 'collection = HashSet()  // even when duplicates and order matter',
      fixed: 'choose List, Set, Map, or Queue from the required semantics',
    },
    stretch:
      'Stretch: print every bucket with more than one entry and explain why equality checks are still required after hashes choose a bucket.',
  }),
  intermediateLesson({
    id: 'mid-java-concurrency-bridge',
    number: 35,
    topic: 'Java concurrency through Python',
    chapter: 'JVM bridges',
    goal:
      'Match synchronized, Lock, wait, sleep, volatile, and ExecutorService to their responsibilities, then distribute queued jobs across a fixed worker pool.',
    why:
      'Java concurrency interviews test coordination semantics rather than thread syntax, so this deterministic model separates mutual exclusion, visibility, waiting, and task scheduling.',
    tasks: [
      'Map Java primitives to exclusion, visibility, and coordination jobs',
      'Assign submitted tasks to a bounded executor pool',
      'Distinguish condition waiting from sleeping for time',
    ],
    taskInstructions: [
      'For JAVA_PRIMITIVES["volatile"], choose the quoted description that lets another thread see an update without making a read-plus-write indivisible. The Volatile line should distinguish those two guarantees.',
      'In execute, wrap index around the size of the worker pool using a remainder divisor. Executor assignments should put ingest and rank on worker 0, embed and evaluate on worker 1.',
      'Choose the JAVA_PRIMITIVES key for releasing a monitor until a notification arrives. Condition wait should describe releasing the monitor, not simply pausing for elapsed time.',
    ],
    code: `# Lesson 35 — Java concurrency concepts through Python

JAVA_PRIMITIVES = {
    "synchronized": "mutual exclusion plus visibility",
    "Lock": "explicit acquire/release and advanced locking",
    # Pick one:
    #   "visibility, not compound-operation atomicity"
    #   "mutual exclusion for every compound operation"
    #   "thread-local values with no cross-thread visibility"
    "volatile": ???,
    "wait": "release monitor and wait for notification",
    "sleep": "pause without releasing an owned monitor",
}

def execute(tasks, worker_count):
    assignments = {worker: [] for worker in range(worker_count)}
    for index, task in enumerate(tasks):
        worker = index % ???
        assignments[worker].append(task)
    return assignments

pool = execute(["ingest", "embed", "rank", "evaluate"], 2)
coordination = JAVA_PRIMITIVES[???]

print("Volatile:", JAVA_PRIMITIVES["volatile"])
print("Executor assignments:", pool)
print("Condition wait:", coordination)
`,
    codeIncludes: ['"visibility, not compound-operation atomicity"', 'index % worker_count', '"wait"'],
    printPatterns: [
      'Volatile: visibility, not compound-operation atomicity',
      "Executor assignments:.*ingest.*rank.*embed.*evaluate",
      'Condition wait: release monitor and wait for notification',
    ],
    hints: [
      'volatile publishes visibility but does not make increment atomic.',
      'Use worker_count as the round-robin modulus.',
      'Look up the exact "wait" primitive for notification-based coordination.',
    ],
    predict: {
      prompt: 'Does Java volatile make count++ atomic?',
      answer: 'No, it provides visibility but count++ is compound',
      distractors: ['Yes, it replaces every lock', 'Only in an ExecutorService'],
    },
    compare: {
      note: 'ExecutorService separates task submission from thread lifecycle and prevents unbounded thread creation.',
      wrong: 'new Thread(task).start();  // for every incoming request',
      fixed: 'executor.submit(task);  // bounded, managed worker pool',
    },
    stretch:
      'Stretch: add a queue-capacity limit, reject a fifth pending task, and print the rejection policy chosen for overload protection.',
  }),
  intermediateLesson({
    id: 'mid-spring-service-bridge',
    number: 36,
    topic: 'Spring services through Python',
    chapter: 'JVM bridges',
    goal:
      'Wire repository, service, and controller dependencies through constructors, then trace a request through validation, business logic, persistence, and response formatting.',
    why:
      'Spring becomes easier to reason about when dependency injection and the request lifecycle are treated as explicit object wiring rather than annotation magic.',
    tasks: [
      'Inject the repository into the service constructor',
      'Inject the service into the controller and execute the request',
      'Select a test profile without changing production objects',
    ],
    taskInstructions: [
      'In Service.__init__, store the object passed into the constructor on self.repository. Response should contain the document returned by Repository.find.',
      'In Controller.__init__, store its supplied service so handle can call get. The request for d7 should produce status 200 and a body with that id.',
      'Select the profiles key for tests in the final print. Test profile should say in-memory repository while the existing Response still contains the document.',
    ],
    code: `# Lesson 36 — Spring and Spring Boot through explicit Python wiring

class Repository:
    def find(self, item_id):
        return {"id": item_id, "name": "document"}

class Service:
    def __init__(self, repository):
        self.repository = ???

    def get(self, item_id):
        return self.repository.find(item_id)

class Controller:
    def __init__(self, service):
        self.service = ???

    def handle(self, request):
        item = self.service.get(request["path_id"])
        return {"status": 200, "body": item}

profiles = {"prod": "real repository", "test": "in-memory repository"}
controller = Controller(Service(Repository()))
response = controller.handle({"path_id": "d7"})

print("Lifecycle:", ["filter", "controller", "service", "repository", "response"])
print("Response:", response)
print("Test profile:", profiles[???])
`,
    codeIncludes: ['self.repository = repository', 'self.service = service', 'profiles["test"]'],
    printPatterns: [
      "Lifecycle:.*filter.*controller.*service.*repository.*response",
      "Response:.*'status': 200.*'id': 'd7'",
      'Test profile: in-memory repository',
    ],
    hints: [
      'Assign the repository constructor parameter to self.repository.',
      'Assign the service constructor parameter to self.service.',
      'Use the "test" profile key for the in-memory dependency.',
    ],
    predict: {
      prompt: 'Why is constructor injection preferred for required Spring dependencies?',
      answer: 'Dependencies are explicit and the object cannot be half-wired',
      distractors: ['It removes all interfaces', 'It skips controller tests'],
    },
    compare: {
      note: 'Spring Boot starters and auto-configuration reduce setup, but the underlying dependency graph and request lifecycle still matter.',
      wrong: 'service = GlobalContainer.get("service") inside every method',
      fixed: 'Controller(Service(Repository()))  # explicit constructor dependencies',
    },
    stretch:
      'Stretch: inject a FakeRepository that returns a test record and prove the controller can be tested without changing Controller or Service.',
  }),
  intermediateLesson({
    id: 'mid-design-patterns',
    number: 37,
    topic: 'Design patterns in Python',
    chapter: 'Engineering practice',
    goal:
      'Select a ranking strategy, create it through a factory, notify multiple observers, and identify where Builder, Proxy, and Singleton would or would not help.',
    why:
      'Patterns are names for recurring trade-offs, and implementing small Strategy, Factory, and Observer examples is more useful than memorizing a catalog without context.',
    tasks: [
      'Select a strategy without branching inside the caller',
      'Create the chosen strategy through a small factory',
      'Notify every registered observer after ranking completes',
    ],
    taskInstructions: [
      'Choose a STRATEGIES key for the create_ranker call that favors freshness over quality. Winner should be new even though old has the higher quality score.',
      'Inside create_ranker, use its argument to look up the scoring function in STRATEGIES. The freshness choice should let max select new without adding branches to the caller.',
      'In the observers loop, pass a dictionary with the ranked key holding winner. Both audit and metrics should report the same event containing new.',
    ],
    code: `# Lesson 37 — Strategy, Factory, and Observer

def score_by_quality(item):
    return item["quality"]

def score_by_freshness(item):
    return item["freshness"]

STRATEGIES = {
    "quality": score_by_quality,
    "freshness": score_by_freshness,
}

def create_ranker(name):
    return STRATEGIES[???]

observers = []
observers.append(lambda event: print("audit:", event))
observers.append(lambda event: print("metrics:", event))

items = [{"id": "old", "quality": 9, "freshness": 2}, {"id": "new", "quality": 7, "freshness": 10}]
strategy = create_ranker(???)
winner = max(items, key=strategy)["id"]
for observer in observers:
    observer(???)

print("Winner:", winner)
`,
    codeIncludes: ['STRATEGIES[name]', 'create_ranker("freshness")', 'observer({"ranked": winner})'],
    printPatterns: [
      "audit:.*ranked.*new",
      "metrics:.*ranked.*new",
      'Winner: new',
    ],
    hints: [
      'Index STRATEGIES with the factory name parameter.',
      'Choose the "freshness" strategy so the new item wins.',
      'Send each observer the same {"ranked": winner} event.',
    ],
    predict: {
      prompt: 'When does Strategy help most?',
      answer: 'When one policy must vary independently from its caller',
      distractors: ['When exactly one immutable behavior exists', 'When global state is required'],
    },
    compare: {
      note: 'A pattern should make variation or collaboration clearer; adding indirection without that pressure is needless complexity.',
      wrong: 'if mode == "a": ... elif mode == "b": ... in every caller',
      fixed: 'strategy = STRATEGIES[mode]; result = strategy(item)',
    },
    stretch:
      'Stretch: add a cached Proxy around one strategy, count real score calculations, and prove the second identical ranking reuses its result.',
  }),
  intermediateLesson({
    id: 'mid-tdd-delivery',
    number: 38,
    topic: 'TDD, CI/CD & incident response',
    chapter: 'Engineering practice',
    goal:
      'Complete a palindrome implementation from table-driven tests, order the red-green-refactor cycle, and preserve a safe CI/CD and production-incident workflow.',
    why:
      'Delivery practices turn code into reliable service behavior: tests define intent, pipelines repeat checks, and incident steps protect users while evidence is gathered.',
    tasks: [
      'Normalize text so every palindrome test passes',
      'Place green between red and refactor in the TDD cycle',
      'Order CI/CD checks and the first incident action safely',
    ],
    taskInstructions: [
      'In is_palindrome, choose a character method that keeps letters and digits while ignoring spaces and punctuation. Tests should read 4/4 for the supplied cases.',
      'Fill the middle of tdd_cycle with the phase reached when a failing test first passes. TDD should show the successful phase between red and refactor.',
      'For ci_cd, choose a check that detects security vulnerabilities before release; for incident, choose immediate harm reduction before diagnosis. Results should put checks before deployment and protection before investigation.',
    ],
    code: `# Lesson 38 — TDD, delivery, and incident response

def is_palindrome(text):
    normalized = "".join(char.lower() for char in text if char.???())
    return normalized == normalized[::-1]

cases = [
    ("Racecar", True),
    ("Never odd or even", True),
    ("Python", False),
    ("", True),
]
passed = sum(is_palindrome(text) == expected for text, expected in cases)

tdd_cycle = ["red", ???, "refactor"]
# Pick one:
#   "security scan"
#   "performance benchmark"
#   "integration tests"
ci_cd = ["lint", "unit tests", ???, "deploy canary", "monitor"]
# Pick one:
#   "restart every dependent service"
#   "diagnose root cause first"
#   "mitigate user impact"
incident = [???, "preserve evidence", "diagnose", "repair", "review"]

print("Tests:", f"{passed}/{len(cases)}")
print("TDD:", tdd_cycle)
print("CI/CD:", ci_cd)
print("Incident first:", incident[0])
`,
    codeIncludes: ['char.isalnum()', '"green"', '"security scan"', '"mitigate user impact"'],
    printPatterns: [
      'Tests: 4/4',
      "TDD: \\['red', 'green', 'refactor'\\]",
      "CI/CD:.*lint.*unit tests.*security scan.*deploy canary.*monitor",
      'Incident first: mitigate user impact',
    ],
    hints: [
      'Keep only alphanumeric characters with char.isalnum().',
      'A minimal passing change is the green stage.',
      'Use "security scan" before deployment and "mitigate user impact" first during an incident.',
    ],
    predict: {
      prompt: 'What is the first priority during a critical production incident?',
      answer: 'Reduce user harm with a safe mitigation',
      distractors: ['Rewrite the system immediately', 'Delete the logs'],
    },
    compare: {
      note: 'TDD is a feedback loop, not a demand to predict every implementation detail before learning from a failing example.',
      wrong: 'implement everything, deploy, then consider tests',
      fixed: 'write one failing example, make it pass, refactor, and repeat',
    },
    stretch:
      'Stretch: add a failing unicode punctuation case, improve normalization deliberately, and print the new five-of-five regression result.',
  }),
  intermediateLesson({
    id: 'mid-corrections-gotchas',
    number: 39,
    topic: 'Interview corrections & gotchas',
    chapter: 'Interview practice',
    goal:
      'Fill the three missing descriptions of dictionary order, HashSet lookup cost and LLM behavior. Done when Results shows insertion order, average lookup cost with its caveat, and an LLM description based on learned patterns and context.',
    why:
      'The python_gc and java_finalize entries are worked examples; their lifecycle descriptions are already complete. Your three edits practice precise claims about dictionary ordering, HashSet lookup cost and learned language patterns.',
    tasks: [
      'Fill dict_order with Python\'s ordering behavior',
      'Fill hashset_lookup with the typical lookup cost',
      'Fill llm_wording with a precise model description',
    ],
    taskInstructions: [
      'In CORRECTIONS, replace dict_order with the quoted choice that preserves entry arrival order without sorting keys. The Python dict line should describe insertion order and note OrderedDict\'s extra operations.',
      'In CORRECTIONS, replace hashset_lookup with the quoted choice describing typical lookup cost without promising it for every input. The HashSet line should show the average-cost claim and its worst-case caveat.',
      'For llm_wording, choose the description of learned patterns informed by the current input, rather than a fixed fact lookup or human certainty. The LLM line should express that limited claim.',
    ],
    code: `# Lesson 39 — Corrections and gotchas

CORRECTIONS = {
    "python_gc": "reference counting plus cyclic garbage collection",
    # Pick one:
    #   "unordered in every Python version"
    #   "insertion-ordered in modern Python; OrderedDict still has specialized APIs"
    #   "automatically sorted by key in modern Python"
    "dict_order": ???,
    "java_finalize": "deprecated and unreliable; use explicit resource management",
    # Pick one:
    #   "average O(1), not an unconditional worst-case guarantee"
    #   "guaranteed O(1) for every possible input"
    #   "always O(n) even with well-distributed hashes"
    "hashset_lookup": ???,
    "dead_link": ["inventory", "classify", "redirect or repair", "verify", "monitor"],
    # Pick one:
    #   "looks up every answer in a fixed fact database"
    #   "understands every statement with human certainty"
    #   "learns statistical representations and uses context"
    "llm_wording": ???,
}

expected_keys = {"python_gc", "dict_order", "java_finalize", "hashset_lookup", "dead_link", "llm_wording"}
complete = set(CORRECTIONS) == expected_keys

print("Python dict:", CORRECTIONS["dict_order"])
print("HashSet:", CORRECTIONS["hashset_lookup"])
print("Dead-link workflow:", " -> ".join(CORRECTIONS["dead_link"]))
print("LLM:", CORRECTIONS["llm_wording"])
print("Correction set complete:", complete)
`,
    codeIncludes: [
      '"insertion-ordered in modern Python; OrderedDict still has specialized APIs"',
      '"average O(1), not an unconditional worst-case guarantee"',
      '"learns statistical representations and uses context"',
    ],
    printPatterns: [
      'Python dict: insertion-ordered in modern Python',
      'HashSet: average O\\(1\\), not an unconditional worst-case guarantee',
      'Dead-link workflow: inventory -> classify -> redirect or repair -> verify -> monitor',
      'LLM: learns statistical representations and uses context',
      'Correction set complete: True',
    ],
    hints: [
      'Modern dict preserves insertion order, while OrderedDict retains specialized ordering operations.',
      'HashSet lookup is average O(1), not an unconditional worst-case promise.',
      'Say the LLM learns statistical representations and uses context rather than claiming human understanding.',
    ],
    predict: {
      prompt: 'Is Java Object.finalize a dependable cleanup mechanism?',
      answer: 'No, it is deprecated and nondeterministic',
      distractors: ['Yes, it runs immediately', 'Only for immutable strings'],
    },
    compare: {
      note: 'Interview precision includes the conditions and version boundaries behind a short claim.',
      wrong: 'HashSet is always O(1), and Python only uses reference counting.',
      fixed: 'HashSet is average O(1); Python also has a cyclic garbage collector.',
    },
    stretch:
      'Stretch: add two more version-sensitive claims, attach a one-line caveat to each, and assert that every correction contains evidence or a boundary.',
  }),
  intermediateLesson({
    id: 'mid-advanced-functional-idioms',
    number: 40,
    topic: 'Functional tools & pytest fixtures',
    chapter: 'Idiomatic Python',
    goal:
      'Use every named functional and comprehension idiom, preserve decorator metadata, and prove pytest-style fixture setup, injection, assertions, and teardown with visible evidence.',
    why:
      'These compact idioms matter when they preserve intent: metadata-safe decorators, reusable key functions, heap use cases, named tests, and fixture-owned cleanup reduce hidden mistakes.',
    tasks: [
      'Compose list, set, filter, map, reduce, itemgetter, attrgetter, and heap operations',
      'Complete a parameterized decorator with functools.wraps',
      'Bind one lookup with walrus and prove pytest fixture and assertion semantics',
    ],
    taskInstructions: [
      'For names, choose the row field containing a person name; for best_object, build an attribute-based score key. Functional should show Ada and Grace totaling 179, and Attrgetter should show Ada.',
      'Use the imported metadata-preserving decorator above wrapped, passing the wrapped function. Decorator should retain the name best_name and show result:Ada.',
      'Use the cache key holding the ranked result, and append a cleanup event after the yield in resource_fixture. Walrus should show result:Ada and Fixture should end with teardown.',
    ],
    code: `# Lesson 40 — Functional tools, syntax, and pytest fixture ideas

from functools import reduce, wraps
from heapq import nlargest
from operator import attrgetter, itemgetter

rows = [
    {"name": "Ada", "score": 91},
    {"name": "Alan", "score": 72},
    {"name": "Grace", "score": 88},
]
passing = list(filter(lambda row: row["score"] >= 80, rows))
names = list(map(itemgetter(???), passing))
total = reduce(lambda acc, row: acc + row["score"], passing, 0)
ranked = sorted(passing, key=itemgetter("score"), reverse=True)
initials = {row["name"][0] for row in rows}
top_two = nlargest(2, rows, key=itemgetter("score"))

class ScoreRecord:
    def __init__(self, name, score):
        self.name = name
        self.score = score

objects = [ScoreRecord(row["name"], row["score"]) for row in rows]
best_object = max(objects, key=???)

def label(prefix):
    def decorate(function):
        @???
        def wrapped(*args, **kwargs):
            return f"{prefix}:{function(*args, **kwargs)}"
        return wrapped
    return decorate

@label("result")
def best_name():
    return ranked[0]["name"]

cache = {"winner": best_name()}
if (winner := cache.get(???)) is not None:
    print("Walrus:", winner)

events = []
def resource_fixture():
    events.append("setup")
    yield {"ready": True}
    events.append(???)

# In pytest, @pytest.fixture registers this provider; a test parameter with
# the fixture name receives the yielded value, and teardown resumes afterward.
fixture = resource_fixture()
resource = next(fixture)
try:
    next(fixture)
except StopIteration:
    pass

PYTEST_RULES = {
    "fixture": "@pytest.fixture injects state by a test parameter name",
    "test_name": "test_ranker_orders_highest_first documents behavior",
    "assertions": "multiple assertions are fine for one result object",
}
COMPREHENSION_NOTE = "concise and commonly faster than an equivalent manual append loop"
HEAP_USES = ["scheduler", "top-k", "Dijkstra"]

print("Functional:", names, total)
print("Ranked:", [row["name"] for row in ranked])
print("Set comprehension:", sorted(initials))
print("Attrgetter:", best_object.name)
print("Top two:", [row["name"] for row in top_two], "heap uses:", HEAP_USES)
print("Decorator:", best_name.__name__, best_name())
print("Fixture:", resource, events)
print("Pytest:", PYTEST_RULES)
print("Comprehension:", COMPREHENSION_NOTE)
`,
    codeIncludes: [
      'itemgetter("name")',
      'attrgetter("score")',
      '@wraps(function)',
      'cache.get("winner")',
      'events.append("teardown")',
      'reduce(',
      ':=',
      'yield',
      '@pytest.fixture',
      'test_ranker_orders_highest_first',
      'multiple assertions are fine',
      'nlargest(',
      'Dijkstra',
    ],
    printPatterns: [
      'Walrus: result:Ada',
      "Functional: \\['Ada', 'Grace'\\] 179",
      "Ranked: \\['Ada', 'Grace'\\]",
      "Set comprehension: \\['A', 'G'\\]",
      'Attrgetter: Ada',
      "Top two: \\['Ada', 'Grace'\\].*scheduler.*top-k.*Dijkstra",
      'Decorator: best_name result:Ada',
      "Fixture:.*'ready': True.*setup.*teardown",
      "Pytest:.*@pytest.fixture injects state.*test_ranker_orders_highest_first.*multiple assertions are fine",
      'Comprehension: concise and commonly faster',
    ],
    hints: [
      'itemgetter("name") extracts each passing record’s name without a lambda.',
      'Use attrgetter("score"), then decorate wrapped with wraps(function) so metadata survives.',
      'Look up "winner" once and append "teardown" when the simulated pytest fixture resumes.',
    ],
    predict: {
      prompt: 'Why should a decorator apply functools.wraps to its inner wrapper?',
      answer: 'It preserves the wrapped function’s metadata for introspection',
      distractors: ['It runs the function in parallel', 'It converts every result to JSON'],
    },
    compare: {
      note: 'A pytest yield fixture places setup before yield and teardown after it, so cleanup still has one visible ownership point.',
      wrong: 'def fixture(): return resource  # teardown has no fixture-owned path',
      fixed: 'def fixture():\n    resource = open_resource()\n    yield resource\n    resource.close()',
    },
    stretch:
      'Stretch: add an itertools pipeline for one streaming transformation and compare its clarity with the equivalent comprehension and higher-order composition.',
  }),
]
