import type { LessonDraft } from '../examples'
import { GENAI_SECURITY_CHECKS } from '../genaiSecurityExercise'

const BEDROCK_STARTER = `# Standalone /ask adapter exercise: fake Converse, no AWS calls or credentials.
# Real boto3 uses a bedrock-runtime client; this client only records dictionaries.
# Shape: docs.aws.amazon.com/boto3/latest/reference/services/bedrock-runtime/client/converse.html
class FakeBedrockClient:
    def __init__(self):
        self.requests = []

    def converse(self, **request):
        self.requests.append(request)
        return {"output": {"message": {"role": "assistant", "content": [
            {"text": "Python functions make behavior reusable."}
        ]}}, "stopReason": "end_turn"}

def ask_bedrock(client, model_id, question):
    if not isinstance(question, str) or not question.strip():
        raise ValueError("A nonempty question is required")
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError("A configured model ID is required")
    response = client.converse(
        modelId=model_id,
        system=[{"text": "Explain Python briefly."}],
        messages=[{"role": "user", "content": [{"text": ???}]}],
        inferenceConfig={"maxTokens": ???, "temperature": 0},
    )
    if not isinstance(response, dict) or response.get("stopReason") != "end_turn":
        raise ValueError("Expected a completed text answer")
    output = response.get("output")
    message = output.get("message") if isinstance(output, dict) else None
    blocks = message.get("content") if isinstance(message, dict) else None
    if not isinstance(blocks, list):
        raise ValueError("Expected a list of content blocks")
    text = "".join(block["text"] for block in blocks
                   if isinstance(block, dict) and isinstance(block.get("text"), str))
    if not text.strip():
        raise ValueError("The model returned no text")
    return text

client = FakeBedrockClient()
print(ask_bedrock(client, "demo-model", " What is a function? "))
print(client.requests[0])
`

const RETRIES_STARTER = `# Standalone /ask reliability exercise. These provider responses are fixtures.
# The injected sleep records delays; no network calls or real waiting happen.
# Apply this only to safe model/read operations, not unprotected write actions.
TRANSIENT_STATUSES = {429, 500, 502, 503, 504}

def call_with_retry(operation, sleep, max_attempts=3):
    if type(max_attempts) is not int or not 1 <= max_attempts <= 5:
        raise ValueError("Use one to five attempts")
    for attempt in range(max_attempts):
        response = operation()
        status = response["status"]
        if status not in ??? or attempt == max_attempts - 1:
            return response
        sleep(???)  # 0.1, 0.2, 0.4 ... seconds, only before another attempt.

responses = iter([{"status": 503}, {"status": 200, "body": {"answer": "Ready"}}])
delays = []
print(call_with_retry(lambda: next(responses), delays.append))
print({"delays_seconds": delays})
`

const TOOLS_STARTER = `# Standalone tool loop: scripted proposals, not an LLM or framework SDK.
# LangChain create_agent uses callable tools and observations in a model/tool loop.
# Existing Bedrock Agents Classic action groups also describe actions and inputs.
# Agents Classic is closed to new customers; AWS points new work to AgentCore.
# This lesson only models validation, a read-only registry, and a turn budget.
import re

def run_tools(model, tools, max_steps=3):
    def fail(code):
        return {"ok": False, "error": code}

    if type(max_steps) is not int or not 1 <= max_steps <= 5:
        return fail("invalid_budget")
    observations = []
    for step in range(???):
        try:
            proposal = model(list(observations))
        except Exception:
            return fail("model_failed")
        if not isinstance(proposal, dict):
            return fail("invalid_proposal")
        if proposal.get("type") == "final":
            if set(proposal) != {"type", "text"} or not isinstance(proposal["text"], str) or not proposal["text"].strip():
                return fail("invalid_proposal")
            return {"ok": True, "answer": proposal["text"]}
        if set(proposal) != {"type", "name", "arguments"} or proposal.get("type") != "tool":
            return fail("invalid_proposal")
        name = proposal["name"]
        if name != ???:  # Only this read-only capability is permitted.
            return fail("tool_not_allowed")
        arguments = proposal["arguments"]
        if not isinstance(arguments, dict) or set(arguments) != {"record_id"}:
            return fail("invalid_arguments")
        record_id = arguments["record_id"]
        if not isinstance(record_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", record_id):
            return fail("invalid_arguments")
        tool = tools.get(name)
        if not callable(tool):
            return fail("tool_unavailable")
        try:
            result = tool(record_id=record_id)
        except Exception:
            return fail("tool_failed")
        observations.append({"tool": name, "result": result})
    return fail("step_limit")

def scripted_model(observations):
    if not observations:
        return {"type": "tool", "name": "lookup_status", "arguments": {"record_id": "r1"}}
    return {"type": "final", "text": "Record status: " + observations[0]["result"]["status"]}

tools = {"lookup_status": lambda record_id: {"status": "reviewed"}}
print(run_tools(scripted_model, tools))
`

