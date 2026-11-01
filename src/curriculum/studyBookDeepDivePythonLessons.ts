import type { LessonDraft } from '../examples'

type DeepDiveLessonSpec = {
  id: string
  number: number
  topic: string
  chapter: string
  goal: string
  why: string
  tasks: string[]
  taskInstructions: string[]
  code: string
  codeIncludes: string[]
  printPatterns: string[]
  hints: string[]
  predict: {
    prompt: string
    choices: [string, string, string]
    correctIndex: number
  }
  compare: {
    note: string
    wrong: string
    fixed: string
  }
  stretch: string
}

function deepDiveLesson(spec: DeepDiveLessonSpec): LessonDraft {
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
    predict: spec.predict,
    compare: spec.compare,
    stretch: spec.stretch,
  }
}

export const STUDY_BOOK_DEEP_DIVE_PYTHON_LESSON_DRAFTS: LessonDraft[] = [
  deepDiveLesson({
    id: 'mid-memory-tools-deep-dive',
    number: 41,
    topic: 'CPython memory tools',
    chapter: 'Python runtime deep dives',
    goal:
      'Prove immediate reference-count release and separate cyclic collection, mutate a bytearray through a zero-copy memoryview, exercise slotted and weak-referenceable records plus a packed array, and match four profiling tools to their precise jobs.',
    why:
      'Memory debugging becomes reliable when object lifetime, cycles, copies, representation, and measurement tools are treated separately instead of reaching for gc.collect or micro-optimizations by habit.',
    tasks: [
      'Make a slotted node weak-referenceable and distinguish reference-count release from cyclic garbage collection',
      'Create a memoryview slice that mutates its original bytearray without copying',
      'Store compact integers in an array and prove a slotted instance has no per-instance dictionary',
      'Match memory_profiler, dis, cProfile, and timeit to their distinct diagnostic roles',
    ],
    taskInstructions: [
      'Replace the slots blank with name, peer, and __weakref__. Run the non-cycle and cycle examples: the first weak reference must die after del, while the disabled cyclic collector keeps the cycle alive until the explicit diagnostic gc.collect call.',
      'Use the slice 1:4 over memoryview(buffer), then assign ord("z") through the view. Results must show that window.obj is the original bytearray and that the original text changed to AzCDE.',
      'Choose the signed-integer type code "i" for array. Keep the existing slots check and confirm Results shows no __dict__, the record name, the type code, and the packed values.',
      'Fill the four role strings with line-by-line memory, bytecode inspection, whole-program CPU profile, and small benchmark comparison in that order; each tool should answer one different measurement question.',
    ],
    code: `# Lesson 41 — CPython memory and profiling tools
# Everything here is deterministic and uses only the standard library.

import gc
import weakref
from array import array

class PackedNode:
    __slots__ = ???

    def __init__(self, name):
        self.name = name
        self.peer = None

# CPython reference counting releases an ordinary unreachable object at once.
gc.disable()
plain = PackedNode("plain")
plain_ref = weakref.ref(plain)
del plain
print("Refcount release:", plain_ref() is None)

# Reference counting alone cannot break a cycle. The cyclic GC can.
left = PackedNode("left")
right = PackedNode("right")
left.peer = right
right.peer = left
cycle_ref = weakref.ref(left)
del left, right
print("Cycle before collect:", cycle_ref() is not None)
gc.collect()  # useful here as a deterministic diagnostic boundary
print("Cycle after diagnostic collect:", cycle_ref() is None)
gc.enable()

# A memoryview is a view onto the same writable buffer, not a slice copy.
buffer = bytearray(b"ABCDE")
window = memoryview(buffer)[???]
window[0] = ord(???)
print("Zero copy:", window.obj is buffer, buffer.decode())

record = PackedNode("model")
packed = array(???, [2, 4, 6])
print("Slots:", hasattr(record, "__dict__"), record.name)
print("Packed array:", packed.typecode, list(packed))

# memory_profiler is named conceptually; the other tools are standard-library
# modules. The lesson maps roles without requiring a third-party installation.
TOOL_ROLES = {
    "memory_profiler": ???,
    "dis": ???,
    "cProfile": ???,
    "timeit": ???,
}
tool_order = ("memory_profiler", "dis", "cProfile", "timeit")
print("Tool roles:", [TOOL_ROLES[name] for name in tool_order])
`,
    codeIncludes: [
      '__slots__ = ("name", "peer", "__weakref__")',
      'gc.disable()',
      'weakref.ref',
      'gc.collect()',
      'memoryview(buffer)[1:4]',
      'window.obj is buffer',
      'array("i", [2, 4, 6])',
      '"memory_profiler": "line-by-line memory"',
      '"dis": "bytecode inspection"',
      '"cProfile": "whole-program CPU profile"',
      '"timeit": "small benchmark comparison"',
    ],
    printPatterns: [
      'Refcount release: True',
      'Cycle before collect: True',
      'Cycle after diagnostic collect: True',
      'Zero copy: True AzCDE',
      'Slots: False model',
      "Packed array: i \\[2, 4, 6\\]",
      "Tool roles: \\['line-by-line memory', 'bytecode inspection', 'whole-program CPU profile', 'small benchmark comparison'\\]",
    ],
    hints: [
      'A slotted class needs "__weakref__" in __slots__ before its instances can be weakly referenced.',
      'The memoryview slice is 1:4, and writing "z" through it changes index one of the original bytearray.',
      'Use array type code "i"; then assign each profiler the narrow role named in its task instruction.',
    ],
    predict: {
      prompt: 'Why does the cyclic pair remain alive after both local names are deleted while automatic cyclic collection is disabled?',
      choices: [
        'Each object still owns a strong reference to the other',
        'A weak reference always keeps its target alive',
        '__slots__ permanently disables garbage collection',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Ordinary CPython lifetime is primarily reference-count driven; cyclic GC is a separate automatic safety net, while memoryview prevents a copy rather than changing collection behavior.',
      wrong:
        'piece = buffer[1:4]\ngc.collect()  # call after every ordinary object',
      fixed:
        'piece = memoryview(buffer)[1:4]\n# reserve gc.collect() for diagnostics or controlled memory-sensitive phases',
    },
    stretch:
      'Stretch: create a second memoryview over the last two bytes, mutate the original bytearray directly, and print evidence that both existing views observe the same shared buffer.',
  }),
  deepDiveLesson({
    id: 'mid-concurrency-safety-deep-dive',
    number: 42,
    topic: 'Concurrency safety patterns',
    chapter: 'Python runtime deep dives',
    goal:
      'Choose thread and process executors by workload, state why blocking I/O can release the GIL, repair shared updates with a lock and immutable messages, and encode event-loop-safe waiting, retained task gathering, surfaced failures, and cancellation cleanup.',
    why:
      'Concurrency safety depends on workload shape and ownership: executors address different bottlenecks, locks protect compound mutations, and async tasks need explicit retention, failure collection, and cleanup.',
    tasks: [
      'Choose ThreadPoolExecutor for blocking I/O and ProcessPoolExecutor for CPU-bound Python work',
      'Protect a read-modify-write update with Lock while passing immutable messages',
      'Use asyncio.sleep as the non-blocking replacement for a blocking wait in the event loop',
      'Retain created tasks, gather returned failures, and cancel plus await unfinished work in finally',
    ],
    taskInstructions: [
      'Return ThreadPoolExecutor.__name__ for blocking_io and ProcessPoolExecutor.__name__ for cpu_python. The fixed policy text should remain visible: blocking I/O can release the GIL while its thread waits.',
      'Construct Lock in the counter and enter self._lock around the compound value update. Use the tuple (1, 1) as immutable messages and confirm the protected result reaches two.',
      'Complete await asyncio.sleep(0). This coroutine is inspected rather than scheduled, keeping the browser run deterministic while still proving the implementation names the event-loop-safe primitive.',
      'Fill create_task, gather, cancel, and the final gather. The tasks list retains ownership, return_exceptions surfaces every outcome, and the finally block cancels and awaits unfinished tasks.',
    ],
    code: `# Lesson 42 — Concurrency choices and safety
# Executor classes are inspected, not started, so no threads or processes are
# created in this browser-local exercise.

import asyncio
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from threading import Lock

def executor_for(workload):
    if workload == "blocking_io":
        return ???.__name__
    if workload == "cpu_python":
        return ???.__name__
    return "asyncio"

GIL_IO_FACT = "I/O releases the GIL while waiting"

class LockedCounter:
    def __init__(self):
        self.value = 0
        self._lock = ???()

    def add(self, delta):
        # += is a compound read-modify-write operation.
        with ???:
            self.value += delta

# An immutable tuple is passed as messages; no worker owns shared input state.
messages = ???
counter = LockedCounter()
for delta in messages:
    counter.add(delta)

async def nonblocking_pause():
    # In an event loop, use an async client / asyncio.sleep, not requests or
    # time.sleep. CPU-heavy Python belongs in a process executor.
    await asyncio.???(0)

async def safe_fanout(coroutines):
    # Keep strong references so background task failures cannot disappear.
    tasks = [asyncio.???(coroutine) for coroutine in coroutines]
    try:
        return await asyncio.???(*tasks, return_exceptions=True)
    finally:
        # Cancellation is cooperative: request it, then await task cleanup.
        for task in tasks:
            if not task.done():
                task.???()
        await asyncio.???(*tasks, return_exceptions=True)

pause_names = set(nonblocking_pause.__code__.co_names)
fanout_names = set(safe_fanout.__code__.co_names)

print("Executor roles:", executor_for("blocking_io"), executor_for("cpu_python"))
print("GIL I/O:", GIL_IO_FACT)
print("Locked result:", counter.value)
print("Immutable messages:", type(messages).__name__, sum(messages))
print("Event-loop remedy:", "sleep" in pause_names)
print(
    "Fanout safety:",
    {"create_task", "gather", "cancel"}.issubset(fanout_names),
)
`,
    codeIncludes: [
      'return ThreadPoolExecutor.__name__',
      'return ProcessPoolExecutor.__name__',
      'I/O releases the GIL while waiting',
      'self._lock = Lock()',
      'with self._lock:',
      'messages = (1, 1)',
      'await asyncio.sleep(0)',
      'asyncio.create_task(coroutine)',
      'asyncio.gather(*tasks, return_exceptions=True)',
      'task.cancel()',
      'finally:',
    ],
    printPatterns: [
      'Executor roles: ThreadPoolExecutor ProcessPoolExecutor',
      'GIL I/O: I/O releases the GIL while waiting',
      'Locked result: 2',
      'Immutable messages: tuple 2',
      'Event-loop remedy: True',
      'Fanout safety: True',
    ],
    hints: [
      'Use ThreadPoolExecutor for blocking I/O and ProcessPoolExecutor for CPU-heavy Python bytecode.',
      'Create Lock once, enter self._lock for the update, and pass the two increments as an immutable tuple.',
      'The async names are sleep, create_task, gather, cancel, and gather again in the cleanup path.',
    ],
    predict: {
      prompt: 'Why must cancelled asyncio tasks be awaited after task.cancel()?',
      choices: [
        'Cancellation is cooperative, so finally blocks and the cancellation result still need to run',
        'Awaiting converts the tasks into operating-system processes',
        'cancel() blocks until every task has already cleaned up',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Retaining and gathering tasks makes failures observable; a finally path prevents sibling work from escaping when a caller is cancelled.',
      wrong:
        'for item in items:\n    asyncio.create_task(work(item))  # references and failures disappear',
      fixed:
        'tasks = [asyncio.create_task(work(item)) for item in items]\ntry: await asyncio.gather(*tasks)\nfinally: cancel_and_await_unfinished(tasks)',
    },
    stretch:
      'Stretch: add a bounded-capacity message queue policy that rejects a third pending message, then print the rejected item without introducing real scheduling or wall-clock timing.',
  }),
  deepDiveLesson({
    id: 'mid-oop-protocols-deep-dive',
    number: 43,
    topic: 'Python object protocols',
    chapter: 'Python object model deep dives',
    goal:
      'Demonstrate internal-name conventions and name mangling through a validated property, register ORM-like fields with a metaclass, compose interchangeable formatters through constructor injection including a fake, implement container protocols, and contrast dict insertion order with OrderedDict move-to-end behavior.',
    why:
      'Senior Python design relies on protocols and explicit ownership: properties guard state, metaclasses can build class metadata, composition enables testing, and dunder methods let custom objects cooperate with ordinary language tools.',
    tasks: [
      'Store a public property behind a name-mangled attribute while retaining a single-underscore internal convention',
      'Use a metaclass to collect ORM-like Column declarations at class creation',
      'Compose polymorphic formatters through constructor injection and verify behavior with a fake collaborator',
      'Implement len, indexing, and iteration for a small Batch container',
      'Preserve ordinary dict insertion order and use OrderedDict.move_to_end for explicit LRU-style reordering',
    ],
    taskInstructions: [
      'Assign raw into self.__raw and return self.__raw from the property. Leave _source as the conventional internal name, then confirm the instance dictionary contains _Score__raw rather than a literal __raw key.',
      'Create the class with super().__new__(mcls, name, bases, namespace). The metaclass should preserve the declaration order amount, owner when it records Column attributes.',
      'Assign the injected formatter to self.formatter. Run both real formatter implementations, then use FakeFormatter to prove Report can be tested without constructing a real output dependency.',
      'Return len(self._items), self._items[index], and iter(self._items) from the three data-model methods. Built-in len, indexing, and list conversion should then work without special caller code.',
      'Call move_to_end on key "a". Plain dict must remain a, b, c by insertion order, while the OrderedDict must become b, c, a for explicit LRU-style movement.',
    ],
    code: `# Lesson 43 — Object protocols, metaclasses, and composition

from collections import OrderedDict

class Score:
    def __init__(self, raw):
        self._source = "model"  # convention: internal, but not private
        self.__raw = ???

    @property
    def value(self):
        return ???

    @value.setter
    def value(self, new_value):
        if not 0.0 <= new_value <= 1.0:
            raise ValueError("score must be in 0..1")
        self.__raw = new_value

class Column:
    pass

class ModelMeta(type):
    def __new__(mcls, name, bases, namespace):
        created = ???
        created.__fields__ = tuple(
            key for key, value in namespace.items()
            if isinstance(value, Column)
        )
        return created

class Invoice(metaclass=ModelMeta):
    amount = Column()
    owner = Column()

class TextFormatter:
    def format(self, value):
        return f"text:{value}"

class DictFormatter:
    def format(self, value):
        return {"value": value}

class FakeFormatter:
    def __init__(self):
        self.calls = []

    def format(self, value):
        self.calls.append(value)
        return f"fake:{value}"

class Report:
    # Constructor injection composes Report with any formatter protocol.
    def __init__(self, formatter):
        self.formatter = ???

    def render(self, value):
        return self.formatter.format(value)

class Batch:
    def __init__(self, items):
        self._items = list(items)

    def __len__(self):
        return len(???)

    def __getitem__(self, index):
        return self._items[???]

    def __iter__(self):
        return iter(???)

score = Score(0.4)
score.value = 0.8
print(
    "Encapsulation:",
    hasattr(score, "_source"),
    "_Score__raw" in score.__dict__,
    score.value,
)
print("ORM fields:", Invoice.__fields__)

real_reports = [Report(TextFormatter()), Report(DictFormatter())]
print("Polymorphism:", [report.render(7) for report in real_reports])

fake = FakeFormatter()
fake_report = Report(fake)
print("Injected fake:", fake_report.render(score.value), fake.calls)

batch = Batch(["x", "y", "z"])
print("Protocol:", len(batch), batch[0], list(batch))

plain = {"a": 1, "b": 2, "c": 3}
lru = OrderedDict(plain)
lru.???("a")
print("Dict order:", list(plain))
print("Ordered LRU:", list(lru))
`,
    codeIncludes: [
      'self._source = "model"',
      'self.__raw = raw',
      'return self.__raw',
      'super().__new__(mcls, name, bases, namespace)',
      'self.formatter = formatter',
      'return len(self._items)',
      'return self._items[index]',
      'return iter(self._items)',
      'lru.move_to_end("a")',
    ],
    printPatterns: [
      'Encapsulation: True True 0.8',
      "ORM fields: \\('amount', 'owner'\\)",
      "Polymorphism: \\['text:7', \\{'value': 7\\}\\]",
      'Injected fake: fake:0.8 \\[0.8\\]',
      "Protocol: 3 x \\['x', 'y', 'z'\\]",
      "Dict order: \\['a', 'b', 'c'\\]",
      "Ordered LRU: \\['b', 'c', 'a'\\]",
    ],
    hints: [
      'Use raw and self.__raw for the property, then call super().__new__ with all four metaclass arguments.',
      'Constructor injection is the direct assignment self.formatter = formatter; the fake implements the same small format method.',
      'Every Batch protocol delegates to self._items, and OrderedDict reorders with move_to_end.',
    ],
    predict: {
      prompt: 'Where does Score store an attribute written as self.__raw?',
      choices: [
        'Under the name-mangled key _Score__raw',
        'Under a cryptographically private memory address',
        'Only inside the property descriptor, with no instance value',
      ],
      correctIndex: 0,
    },
    compare: {
      note:
        'Composition plus constructor injection lets one Report use real or fake collaborators; constructing a concrete formatter internally would couple behavior and make isolated tests harder.',
      wrong:
        'class Report:\n    def __init__(self):\n        self.formatter = ProductionFormatter()',
      fixed:
        'class Report:\n    def __init__(self, formatter):\n        self.formatter = formatter',
    },
    stretch:
      'Stretch: add a JsonFormatter without changing Report, then add a Batch slice case and prove the same __getitem__ protocol supports both an integer index and a slice.',
  }),
]
