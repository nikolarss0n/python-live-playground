import type { LessonDraft } from '../examples'

export const PYTHON_ENGINEER_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'missing-data-none',
    difficulty: 'beginner',
    number: 17,
    topic: 'Missing data & None',
    chapter: 'Data for AI',
    goal:
      'Finish a function that handles labels missing from a dictionary. Done when Results shows helpful, missing, missing, helpful and Missing: 2.',
    why:
      'A dictionary may leave out a key, or store None to mean no value. Using get lets you check either case without stopping the program.',
    tasks: [
      'Read the label with get',
      'Fill the check for a missing value',
      'Count the missing labels',
    ],
    taskInstructions: [
      'In normalized_label, give result.get the quoted key for the label. Results should keep the helpful labels and handle the dictionary with no label key.',
      'In the if inside normalized_label, compare label with Python\'s no-value marker. The two entries without a usable label should print as missing.',
      'In the loop over results, add one to missing_count when label is missing. After all four entries, the final print should say Missing: 2.',
    ],
    code: `# Beginner 17 — Missing data & None
# Goal: Finish a function that handles labels missing from a dictionary.

results = [
    {"text": "great answer", "label": "helpful"},
    {"text": "needs sources", "label": None},
    {"text": "empty label"},
    {"text": "clear", "label": "helpful"},
]

def normalized_label(result):
    label = result.get(???)
    if label is ???:
        return "missing"
    return label

labels = []
missing_count = 0
for result in results:
    label = normalized_label(result)
    labels.append(label)
    if label == "missing":
        missing_count += ???

print("Labels:", labels)
print("Missing:", missing_count)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.get(', 'is None', 'missing_count +='],
      printPatterns: ['Labels:.*helpful.*missing', 'Missing: 2'],
      minNonEmptyPrints: 2,
    },
    hints: [
      'The key you want is "label"; get returns None when that key is absent.',
      'Use is None to check for no value. Count each missing label with one added to missing_count.',
    ],
    predict: {
      prompt: 'What does a dictionary .get call return when its key is absent and no fallback is supplied?',
      choices: ['None', 'An empty string', 'KeyError'],
      correctIndex: 0,
    },
    compare: {
      note: 'Direct indexing crashes on absent fields; .get makes the missing case explicit.',
      wrong: 'label = result["label"]',
      fixed: 'label = result.get("label")',
    },
    stretch:
      'Stretch: add {"text": "no label yet"} to results. The Labels list should gain another missing entry and Missing should become 3.',
  },
  {
    id: 'nested-records',
    difficulty: 'beginner',
    number: 18,
    topic: 'Nested records',
    chapter: 'Data for AI',
    goal:
      'Finish a loop that reads scores stored inside dictionaries. Done when Results shows Selected: ["r1"] and Skipped: ["r2", "r3"].',
    why:
      'A dictionary can hold another dictionary: here metrics holds confidence, a score from zero to one. Some entries lack that score, so check before comparing.',
    tasks: [
      'Read confidence from the inner dictionary',
      'Set the smallest selected score to 0.8',
      'Save the other ids in skipped',
    ],
    taskInstructions: [
      'In the second get call, name the confidence key as text. The r2 entry should go to skipped without causing an error when that key is absent.',
      'After confidence >=, write 0.8 as the smallest score to select. The score 0.91 should select r1, while 0.72 should leave r3 out.',
      'In the else branch, append the id to the list for entries you did not select. Results should show r2 and r3 in Skipped, in that order.',
    ],
    code: `# Beginner 18 — Nested records
# Goal: filter nested model-run data without assuming every field exists.

runs = [
    {"id": "r1", "metrics": {"confidence": 0.91}},
    {"id": "r2", "metrics": {}},
    {"id": "r3", "metrics": {"confidence": 0.72}},
]

selected = []
skipped = []

for run in runs:
    confidence = run.get("metrics", {}).get(???)
    if confidence is not None and confidence >= ???:
        selected.append(run["id"])
    else:
        ???.append(run["id"])