const AUTHORIZATION_STARTER = `# Standalone /ask tool authorization. The principal comes from trusted auth.
# A model proposal is data: it cannot set identity, scope, tenant or approval.
# This read-only exercise does not implement login or a real identity provider.
def read_record(principal, proposal, records):
    def error(status, code):
        return {"status": status, "body": {"error": code}}

    if not isinstance(principal, dict) or principal.get("authenticated") is not True:
        return error(401, "unauthenticated")
    if not isinstance(principal.get("subject"), str) or not principal["subject"]:
        return error(401, "unauthenticated")
    scopes = principal.get("scopes", [])
    tenant = principal.get("tenant")
    if not isinstance(scopes, (list, set, tuple)) or ??? not in scopes:
        return error(403, "forbidden")
    if not isinstance(tenant, str) or not tenant:
        return error(403, "forbidden")
    if not isinstance(proposal, dict) or set(proposal) != {"record_id"}:
        return error(403, "forbidden")
    record_id = proposal["record_id"]
    if not isinstance(record_id, str) or not record_id:
        return error(400, "invalid_record_id")
    record = records.get(record_id)
    if record is None:
        return error(404, "not_found")
    if record["tenant"] != ???:
        return error(403, "forbidden")
    return {"status": 200, "body": {"record_id": record_id, "summary": record["summary"]}}

records = {
    "r1": {"tenant": "blue", "summary": "Blue record reviewed"},
    "r2": {"tenant": "red", "summary": "Red record reviewed"},
}
principal = {"authenticated": True, "subject": "user-17", "tenant": "blue", "scopes": ["records:read"]}
print(read_record(principal, {"record_id": "r1"}, records))
print(read_record(principal, {"record_id": "r2"}, records))
`

const AUDIT_STARTER = `# Standalone /ask audit event: keep metadata, not conversation bodies.
# This finite schema is a logging exercise, not comprehensive DLP or compliance.
# request_id must be a server-generated opaque ID, never a user email or token.
import re

def redact_text(text):
    # Demonstration patterns only. Do not log free text just because these ran.
    if not isinstance(text, str):
        raise ValueError("Expected text")
    text = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", ???, text)
    text = re.sub(r"(?i)\\bBearer\\s+[A-Za-z0-9._~-]+", "Bearer [TOKEN]", text)
    return re.sub(r"(?i)\\btoken\\s*=\\s*[A-Za-z0-9._~-]+", "token=[TOKEN]", text)

def audit_event(request_id, event):
    if not isinstance(request_id, str) or not re.fullmatch(r"req-[a-f0-9]{8}", request_id):
        raise ValueError("Use the server-generated request ID")
    if not isinstance(event, dict):
        raise ValueError("An event must be a dictionary")
    allowed = ???  # Only fixed metadata fields belong in the output.
    safe = {"request_id": request_id}
    safe["kind"] = event.get("kind") if event.get("kind") in ("model_call", "tool_call", "request") else "unknown"
    safe["outcome"] = event.get("outcome") if event.get("outcome") in ("success", "denied", "error") else "unknown"
    for key in ("latency_ms", "input_tokens", "output_tokens"):
        value = event.get(key)
        safe[key] = value if type(value) is int and 0 <= value <= 10_000_000 else 0
    safe["redacted"] = bool(set(event) - ???)
    return safe

event = {
    "kind": "model_call", "outcome": "success", "latency_ms": 42,
    "input_tokens": 20, "output_tokens": 8,
    "prompt": "Contact learner@example.test", "token": "demo-secret",
    "response": {"answer": "private text"},
}
print(audit_event("req-1234abcd", event))
print(redact_text("Contact learner@example.test; Bearer demo-token; token=fixture-secret"))
`

