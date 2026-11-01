import type { LessonDraft } from '../examples'
import { GENAI_PYTHON_CHECKS } from '../genaiPythonExercise'

export const GENAI_PYTHON_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'genai-typed', difficulty: 'genai', number: 1,
    topic: 'Typed Python boundaries', chapter: 'Python for a GenAI service',
    goal: 'Turn an untrusted request dictionary into a validated AskRequest.',
    why: 'The /ask endpoint needs a clear contract. Dataclass annotations help readers and tools; explicit runtime checks still protect incoming data.',
    tasks: GENAI_PYTHON_CHECKS['genai-typed'].map((check) => check.label),
    taskInstructions: [
      'Replace the return blank with AskRequest(**clean) to return the typed dataclass after validation.',
      'Use not value.strip() in the second blank so spaces alone cannot count as a question or user ID.',
      'Use isinstance(value, str) in the first blank; a type annotation does not reject a number at runtime.',
    ],
    code: `from dataclasses import dataclass

@dataclass(frozen=True)
class AskRequest:
    question: str
    user_id: str

def parse_request(payload) -> AskRequest:
    if not isinstance(payload, dict):
        raise ValueError("Request must be an object")
    clean = {}
    for name in ("question", "user_id"):
        value = payload.get(name)
        if not ??? or ???:
            raise ValueError(name + " must be nonempty text")
        clean[name] = value.strip()
    return ???

print(parse_request({"question": " Explain async ", "user_id": " learner-1 "}))
`,
    goalCheck: { requireSuccess: true, noBlanks: true },
    hints: ['Use isinstance(value, str), not value.strip(), and AskRequest(**clean). Short-circuit or protects strip() from wrong types.'],
    stretch: 'Try constructing AskRequest(42, None) directly, then compare it with parse_request. Explain why annotations alone are not a security boundary.',
    compare: { wrong: 'question: str = 42', fixed: 'if not isinstance(question, str):\n    raise ValueError("Question must be text")', note: 'Annotations do not perform runtime input validation.' },
    predict: { prompt: 'Does a str annotation alone reject the value 42 at runtime?', choices: ['No', 'Yes'], correctIndex: 0 },
  },
  {
    id: 'genai-async', difficulty: 'genai', number: 2,
    topic: 'Async tools and cancellation', chapter: 'Python for a GenAI service',
    goal: 'Collect two tool results concurrently and cancel a slow call on timeout.',
    why: 'An agent service waits on tools. Real asyncio gather and wait_for help bound that work; these local sleeps exercise scheduling without a provider or network.',
    tasks: GENAI_PYTHON_CHECKS['genai-async'].map((check) => check.label),
    taskInstructions: [
      'Replace the first blank with asyncio.gather. Awaiting it starts both coroutines and preserves the input order of their results.',
      'Use asyncio.wait_for in the second blank and pass timeout_s as the timeout argument to bound a slow tool.',
      'Catch TimeoutError in the final blank. wait_for cancels the tool and waits for its cancellation before returning control.',
    ],
    code: `import asyncio

async def call_tool(label, delay_s):
    await asyncio.sleep(delay_s)
    return label

async def collect_answers():
    return await ???(
        call_tool("facts", 0.01),
        call_tool("policy", 0.01),
    )

async def fetch_with_timeout(timeout_s):
    try:
        return await ???(call_tool("slow", 0.05), timeout=timeout_s)
    except ???:
        return "timeout"

# The behavior checks await these coroutines in the browser's event loop.
# Do not call asyncio.run() inside an already-running browser event loop.
print("Run the checks to exercise concurrency, timeout, and cancellation.")
`,
    goalCheck: { requireSuccess: true, noBlanks: true },
    hints: ['Use asyncio.gather, asyncio.wait_for, and TimeoutError. Do not catch CancelledError as an ordinary result.'],
    stretch: 'Make the policy tool finish first and confirm that gather still returns facts before policy.',
    compare: { wrong: 'first = await call_tool("facts", 0.01)\nsecond = await call_tool("policy", 0.01)', fixed: 'results = await asyncio.gather(call_tool("facts", 0.01), call_tool("policy", 0.01))', note: 'Independent I/O waits can overlap; CPU work still needs a separate strategy.' },
    predict: { prompt: 'What should happen to a tool after its wait_for timeout?', choices: ['It keeps running unnoticed', 'It is cancelled and its cancellation is awaited'], correctIndex: 1 },
  },
  {
    id: 'genai-pytest', difficulty: 'genai', number: 3,
    topic: 'Tests that catch regressions', chapter: 'Python for a GenAI service',
    goal: 'Use a case table and assertions to catch broken input validation.',
    why: 'These plain-Python assertions teach the pattern behind pytest parametrization. Pytest is not installed in the browser; the external Python lab uses real pytest.',
    tasks: GENAI_PYTHON_CHECKS['genai-pytest'].map((check) => check.label),
    taskInstructions: [
      'Replace the comparison blank with expected so both valid table rows assert the exact normalized output.',
      'Run the case table against text with surrounding whitespace; the checks also try a version that forgets to strip it.',
      'Raise AssertionError in the exception blank when invalid input is accepted, so a broken validator makes your test fail.',
    ],
    code: `def normalize_question(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Question must be nonempty text")
    return text.strip()

def run_cases():
    # In real pytest, put this table in @pytest.mark.parametrize.
    cases = [(" Hello ", "Hello"), ("\\tWhy?\\n", "Why?")]
    for text, expected in cases:
        assert normalize_question(text) == ???

    # In real pytest, use with pytest.raises(ValueError).
    for invalid in ("", "   ", None):
        try:
            normalize_question(invalid)
        except ValueError:
            pass
        else:
            raise ???("Invalid input was accepted")

run_cases()
print("Case table passed")
`,
    goalCheck: { requireSuccess: true, noBlanks: true },
    hints: ['The comparison should use expected. A regression test must raise AssertionError if invalid input unexpectedly succeeds.'],
    stretch: 'Add a numeric invalid input, then port the cases to real pytest parametrization in the external Python lab.',
    compare: { wrong: 'assert normalize_question(text)', fixed: 'assert normalize_question(text) == expected', note: 'A truthy result can still be the wrong result.' },
    predict: { prompt: 'Is assert result enough to prove that surrounding spaces were removed?', choices: ['Yes', 'No, compare against the expected text'], correctIndex: 1 },
  },
  {
    id: 'genai-prompts', difficulty: 'genai', number: 4,
    topic: 'Versioned prompt contracts', chapter: 'Python for a GenAI service',
    goal: 'Build separate system and user messages with an explicit character limit.',
    why: 'Stable instructions, versioning, and bounded input make requests inspectable. Role separation does not eliminate prompt injection; authorization must stay outside the model.',
    tasks: GENAI_PYTHON_CHECKS['genai-prompts'].map((check) => check.label),
    taskInstructions: [
      'Keep SYSTEM_MESSAGE fixed and put both question and context into a JSON string in the user message.',
      'Return PROMPT_VERSION in the version field so an evaluation can identify the prompt contract it used.',
      'Reject the request when len(user_content) exceeds max_chars. This is a character limit for this exercise, not a token or cost budget.',
    ],
    code: `import json

PROMPT_VERSION = "ask-v1"
SYSTEM_MESSAGE = "Answer using the supplied context. If evidence is missing, say so."

def build_prompt(question, context, max_chars):
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question must be nonempty text")
    if not isinstance(context, str):
        raise ValueError("Context must be text")
    if type(max_chars) is not int or max_chars < 1:
        raise ValueError("Character limit must be a positive integer")
    user_content = json.dumps({"question": question, "context": context}, ensure_ascii=False)
    if ???:
        raise ValueError("User content exceeds the character limit")
    return {
        "version": ???,
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": ???, "content": user_content},
        ],
    }

print(build_prompt("What is asyncio?", "Asyncio schedules coroutines.", 200))
# Real model budgets must use that model's tokenizer and reserve output tokens.
`,
    goalCheck: { requireSuccess: true, noBlanks: true },
    hints: ['Use len(user_content) > max_chars, PROMPT_VERSION, and "user". Count the entire serialized user message.'],
    stretch: 'Try quotes, non-Latin text, and an instruction-like question. Keep the system message unchanged and preserve the data exactly.',
    compare: { wrong: 'system = SYSTEM_MESSAGE + question', fixed: 'messages = [{"role": "system", "content": SYSTEM_MESSAGE}, {"role": "user", "content": user_content}]', note: 'Data belongs in the user message; deterministic controls still govern tool execution.' },
    predict: { prompt: 'Does a 200-character limit guarantee that a request fits a 200-token model budget?', choices: ['No', 'Yes'], correctIndex: 0 },
  },
  {
    id: 'genai-structured', difficulty: 'genai', number: 5,
    topic: 'Strict structured output', chapter: 'Python for a GenAI service',
    goal: 'Accept only JSON answers that match the exact answer-and-citations contract.',
    why: 'Generated text is untrusted output. Validate its shape before your service uses it, and verify citations separately before treating them as evidence.',
    tasks: GENAI_PYTHON_CHECKS['genai-structured'].map((check) => check.label),
    taskInstructions: [
      'Parse raw_json with json.loads, then accept nonempty answer text and a list containing only nonempty citation strings.',
      'Require a dictionary with exactly the answer and citations keys. Malformed JSON or missing fields must raise ValueError.',
      'Use isinstance(citations, list), and reject nonstring or empty list items instead of coercing them into text.',
    ],
    code: `import json

def parse_answer(raw_json):
    if not isinstance(raw_json, str):
        raise ValueError("Model output must be JSON text")
    data = json.loads(raw_json)
    if not isinstance(data, dict) or set(data) != {"answer", "citations"}:
        raise ValueError("Expected only answer and citations")
    answer = data["answer"]
    citations = data["citations"]
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("Answer must be nonempty text")
    if not ???:
        raise ValueError("Citations must be a list")
    if any(not isinstance(item, str) or not item.strip() for item in citations):
        raise ValueError("Each citation must be nonempty text")
    return ???

print(parse_answer('{"answer": "Asyncio schedules coroutines.", "citations": ["doc-1"]}'))
# A valid citation string is not proof that the source exists or supports the answer.
`,
    goalCheck: { requireSuccess: true, noBlanks: true },
    hints: ['Use isinstance(citations, list) and return data. json.JSONDecodeError is already a subclass of ValueError.'],
    stretch: 'Try a JSON object with an extra confidence field, a numeric answer, and a citation list containing null; all must be rejected.',
    compare: { wrong: 'return json.loads(raw_json)', fixed: 'data = json.loads(raw_json)\n# Validate keys and value types before returning data.', note: 'Valid JSON can still violate the application contract.' },
    predict: { prompt: 'Does valid JSON prove that an answer matches your schema?', choices: ['Yes', 'No, validate the fields and types too'], correctIndex: 1 },
  },
]