print("Selected:", selected)
print("Skipped:", skipped)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['get("metrics", {})', 'is not None', 'skipped.append'],
      printPatterns: ['Selected:.*r1', 'Skipped:.*r2.*r3'],
      minNonEmptyPrints: 2,
    },
    hints: [
      'The first get finds metrics. The second get looks for "confidence" inside it.',
      'Keep the is not None check before comparing with 0.8, and use skipped in the else branch.',
    ],
    predict: {
      prompt: 'Why check confidence is not None before comparing it with 0.8?',
      choices: [
        'None cannot be ordered against a float',
        'None is always larger than a float',
        'It makes the dictionary sorted',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'Chained safe lookups preserve the batch when a nested field is absent.',
      wrong: 'confidence = run["metrics"]["confidence"]',
      fixed: 'confidence = run.get("metrics", {}).get("confidence")',
    },
    stretch:
      'Stretch: add {"id": "r4"} to runs. Selected should stay ["r1"], and Skipped should gain r4 even though it has no metrics dictionary.',
  },
  {
    id: 'text-normalization',
    difficulty: 'beginner',
    number: 19,
    topic: 'Text normalization',
    chapter: 'Data for AI',
    goal:
      'Finish a function that cleans capitals, punctuation and extra spaces from text. Done when Results shows "hello model", "needs sources" and an empty string.',
    why:
      'Text normalization means making differently written text look alike. Here you remove extra spaces and punctuation, then use lowercase so matching words is easier.',
    tasks: [
      'Clean the outside spaces and capitals',
      'Split cleaned into separate words',
      'Join the words with single spaces',
    ],
    taskInstructions: [
      'Set cleaned inside normalize_text by removing outside spaces and converting text to lowercase. The first sample should eventually print as hello model.',
      'Set tokens by splitting cleaned without a separator after the punctuation loop. Repeated spaces should disappear, so the second sample prints needs sources.',
      'Return the tokens joined with one space between them. The whitespace-only sample should print two quote marks with nothing between them.',
    ],
    code: `# Beginner 19 — Text normalization
# Goal: make equivalent text use one predictable representation.

def normalize_text(text):
    cleaned = ???
    for mark in ",.!?":
        cleaned = cleaned.replace(mark, "")
    tokens = ???
    return ???

samples = [
    "  Hello,   MODEL!  ",
    "Needs... sources?",
    "   ",
]

for sample in samples:
    print(repr(normalize_text(sample)))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['.strip()', '.lower()', '.replace(', '.split()', '" ".join'],
      printPatterns: ["'hello model'", "'needs sources'", "''"],
      minNonEmptyPrints: 3,
    },
    hints: [
      'Start with text.strip().lower(); the supplied loop removes punctuation for you.',
      'Use cleaned.split() to get the words, then join tokens with " " between them.',
    ],
    predict: {
      prompt: 'What does "   ".split() return when split has no separator argument?',
      choices: ['[]', '["", "", ""]', 'None'],
      correctIndex: 0,
    },
    compare: {
      note: 'Splitting and joining collapses every run of whitespace, not only pairs of spaces.',
      wrong: 'cleaned = cleaned.replace("  ", " ")',
      fixed: 'cleaned = " ".join(cleaned.split())',
    },
    stretch:
      'Stretch: add "  GREAT,   work! " to samples. The extra Results line should be "great work", with lowercase letters and one space.',
  },
  {
    id: 'assertions-as-tests',
    difficulty: 'beginner',
    number: 20,
    topic: 'Assertions as tests',
    chapter: 'Correctness',
    goal:
      'Finish a function that keeps a score between zero and one. Done when Results shows four passed lines followed by "4 checks passed".',
    why:
      'An assertion is a check that stops Python when a result is wrong. Testing several inputs helps you notice mistakes when you change a function.',
    tasks: [
      'Fill the returns for scores outside zero to one',
      'Set the expected result for 1.4',
      'Compare actual with expected in the assertion',
    ],
    taskInstructions: [
      'In clamp_confidence, return the nearest allowed endpoint for values below zero or above one. The first passed line should show -0.2 becoming 0.0.',
      'In cases, fill the expected number beside 1.4 with the highest allowed score. That case should print passed: 1.4 -> 1.0.',
      'After assert, write an equality comparison between actual and expected. Results should reach 4 checks passed only if every comparison succeeds.',
    ],
    code: `# Beginner 20 — Assertions as tests
# Goal: Finish a function that keeps a score between zero and one.

def clamp_confidence(value):
    if value < 0:
        return ???
    if value > 1:
        return ???
    return value

cases = [
    (-0.2, 0.0),
    (0.0, 0.0),
    (0.6, 0.6),
    (1.4, ???),
]

for value, expected in cases:
    actual = clamp_confidence(value)
    assert ???, f"{value}: expected {expected}, got {actual}"
    print(f"passed: {value} -> {actual}")

print(f"{len(cases)} checks passed")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['assert ', 'actual == expected', 'return 0.0', 'return 1.0'],
      printPatterns: ['passed: -0.2 -> 0.0', 'passed: 1.4 -> 1.0', '4 checks passed'],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The lowest allowed result is 0.0 and the highest is 1.0; scores between them stay as they are.',
      'Use == to compare actual and expected. A wrong result will stop at assert instead of printing success.',
    ],
    predict: {
      prompt: 'What happens when a Python assert condition is False?',
      choices: [
        'Python raises AssertionError',
        'Python silently changes the value',
        'The function returns None',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'A print describes a result; an assertion actively rejects a wrong result.',
      wrong: 'print(actual == expected)',
      fixed: 'assert actual == expected',
    },
    stretch:
      'Stretch: add (1.0, 1.0) to cases. The new passed line should show the score unchanged and the last line should say 5 checks passed.',
  },
  {
    id: 'feedback-classifier-capstone',
    difficulty: 'beginner',
    number: 21,
    topic: 'Feedback classifier capstone',
    chapter: 'Beginner capstone',
    goal:
      'Finish a program that labels five pieces of feedback using their words. Done when Results counts 2 positive, 1 negative, 1 neutral and 1 unknown.',
    why:
      'A classifier puts items into named groups. This one uses word checks, so you can see how functions, loops and dictionaries work together to label feedback.',
    tasks: [
      'Clean the feedback text inside normalize_text',
      'Fill the positive and negative labels',
      'Count each label and check the totals',
    ],
    taskInstructions: [
      'In normalize_text, return lowercase words joined with single spaces. The entry containing only spaces should become empty and print f3: unknown.',
      'Inside classify, return a quoted group name from each word-check branch. Results should label f1 and f5 positive, f2 negative and f4 neutral.',
      'In the feedback loop, add one for each label, then compare counts with the expected dictionary after assert. The Counts line should show all five entries counted.',
    ],
    code: `# Beginner 21 — Feedback classifier capstone
# Goal: Finish a program that labels five pieces of feedback using their words.

feedback = [
    {"id": "f1", "text": " Great explanation "},
    {"id": "f2", "text": "Needs sources"},
    {"id": "f3", "text": "   "},
    {"id": "f4", "text": "Clear and concise"},
    {"id": "f5", "text": "Very helpful"},
]

def normalize_text(text):
    return ???

def classify(text):
    cleaned = normalize_text(text)
    if not cleaned:
        return "unknown"
    if any(word in cleaned for word in ["great", "helpful"]):
        return ???
    if any(word in cleaned for word in ["needs", "wrong"]):
        return ???
    return "neutral"

counts = {}
for row in feedback:
    label = classify(row.get("text", ""))
    counts[label] = counts.get(label, 0) + ???
    print(f"{row['id']}: {label}")

expected = {"positive": 2, "negative": 1, "unknown": 1, "neutral": 1}
assert counts == ???, counts
print("Counts:", counts)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['def normalize_text', 'def classify', 'any(', 'assert counts == expected'],
      printPatterns: ['f1: positive', 'f2: negative', 'f3: unknown', 'f4: neutral', 'Counts:.*positive.*2'],
      minNonEmptyPrints: 6,
    },
    hints: [
      'Lowercase the text, split it into words, then join those words with one space.',
      'The great/helpful branch returns "positive"; needs/wrong returns "negative".',
      'Increase the current label\'s count by one, then assert counts == expected.',
    ],
    predict: {
      prompt: 'Which label should whitespace-only feedback receive after normalization?',
      choices: ['unknown', 'neutral', 'positive'],
      correctIndex: 0,
    },
    compare: {
      note: 'Normalize before matching so casing and extra spaces do not change the classification.',
      wrong: 'if "great" in text:',
      fixed: 'if "great" in normalize_text(text):',
    },
    stretch:
      'Stretch: change f4\'s text to "Great and clear" and update expected. The printed totals should become 3 positive, 1 negative and 1 unknown.',
  },

  {
    id: 'mid-type-hints-contracts',
    difficulty: 'intermediate',
    number: 21,
    topic: 'Type hints & contracts',
    chapter: 'Reliable Python',
    goal:
      'Validate typed prediction dictionaries, accepting one valid case and reporting missing-label and range errors.',
    why:
      'Type hints document the intended boundary, while runtime validation protects it from untrusted API or model data.',
    tasks: [
      'Complete the validator return type with its result and error list',
      'Reject a label whose runtime value is not a string',
      'Reject confidence values that are missing, non-numeric, or outside 0..1',
    ],
    taskInstructions: [
      'Use tuple[bool, list[str]] as the return annotation, matching the final `(not errors, errors)` value exactly.',
      'Pass str as the expected class in the label isinstance check, so an absent label and a numeric label both fail.',
      'Use 1.0 as the inclusive upper confidence boundary and keep the numeric-type check before the range comparison.',
    ],
    code: `# Intermediate 21 — Type hints & contracts
# Goal: document a prediction shape and validate data at runtime.

from typing import TypedDict

class Prediction(TypedDict):
    label: str
    confidence: float

def validate_prediction(value: dict) -> ???:
    errors = []
    if not isinstance(value.get("label"), ???):
        errors.append("label must be a string")

    confidence = value.get("confidence")
    if not isinstance(confidence, (int, float)):
        errors.append("confidence must be numeric")
    elif not 0.0 <= confidence <= ???:
        errors.append("confidence must be between 0 and 1")

    return not errors, errors

cases = [
    {"label": "helpful", "confidence": 0.92},
    {"confidence": 0.4},
    {"label": "unsafe", "confidence": 1.4},
]

for case in cases:
    print(validate_prediction(case))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['TypedDict', 'tuple[bool, list[str]]', 'isinstance(', '0.0 <= confidence <= 1.0'],
      printPatterns: ['True', 'label must be a string', 'confidence must be between 0 and 1'],
      minNonEmptyPrints: 3,
    },
    hints: [
      'The blanks are `tuple[bool, list[str]]`, `str`, and the upper boundary `1.0`.',
    ],
    predict: {
      prompt: 'Does a TypedDict annotation automatically reject a malformed dictionary at runtime?',
      choices: ['No, runtime validation is still needed', 'Yes, always', 'Only when printed'],
      correctIndex: 0,
    },
    compare: {
      note: 'Annotations communicate a contract; explicit checks enforce it on external data.',
      wrong: 'prediction: Prediction = external_value  # trusted automatically',
      fixed: 'ok, errors = validate_prediction(external_value)',
    },
    stretch:
      'Stretch: reject unknown labels by allowing only helpful, unsafe, and unknown.',
  },
  {
    id: 'mid-jsonl-ingestion',
    difficulty: 'intermediate',
    number: 22,
    topic: 'JSONL ingestion',
    chapter: 'Reliable Python',
    goal:
      'Parse four JSONL lines without stopping on bad data, accepting e1/e4 and reporting rejected lines 2/3.',
    why:
      'Training and eval datasets often arrive as JSON Lines, where one malformed record must not hide every later record.',
    tasks: [
      'Parse each non-empty line while preserving its one-based line number',
      'Catch JSON decoding errors and continue with the next record',
      'Reject parsed objects that lack any required id, text, or label field',
    ],
    taskInstructions: [
      'Pass the current line to json.loads(...); enumerate already supplies the one-based line number needed for diagnostics.',
      'Catch json.JSONDecodeError specifically, append an invalid-json rejection, and keep continue so e4 is still processed.',
      'Check required.issubset(record) before accepting the object, which treats dictionary keys as the membership source.',
    ],
    code: `# Intermediate 22 — JSONL ingestion
# Goal: keep valid records and preserve useful diagnostics for bad lines.

import json
from io import StringIO

RAW = """{"id":"e1","text":"clear","label":"good"}
{"id":"e2","text":"broken"
{"id":"e3","text":"missing label"}
{"id":"e4","text":"grounded","label":"good"}"""

def load_jsonl(text):
    accepted = []
    rejected = []
    required = {"id", "text", "label"}

    for line_number, line in enumerate(StringIO(text), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(???)
        except ???:
            rejected.append({"line": line_number, "reason": "invalid json"})
            continue

        if not required.issubset(???):
            rejected.append({"line": line_number, "reason": "missing fields"})
            continue
        accepted.append(record)

    return accepted, rejected

accepted, rejected = load_jsonl(RAW)
print("Accepted:", [row["id"] for row in accepted])
print("Rejected:", rejected)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['json.loads(line)', 'except json.JSONDecodeError', 'required.issubset(record)', 'continue'],
      printPatterns: ['Accepted:.*e1.*e4', "Rejected:.*'line': 2.*'line': 3"],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Parse `line`, catch `json.JSONDecodeError`, and test `required.issubset(record)`.',
    ],
    predict: {
      prompt: 'Why catch JSONDecodeError inside the loop instead of around the entire load?',
      choices: [
        'Later valid lines can still be processed',
        'It sorts the accepted records',
        'It converts JSON into CSV',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'Per-record error handling preserves good data after a malformed line.',
      wrong: 'records = [json.loads(line) for line in text.splitlines()]',
      fixed: 'try: record = json.loads(line)\nexcept json.JSONDecodeError: continue',
    },
    stretch:
      'Stretch: reject a fifth line whose label is present but not one of good or bad.',
  },
  {
    id: 'mid-regex-redaction',
    difficulty: 'intermediate',
    number: 23,
    topic: 'Regex redaction',
    chapter: 'Reliable Python',
    goal:
      'Redact email addresses and sk-style API keys, then prove neither secret pattern remains in three outputs.',
    why:
      'Prompts, traces, and error logs must be useful for debugging without retaining credentials or personal identifiers.',
    tasks: [
      'Replace every detected email address with a stable marker',
      'Replace every detected API key with a different stable marker',
      'Assert that no redacted output still contains either secret form',
    ],
    taskInstructions: [
      'Use "[EMAIL]" as EMAIL_PATTERN.sub’s replacement, leaving the original text as its second argument.',
      'Use "[API_KEY]" in KEY_PATTERN.sub so logs distinguish credentials from personal email values.',
      'Make the all(...) condition require both `"@" not in item` and `"sk-" not in item` for every output string.',
    ],
    code: `# Intermediate 23 — Regex redaction
# Goal: remove common secrets before text reaches a log or model.

import re

EMAIL_PATTERN = re.compile(
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
)
KEY_PATTERN = re.compile(r"\\bsk-[A-Za-z0-9]{8,}\\b")

def redact(text):
    redacted = EMAIL_PATTERN.sub(???, text)
    return KEY_PATTERN.sub(???, redacted)

samples = [
    "owner ada@example.com reported an issue",
    "provider key sk-abc12345 failed",
    "no secrets here",
]

outputs = [redact(sample) for sample in samples]
for output in outputs:
    print(output)

assert all(??? for item in outputs)
print("Secrets removed: True")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['EMAIL_PATTERN.sub', 'KEY_PATTERN.sub', 'assert all('],
      printPatterns: ['EMAIL', 'API_KEY', 'Secrets removed: True'],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Use the quoted markers, then assert `"@" not in item and "sk-" not in item` for every item.',
    ],
    predict: {
      prompt: 'Why use different markers for an email and an API key?',
      choices: [
        'Logs retain the value type without retaining the secret',
        'The original values can be reconstructed',
        'It makes regex unnecessary',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'Redact values before serialization; deleting them after logging is already too late.',
      wrong: 'print({"prompt": prompt, "api_key": api_key})',
      fixed: 'print(redact(f"{prompt} {api_key}"))',
    },
    stretch:
      'Stretch: add a phone-number pattern and a [PHONE] marker without changing the existing two replacements.',
  },
  {
    id: 'mid-safe-copying',
    difficulty: 'intermediate',
    number: 24,
    topic: 'Safe copying',
    chapter: 'Reliable Python',
    goal:
      'Enrich a nested record with a rounded score and tag while proving the original nested tags remain unchanged.',
    why:
      'Pipeline stages that mutate shared nested objects create hidden coupling and make experiments difficult to reproduce.',
    tasks: [
      'Deep-copy the incoming record before changing nested values',
      'Add a validated tag and a two-decimal derived score to the copy',
      'Assert the source tags remain exactly ["raw"] after enrichment',
    ],
    taskInstructions: [
      'Call deepcopy(row) rather than dict(row), because a shallow dictionary copy would still share the nested tags list.',
      'Append the string "validated" and set score from round(result["raw_score"], 2), changing only the copied object.',
      'Compare source["metadata"]["tags"] with ["raw"] in the assertion before printing both versions as evidence.',
    ],
    code: `# Intermediate 24 — Safe copying
# Goal: enrich a record without mutating data owned by an earlier stage.

from copy import deepcopy

source = {
    "id": "e1",
    "metadata": {"tags": ["raw"]},
    "raw_score": 0.899,
}

def enrich(row):
    result = ???
    result["metadata"]["tags"].append(???)
    result["score"] = ???
    return result

enriched = enrich(source)
assert ???

print("Source tags:", source["metadata"]["tags"])
print("Enriched tags:", enriched["metadata"]["tags"])
print("Score:", enriched["score"])
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['deepcopy(row)', 'append("validated")', 'round(result["raw_score"], 2)', 'assert source'],
      printPatterns: ['Source tags:.*raw', 'Enriched tags:.*raw.*validated', 'Score: 0.9'],
      minNonEmptyPrints: 3,
    },
    hints: [
      'Deep-copy row, append "validated", round raw_score to 2 places, and assert the source tags equal ["raw"].',
    ],
    predict: {
      prompt: 'Why is dict(source) insufficient before appending to a nested tags list?',
      choices: [
        'The nested list would still be shared',
        'dict cannot copy strings',
        'It automatically deletes metadata',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'A shallow copy duplicates the outer mapping but still aliases nested mutable objects.',
      wrong: 'result = dict(row)',
      fixed: 'result = deepcopy(row)',
    },
    stretch:
      'Stretch: enrich a list of two records and prove neither source record gains score or validated.',
  },
  {
    id: 'mid-table-driven-tests',
    difficulty: 'intermediate',
    number: 25,
    topic: 'Table-driven tests',
    chapter: 'Reliable Python',
    goal:
      'Verify four abstention scenarios, including no evidence and an exact-threshold boundary, with 4/4 passing.',
    why:
      'A case table makes behavior and boundaries visible, extensible, and easy to run after every pipeline change.',
    tasks: [
      'Implement abstention for no evidence or a score below threshold',
      'Set the expected behavior when score equals the threshold exactly',
      'Record named failures and assert the complete failure list is empty',
    ],
    taskInstructions: [
      'Complete the return with `score < threshold`; equality must remain allowed when at least one evidence item exists.',
      'Set the exact-threshold case to False, making the inclusive acceptance boundary explicit in executable data.',
      'Append case["name"] on a mismatch, then keep `assert not failures` so all failing scenarios are reported together.',
    ],
    code: `# Intermediate 25 — Table-driven tests
# Goal: verify ordinary and boundary behavior from one readable case table.

def should_abstain(score, evidence_count, threshold=0.6):
    return evidence_count == 0 or ???

cases = [
    {"name": "no evidence", "score": 0.9, "count": 0, "expected": True},
    {"name": "weak evidence", "score": 0.4, "count": 2, "expected": True},
    {"name": "exact threshold", "score": 0.6, "count": 1, "expected": ???},
    {"name": "strong evidence", "score": 0.85, "count": 3, "expected": False},
]

failures = []
for case in cases:
    actual = should_abstain(case["score"], case["count"])
    if actual != case["expected"]:
        failures.append(???)

print(f"{len(cases) - len(failures)}/{len(cases)} passed")
print("Failures:", failures)
assert not failures, failures
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['score < threshold', '"exact threshold"', 'failures.append(case["name"])', 'assert not failures'],
      printPatterns: ['4/4 passed', 'Failures:'],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Use `score < threshold`, expected False at equality, and append `case["name"]`.',
    ],
    predict: {
      prompt: 'With a threshold of 0.6, should score 0.6 abstain when evidence exists?',
      choices: ['No', 'Yes', 'Only when printed'],
      correctIndex: 0,
    },
    compare: {
      note: 'Named table cases preserve all failures instead of stopping at the first mismatch.',
      wrong: 'assert should_abstain(0.4, 2)',
      fixed: 'failures = [case["name"] for case in cases if result_is_wrong(case)]',
    },
    stretch:
      'Stretch: add a custom threshold case at 0.8 and prove a score of 0.79 abstains.',
  },
  {
    id: 'mid-iterator-batching',
    difficulty: 'intermediate',
    number: 26,
    topic: 'Iterator batching',
    chapter: 'Production patterns',
    goal:
      'Yield batches of size 3 from seven items, preserve the final [6], and reject a non-positive batch size.',
    why:
      'Batch iterators bound memory and let embedding or inference calls process streams at a controlled request size.',
    tasks: [
      'Raise ValueError when batch size is zero or negative',
      'Yield an independent copy whenever a full batch is ready',
      'Yield the final partial batch instead of silently dropping it',
    ],
    taskInstructions: [
      'Construct ValueError with the existing message in the invalid-size branch, so callers receive a specific contract failure.',
      'Yield list(batch) before clearing the working list; yielding batch itself would expose the same mutable object.',
      'After the loop, yield list(batch) only when batch is non-empty, preserving the last short group without an empty batch.',
    ],
    code: `# Intermediate 26 — Iterator batching
# Goal: stream bounded groups and preserve the final partial group.

def batched(items, size):
    if size <= 0:
        raise ???("size must be positive")

    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield ???
            batch.clear()

    if batch:
        yield ???

print(list(batched(range(7), 3)))

try:
    list(batched(range(3), 0))
except ValueError as error:
    print("Invalid size:", error)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['raise ValueError', 'yield list(batch)', 'batch.clear()'],
      printPatterns: ['0, 1, 2.*3, 4, 5.*6', 'Invalid size: size must be positive'],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Raise ValueError and use `yield list(batch)` in both yield positions.',
    ],
    predict: {
      prompt: 'Why yield list(batch) before clearing batch?',
      choices: [
        'Each yielded group keeps an independent snapshot',
        'It sorts every group',
        'It converts numbers into strings',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'Yielding the mutable working list and then clearing it can empty results already handed to callers.',
      wrong: 'yield batch\nbatch.clear()',
      fixed: 'yield list(batch)\nbatch.clear()',
    },
    stretch:
      'Stretch: add a drop_last=False argument and test both policies on seven items.',
  },
  {
    id: 'mid-async-timeouts-retries',
    difficulty: 'intermediate',
    number: 27,
    topic: 'Async timeouts/retries',
    chapter: 'Production patterns',
    goal:
      'Finish an async retry controller that allows at most two attempts. Done when Results shows recovery after one timeout, fallback after repeated failure, and three timeout lines.',
    why:
      'Real provider calls need event-loop timeout primitives; this deterministic browser simulation isolates the same retry and fallback decisions without making network or wall-clock timing part of the lesson.',
    tasks: [
      'Run exactly max_attempts numbered attempts instead of an unbounded loop',
      'Await the provider and catch only the simulated timeout type',
      'Return a fallback result after every allowed attempt times out',
    ],
    taskInstructions: [
      'Add 1 to max_attempts in range’s stop value, because Python excludes the stop and attempts are numbered from one.',
      'Replace the exception blank with ProviderTimeout so only the expected transient failure is retried and unrelated bugs still surface.',
      'Return the string "fallback" after the loop, proving a permanently slow provider has a deterministic terminal result.',
    ],
    code: `# Intermediate 27 — Async timeouts and retries
# This pure-Python fixture simulates timeout outcomes; it does not perform I/O.

class ProviderTimeout(Exception):
    pass

async def provider(attempt, always_slow=False):
    if always_slow or attempt == 1:
        raise ProviderTimeout("simulated provider timeout")
    return "ok"

async def call_with_retry(always_slow=False, max_attempts=2):
    for attempt in range(1, max_attempts + ???):
        try:
            return await provider(attempt, always_slow)
        except ???:
            print(f"attempt {attempt}: timeout")
    return ???

# These teaching coroutines never suspend on real I/O, so a tiny deterministic
# driver can run them in every browser without an event-loop compatibility trap.
def run_without_io(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as completed:
        return completed.value
    raise RuntimeError("The fixture unexpectedly suspended on real I/O")

recovered = run_without_io(call_with_retry())
exhausted = run_without_io(call_with_retry(always_slow=True))
print("Recovered:", recovered)
print("Exhausted:", exhausted)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['async def', 'await provider', 'max_attempts + 1', 'except ProviderTimeout', 'return "fallback"'],
      printPatterns: ['attempt 1: timeout', 'Recovered: ok', 'Exhausted: fallback'],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Use `+ 1`, catch `ProviderTimeout`, and return `"fallback"` after the loop.',
    ],
    predict: {
      prompt: 'What does await provider(...) do inside call_with_retry?',
      choices: [
        'Waits for its result or propagates its exception',
        'Runs the provider twice automatically',
        'Turns every exception into fallback',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'A retry controller needs a narrow transient-error policy and a hard attempt limit.',
      wrong: 'while True:\n    return await provider()',
      fixed: 'for attempt in range(1, max_attempts + 1):\n    try: return await provider(attempt)\n    except ProviderTimeout: pass',
    },
    stretch:
      'Stretch: calculate and print an increasing backoff value for each retry without adding a real sleep to this deterministic fixture.',
  },
  {
    id: 'mid-structured-logging',
    difficulty: 'intermediate',
    number: 28,
    topic: 'Structured logging',
    chapter: 'Production patterns',
    goal:
      'Emit valid JSON with trace fields while replacing prompt and API key values, then print Redaction safe: True.',
    why:
      'Structured, correlated logs support debugging and monitoring, but sensitive prompts and credentials must be removed first.',
    tasks: [
      'Build the event record from its event name and trace fields',
      'Replace values for every field named in the sensitive allow-list',
      'Serialize stable JSON and assert both sensitive values are redacted',
    ],
    taskInstructions: [
      'Store the event argument under the "event" key and merge only the already-redacted fields into the same record.',
      'Return "[REDACTED]" when a key is in SENSITIVE; keep safe correlation, model, latency, and status values unchanged.',
      'Enable sort_keys=True for stable output and compare both prompt and api_key fields with the redaction marker.',
    ],
    code: `# Intermediate 28 — Structured logging
# Goal: preserve operational context without leaking sensitive values.

import json

SENSITIVE = {"api_key", "prompt"}

def redact_fields(fields):
    return {
        key: (??? if key in SENSITIVE else value)
        for key, value in fields.items()
    }

def log_event(event, **fields):
    record = {"event": ???, **redact_fields(fields)}
    encoded = json.dumps(record, sort_keys=???)
    print(encoded)
    return record

record = log_event(
    "model_call",
    request_id="req-7",
    model="tiny-embed",
    latency_ms=42,
    status="ok",
    prompt="private customer text",
    api_key="sk-secret123",
)

safe = record["prompt"] == ??? and record["api_key"] == "[REDACTED]"
assert safe
print("Redaction safe:", safe)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['"[REDACTED]" if key in SENSITIVE', '"event": event', 'sort_keys=True', 'assert safe'],
      printPatterns: ['"request_id": "req-7"', '"api_key":.*REDACTED', 'Redaction safe: True'],
      minNonEmptyPrints: 2,
    },
    hints: [
      'Use the [REDACTED] marker, the event argument, True for sort_keys, and the same marker in the safety check.',
    ],
    predict: {
      prompt: 'Which field is most useful to keep when raw prompt text must be redacted?',
      choices: ['request_id', 'api_key', 'the full private prompt'],
      correctIndex: 0,
    },
    compare: {
      note: 'Structured fields remain queryable after sensitive values are replaced.',
      wrong: 'print(f"calling with {prompt} and {api_key}")',
      fixed: 'print(json.dumps({"request_id": request_id, "prompt": "[REDACTED]"}))',
    },
    stretch:
      'Stretch: add a nested metadata dictionary and recursively redact a nested token field.',
  },
  {
    id: 'mid-data-pipeline-capstone',
    difficulty: 'intermediate',
    number: 29,
    topic: 'Data pipeline capstone',
    chapter: 'Intermediate capstone',
    goal:
      'Parse, validate, deduplicate, normalize, seeded-split, and batch data with 3 accepted, 2 rejected, and disjoint splits.',
    why:
      'Reliable AI work begins with a reproducible data pipeline whose invalid records and split boundaries are visible and tested.',
    tasks: [
      'Parse each JSONL record and reject missing, empty, or duplicate examples',
      'Normalize accepted text into a copied record without changing raw input',
      'Seed the split, batch training rows, and assert train/validation ids are disjoint',
    ],
    taskInstructions: [
      'Parse the current line, reject ids already in seen, and add each accepted id to seen before accepting another record.',
      'Build normalized from lowercased split tokens joined by one space, then store it in a new `{**record, ...}` dictionary.',
      'Use a seeded Random(7), take two shuffled records for train, and compare the two id sets with isdisjoint(...).',
    ],
    code: `# Intermediate 29 — Data pipeline capstone
# Goal: turn imperfect JSONL into reproducible, tested training batches.

import json
import random
from io import StringIO

RAW = """{"id":"e1","text":" Great answer ","label":"good"}
{"id":"e1","text":"duplicate","label":"good"}
{"id":"e2","text":"Needs sources","label":"bad"}
{"id":"e3","text":"   ","label":"good"}
{"id":"e4","text":"Clear explanation","label":"good"}"""

def prepare_jsonl(text):
    accepted = []
    rejected = []
    seen = set()

    for line_number, line in enumerate(StringIO(text), start=1):
        record = json.loads(???)
        record_id = record.get("id")
        normalized = ???

        if not record_id or not normalized or record_id in ???:
            rejected.append(line_number)
            continue

        seen.add(???)
        accepted.append({**record, "text": normalized})

    return accepted, rejected

def batched(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]

records, rejected = prepare_jsonl(RAW)
random.Random(7).shuffle(records)

train = records[:???]
validation = records[2:]
train_batches = list(batched(train, 2))

train_ids = {row["id"] for row in train}
validation_ids = {row["id"] for row in validation}
assert train_ids.???(validation_ids)

summary = {
    "accepted": len(records),
    "rejected": len(rejected),
    "train": len(train),
    "validation": len(validation),
    "batches": len(train_batches),
}

print("Summary:", summary)
print("Rejected lines:", rejected)
print("Train text:", [row["text"] for row in train])
print("Splits disjoint: True")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: ['json.loads(line)', 'record_id in seen', 'seen.add(record_id)', 'random.Random(7)', 'records[:2]', 'isdisjoint(validation_ids)'],
      printPatterns: ["'accepted': 3", "'rejected': 2", "'train': 2", "'validation': 1", 'Rejected lines:.*2.*4', 'Splits disjoint: True'],
      minNonEmptyPrints: 4,
    },
    hints: [
      'Parse line; normalize with `" ".join(record.get("text", "").lower().split())`; use seen, 2, and isdisjoint.',
    ],
    predict: {
      prompt: 'Why seed the shuffle before creating train and validation splits?',
      choices: [
        'The same input produces the same split again',
        'It guarantees every model is accurate',
        'It removes the need for validation',
      ],
      correctIndex: 0,
    },
    compare: {
      note: 'Split after validation and deduplication so corrupt or duplicate examples cannot leak across sets.',
      wrong: 'random.shuffle(raw_lines)  # then validate each split independently',
      fixed: 'records = validate_and_dedupe(raw_lines)\nrandom.Random(7).shuffle(records)',
    },
    stretch:
      'Stretch: stratify the split by label so both train and validation contain a good example when data permits.',
  },
]
