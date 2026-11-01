import type { LessonDraft } from '../examples'
import { SERVICE_CHECKS, type ServiceExerciseId } from '../serviceExercise'

const VALIDATION_STARTER = `# Step 1: accept a useful question before doing any AI work.
# A payload is a dictionary, such as {"question": " What is Python? "}.
def validate_question(payload):
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object")

    question = payload.get("question")
    if not isinstance(question, str):
        raise ValueError("Question must be text")

    question = ???  # Strip spaces from both ends.
    if ???:  # Reject an empty question after stripping.
        raise ValueError("Question cannot be empty")
    return question

print(validate_question({"question": " What is Python? "}))
`

const ENDPOINT_ADDITION = `# Step 2: your function now sits behind a simulated HTTP endpoint.
# This runs in the browser. No server or API key is needed.
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()

@app.post("/ask")
def ask(payload: dict):
    try:
        question = ???  # Call your validation function with payload.
    except ValueError as error:
        raise HTTPException(status_code=???, detail=str(error))
    return {"question": question}

client = TestClient(app)
print(client.post("/ask", json={"question": " What is Python? "}))
print(client.post("/ask", json={"question": "   "}))
`

const TESTS_ADDITION = `# Step 3: write tests that would catch a broken service.
# assert raises AssertionError when its comparison is false.
# Use the client above; check both status_code and response.json().
def test_valid_request():
    response = client.post("/ask", json={"question": " What is Python? "})
    assert response.status_code == ???
    assert response.json() == ???

def test_invalid_request():
    # Send an empty or missing question and assert that it returns 422.
    # Also check that the JSON body contains a nonempty "detail".
    ???

test_valid_request()
test_invalid_request()
print("Both request tests passed")
`

export function previousServiceExercise(
  id: ServiceExerciseId,
): ServiceExerciseId | null {
  if (id === 'service-endpoint') return 'service-validation'
  if (id === 'service-tests') return 'service-endpoint'
  return null
}

export function serviceStarterCode(
  id: ServiceExerciseId,
  previousVerifiedCode?: string,
): string {
  if (id === 'service-validation') return VALIDATION_STARTER
  const previous = previousVerifiedCode ?? (
    id === 'service-endpoint'
      ? VALIDATION_STARTER
      : `${VALIDATION_STARTER}\n${ENDPOINT_ADDITION}`
  )
  return `${previous.trimEnd()}\n\n${id === 'service-endpoint' ? ENDPOINT_ADDITION : TESTS_ADDITION}`
}

export const SERVICE_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'service-validation',
    difficulty: 'service',
    number: 1,
    topic: 'Validate a question',
    chapter: 'Build one service',
    goal: 'Write a function that accepts a useful question and rejects invalid input.',
    why: 'Start with a small Python function. You will reuse your own code in the next exercise when the question arrives over HTTP.',
    tasks: SERVICE_CHECKS['service-validation'].map((check) => check.label),
    taskInstructions: [
      'Replace the first ??? with question.strip() so leading and trailing spaces do not reach the service.',
      'Replace the second ??? with not question. The existing raise then rejects empty or whitespace-only text.',
      'Read the two isinstance checks. Try a number, a missing question, and a list; each must raise ValueError.',
    ],
    code: VALIDATION_STARTER,
    goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['An empty string is false in Python: not question is true after spaces have been stripped.'],
    stretch: 'Try a question with tabs or line breaks around it and check that its meaningful text is preserved.',
    predict: {
      prompt: 'After stripping spaces, should "   " be accepted as a question?',
      choices: ['No, it is empty', 'Yes, it is a string'],
      correctIndex: 0,
    },
    compare: { wrong: 'return question', fixed: 'return question.strip()', note: 'Trim before checking whether text is empty.' },
  },
  {
    id: 'service-endpoint',
    difficulty: 'service',
    number: 2,
    topic: 'Expose a FastAPI endpoint',
    chapter: 'Build one service',
    goal: 'Connect your validation function to POST /ask and return a clear error for bad input.',
    why: 'Your completed function is carried forward. A small HTTP handler translates its result into a response and its ValueError into a 422 error.',
    tasks: SERVICE_CHECKS['service-endpoint'].map((check) => check.label),
    taskInstructions: [
      'In ask(), replace ??? with validate_question(payload). Keep the returned question in the response dictionary.',
      'Replace the status-code blank with 422. Run both sample requests and compare their HTTP cards in Results.',
      'Keep validation in your existing function; the handler should call it instead of copying or bypassing its rules.',
    ],
    code: serviceStarterCode('service-endpoint'),
    goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['ValueError belongs to your Python function. HTTPException turns it into a response the client can understand.'],
    stretch: 'Send a missing question and a numeric question with TestClient and confirm that neither returns 200.',
    predict: {
      prompt: 'What status should an empty question receive?',
      choices: ['200: accepted', '422: invalid input'],
      correctIndex: 1,
    },
    compare: { wrong: 'question = payload["question"]', fixed: 'question = validate_question(payload)', note: 'Use the validation you already built.' },
  },
  {
    id: 'service-tests',
    difficulty: 'service',
    number: 3,
    topic: 'Test valid and invalid requests',
    chapter: 'Build one service',
    goal: 'Write request tests that pass for your service and fail when its behavior breaks.',
    why: 'The working endpoint is carried forward. Tests make its contract repeatable: a useful question succeeds, while invalid input stays rejected.',
    tasks: SERVICE_CHECKS['service-tests'].map((check) => check.label),
    taskInstructions: [
      'Keep your validation function and endpoint unchanged while adding tests below the existing client.',
      'Complete test_valid_request with assertions for status 200 and the exact trimmed question dictionary.',
      'Write test_invalid_request using client.post, then assert status 422 and a nonempty detail in the response JSON.',
    ],
    code: serviceStarterCode('service-tests'),
    goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['Use response.json()["detail"] to read an error detail. assert response.json()["detail"] checks that it is not empty.'],
    stretch: 'Add another invalid case such as {"question": 42} or {} and keep each assertion specific enough to catch a regression.',
    predict: {
      prompt: 'If a broken endpoint returns 200 for an empty question, what should your invalid-request test do?',
      choices: ['Pass because the request completed', 'Fail its assertion'],
      correctIndex: 1,
    },
    compare: { wrong: 'assert response', fixed: 'assert response.status_code == 422', note: 'Check the contract, not just the existence of a response.' },
  },
]