export const GENAI_SECURITY_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'genai-bedrock', difficulty: 'genai', number: 6,
    topic: 'Call a Bedrock-shaped model', chapter: 'Providers & reliability',
    goal: 'Build and validate the request and response boundary for a fake Bedrock Converse call.',
    why: 'Your /ask endpoint needs a small provider adapter. This simulation practices the documented Converse shape without boto3, credentials, network access or model charges.',
    tasks: GENAI_SECURITY_CHECKS['genai-bedrock'].map((check) => check.label),
    taskInstructions: [
      'Put question.strip() in the user text block and 128 in maxTokens. Keep system instructions separate from the user message.',
      'Read output → message → content and join the text blocks. The adapter returns a string that your endpoint can wrap in JSON.',
      'Try blank text, a missing answer and a max_tokens stop reason. Reject them instead of treating an incomplete answer as finished.',
    ],
    code: BEDROCK_STARTER, goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['Use the injected client.converse method. demo-model is a fixture name; real deployments need an accessible model or inference profile and model-supported parameters.'],
    stretch: 'Add a fake response with two text blocks and confirm that both reach the answer.',
    predict: { prompt: 'Does FakeBedrockClient contact AWS?', choices: ['No, it returns a local fixture', 'Yes, it runs a hosted model'], correctIndex: 0 },
    compare: { wrong: 'messages=[{"role": "system", "content": question}]', fixed: 'system=[{"text": "Explain Python briefly."}]\nmessages=[{"role": "user", "content": [{"text": question}]}]', note: 'Practice the Converse content-block shape; model support and parameters still need checking in a real adapter.' },
  },
  {
    id: 'genai-retries', difficulty: 'genai', number: 7,
    topic: 'Retry within a budget', chapter: 'Providers & reliability',
    goal: 'Retry transient fixture responses with bounded backoff while returning permanent failures immediately.',
    why: 'A temporary provider outage may recover. A denied identity or invalid request needs correction, and repeated attempts must not turn one /ask request into unlimited work.',
    tasks: GENAI_SECURITY_CHECKS['genai-retries'].map((check) => check.label),
    taskInstructions: [
      'Use TRANSIENT_STATUSES in the membership check. Only the listed temporary status codes should reach another attempt.',
      'Try 401, 403 and 422 responses; each must return after one call with no sleep.',
      'Replace the delay with 0.1 * 2 ** attempt. max_attempts includes the first call, so never sleep after the final allowed call.',
    ],
    code: RETRIES_STARTER, goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['The provider and sleep functions are injected: tests can count calls and delays without calling a service or waiting. Real clients also need request timeouts and a policy for SDK-level retries.'],
    stretch: 'Use max_attempts=1 with a 503 response and prove that the delay list stays empty.',
    predict: { prompt: 'A provider returns 403. Should this retry loop try again?', choices: ['No, return the denial', 'Yes, repeat until permitted'], correctIndex: 0 },
    compare: { wrong: 'while response["status"] != 200:\n    response = operation()', fixed: 'for attempt in range(max_attempts):\n    response = operation()', note: 'Bound attempts and classify failures; do not apply this pattern blindly to write operations.' },
  },
  {
    id: 'genai-tools', difficulty: 'genai', number: 8,
    topic: 'Control a tool loop', chapter: 'Agent controls',
    goal: 'Run a bounded proposal → validated read-only tool → observation loop.',
    why: 'Frameworks can organize model and tool turns, but your harness still owns permission and execution. This Python simulation maps callable tools to LangChain and action definitions to existing Bedrock Agents Classic action groups; it does not run either SDK.',
    tasks: GENAI_SECURITY_CHECKS['genai-tools'].map((check) => check.label),
    taskInstructions: [
      'Set the loop range to max_steps so each model turn spends one unit. Inspect the observation returned after lookup_status.',
      'Allow only "lookup_status". Keep the exact argument key and record-ID checks before looking up or calling a function.',
      'Try a model that always proposes the same tool. It must stop with step_limit instead of looping forever.',
    ],
    code: TOOLS_STARTER, goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['A tool name proposed by the model does not authorize execution. Even a callable present in tools must be rejected when it is outside the fixed read-only allowlist.'],
    stretch: 'Add a delete_record callable to tools and prove that the model still cannot use it.',
    predict: { prompt: 'The model proposes delete_record and the registry contains it. What happens?', choices: ['The allowlist rejects it', 'The registry automatically authorizes it'], correctIndex: 0 },
    compare: { wrong: 'tools[proposal["name"]](**proposal["arguments"])', fixed: 'validate_name_and_arguments(proposal)\n# Then execute only the permitted read-only tool.', note: 'The comparison is conceptual pseudocode. This exercise implements the checks directly; tenant authorization is the next lesson.' },
  },
  {
    id: 'genai-authorization', difficulty: 'genai', number: 9,
    topic: 'Authorize every record read', chapter: 'Agent controls',
    goal: 'Allow a read only when trusted identity, scope and record tenant all agree.',
    why: 'A plausible record ID or model-written approval is not permission. Your /ask tool must check the authenticated principal against the actual record before returning data.',
    tasks: GENAI_SECURITY_CHECKS['genai-authorization'].map((check) => check.label),
    taskInstructions: [
      'Require the literal scope "records:read". A valid blue principal should read r1, and a valid red principal should read r2.',
      'Keep missing authentication and missing scope denied. An empty principal must never become an administrator by default.',
      'Compare record["tenant"] with tenant from the trusted principal. Proposal fields such as approved or tenant must not grant access.',
    ],
    code: AUTHORIZATION_STARTER, goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['Use the trusted tenant variable in the comparison, not any tenant named in the model proposal. This function assumes a separate authentication layer already validated the principal.'],
    stretch: 'Switch the trusted principal to the red tenant and confirm that the allowed and denied records reverse.',
    predict: { prompt: 'Can {"approved": True} in model output override tenant authorization?', choices: ['No, it is untrusted proposal data', 'Yes, the model approved it'], correctIndex: 0 },
    compare: { wrong: 'if proposal.get("approved"):\n    return record', fixed: 'if record["tenant"] != principal["tenant"]:\n    return forbidden', note: 'Conceptual comparison: authorization uses trusted identity and the stored record, never model claims.' },
  },
  {
    id: 'genai-audit', difficulty: 'genai', number: 10,
    topic: 'Keep a useful, minimal audit event', chapter: 'Agent controls',
    goal: 'Produce structured operational evidence without copying prompts, responses, credentials or personal data.',
    why: 'A request ID, outcome and latency help diagnose /ask failures. Copying the entire request can leak data; this finite metadata schema demonstrates exclusion and value validation, not a complete compliance or DLP system.',
    tasks: GENAI_SECURITY_CHECKS['genai-audit'].map((check) => check.label),
    taskInstructions: [
      'Set allowed to {"kind", "outcome", "latency_ms", "input_tokens", "output_tokens"}. Keep the server-generated request ID for correlation.',
      'Put "[EMAIL]" in redact_text and allowed in the audit set difference. Inspect the email/token demo, but keep all free-text bodies out of audit output even after redaction.',
      'Keep enum and integer checks: an email under outcome or a secret under latency_ms must not pass just because the key is allowed.',
    ],
    code: AUDIT_STARTER, goalCheck: { noBlanks: true, requireSuccess: true },
    hints: ['Token counts are numeric usage metadata; API tokens are secrets. Preserve input_tokens/output_tokens counts, but exclude a token credential and all prompt/response bodies.'],
    stretch: 'Put nested personal data under an unknown field and verify that the serialized audit event contains none of it.',
    predict: { prompt: 'Should an error log include the complete model prompt for convenience?', choices: ['No, keep validated metadata', 'Yes, log every input'], correctIndex: 0 },
    compare: { wrong: 'print(event)', fixed: 'print(audit_event(server_request_id, event))', note: 'The server assigns the opaque ID. This exercise returns a minimal event instead of trying to redact every possible free-text secret.' },
  },
]
