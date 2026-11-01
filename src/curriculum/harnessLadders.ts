import type { AlgorithmLadder } from './algorithmLayers'

/** Hint ladders for the agent harness interview lessons: the idea, what to use, a plan, then the shape of the code. */
export const HARNESS_LADDERS: Readonly<Record<string, AlgorithmLadder>> = {
  'harness-tool-registry': {
    idea: 'The model only sends a name and arguments. Your code decides what runs, and every failure becomes data the model can read.',
    tool: 'A dict lookup (`TOOLS.get(name)`), `fn(**args)` to call with keyword arguments, and `try/except Exception`.',
    plan: 'Look the name up. Unknown: return an error dict. Known: call it inside try and return {"result": ...}; on an exception return {"error": "Type: message"}.',
    shape: '`fn = TOOLS.get(name)`, `if fn is None: return {"error": f"unknown tool: {name}"}`, then `try: return {"result": fn(**args)}` / `except Exception as exc: return {"error": f"{type(exc).__name__}: {exc}"}`.',
  },
  'harness-validate-args': {
    idea: 'The function signature already says what is allowed. Compare the model’s arguments with it before running anything.',
    tool: '`inspect.signature(fn).parameters`: each Parameter has `.default` and `.annotation`; `inspect.Parameter.empty` means “none given”.',
    plan: 'First list argument names the function does not have. Then walk the parameters: missing and required → problem; present with an annotation but the wrong type → problem.',
    shape: '`params = inspect.signature(fn).parameters`, a list comprehension for unexpected names, then `for name, param in params.items():` with a missing check and an `isinstance(args[name], param.annotation)` check; `return problems`.',
  },
  'harness-agent-loop': {
    idea: 'An agent is a loop: model → tool → result → model again, until the model answers. The conversation is plain data you own.',
    tool: 'A list of message dicts, the injected `model.complete(messages)`, and `call_tool` from the registry lesson.',
    plan: 'Start with the user message. Loop: get a reply; if it has "answer", return it with the tools used. Otherwise append the request and the tool result, remember the tool name, and go again.',
    shape: '`messages = [{"role": "user", "content": question}]`, `used = []`, `while True:` with `reply = model.complete(messages)`, the answer check, two `messages.append(...)` calls and `used.append(reply["tool"])`.',
  },
  'harness-step-limit': {
    idea: 'Every way a run can end gets a name. A budget guarantees the loop ends even when the model never answers.',
    tool: '`for step in range(1, max_steps + 1)` instead of `while True`, and a status field in every return.',
    plan: 'Inside the bounded loop: answer → "answered"; no "tool" key → "invalid_reply"; otherwise run the tool as before. After the loop, return "step_limit".',
    shape: '`for step in range(1, max_steps + 1):` → `return {"status": "answered", "answer": ..., "steps": step}` / `return {"status": "invalid_reply", "steps": step}` / append messages; after the loop `return {"status": "step_limit", "steps": max_steps}`.',
  },
  'harness-async-timeout': {
    idea: 'Each tool call gets a deadline. A slow tool becomes an error result instead of stalling the whole agent.',
    tool: '`await asyncio.wait_for(coroutine, timeout)`, which raises `asyncio.TimeoutError`; main already uses `asyncio.gather` to run calls together.',
    plan: 'Look the tool up as before. Await it through wait_for with the timeout. Catch the timeout and describe it with the number of seconds.',
    shape: '`fn = TOOLS.get(name)` with the unknown check, `try: return {"result": await asyncio.wait_for(fn(**args), timeout)}`, `except asyncio.TimeoutError: return {"error": f"timeout after {timeout}s"}`.',
  },
  'harness-approval-gate': {
    idea: 'Reads are safe; writes change money. Ask a person before any write, and decide that in code, not in the model.',
    tool: 'The `WRITE_TOOLS` set and the injected `approver(call)` function that returns True or False.',
    plan: 'If the tool is a write and the approver says no, return a rejection without running anything. Otherwise run the tool and return its result.',
    shape: '`if call["tool"] in WRITE_TOOLS and not approver(call): return {"status": "rejected", "reason": "approval denied"}`, then `return {"status": "done", "result": TOOLS[call["tool"]](**call["args"])}`.',
  },
  'harness-idempotency': {
    idea: 'The same request must have the same effect once, however many times it arrives. Remember results by key.',
    tool: 'The `DONE` dict mapping key → stored result, and dict unpacking `{**old, "replayed": True}`.',
    plan: 'Key seen before: return the stored result marked as replayed. New key: run the tool, store the result marked replayed=False, return it.',
    shape: '`if key in DONE: return {**DONE[key], "replayed": True}`, `result = {"result": TOOLS[call["tool"]](**call["args"]), "replayed": False}`, `DONE[key] = result`, `return result`.',
  },
  'harness-retries': {
    idea: 'Retry only errors that may go away (throttling, timeouts), wait longer each time, and give up after a few tries.',
    tool: 'A for loop over attempts, `except TransientError` (not Exception), a bare `raise` to re-raise, and the injected `sleep`.',
    plan: 'For each attempt, try fn and return on success. On a transient error: if it was the last attempt, re-raise; otherwise sleep base_delay × 2^(attempt − 1). Any other error is never caught.',
    shape: '`for attempt in range(1, attempts + 1):` → `try: return fn()` / `except TransientError:` → `if attempt == attempts: raise` → `sleep(base_delay * 2 ** (attempt - 1))`.',
  },
  'harness-prompt-injection': {
    idea: 'Text from emails or tools can contain instructions. The model may obey them, so code decides what is allowed for this task.',
    tool: 'The `TASK_POLICY[task]` dict with an allowed tool set and an allowed account set.',
    plan: 'Get the task’s policy. Tool not in the allowlist → return why. Call has an account outside the scope → return why. Otherwise return None.',
    shape: '`policy = TASK_POLICY[task]`, `if call["tool"] not in policy["tools"]: return f"tool {call[\'tool\']} is not allowed for {task}"`, `account = call["args"].get("account")` with the scope check, `return None`.',
  },
  'harness-trace': {
    idea: 'Every step leaves evidence: what ran, with what, how long it took and whether it failed, in a format a log platform can search.',
    tool: '`time.perf_counter()` for timing, a dict in a fixed key order, and `json.dumps` for one line per step.',
    plan: 'Start a timer, call the tool, build the entry (step number from len(TRACE) + 1), add "error" only on failure, append it to TRACE, print it as JSON and return the outcome.',
    shape: '`started = time.perf_counter()`, `outcome = call_tool(name, args)`, `entry = {"step": ..., "tool": name, "args": args, "ok": "error" not in outcome, "ms": ...}`, the error line, `TRACE.append(entry)`, `print(json.dumps(entry))`.',
  },
  'harness-eval-suite': {
    idea: 'A golden case fixes the input and the model’s replies, then checks both the answer and the tools used to reach it.',
    tool: 'A fresh `ScriptedModel(case["replies"])` per case, the given `run_agent`, and a list of failure messages.',
    plan: 'Run the agent on the case. If the expected phrase is not in the answer, add a failure. If the tool list differs from the expected one, add a failure. Return the list.',
    shape: '`run = run_agent(ScriptedModel(case["replies"]), case["question"])`, `failures = []`, two `if` checks that append messages, `return failures`.',
  },
  'harness-mock-build': {
    idea: 'Combine the registry, validation and the bounded loop. Bad calls go back to the model as errors so it can correct itself.',
    tool: '`TOOLS.get`, the given `validate`, `try/except`, a bounded `for` loop and status dicts.',
    plan: 'call_tool: unknown → error, problems → error, else run inside try. run_agent: for up to max_steps, answer → answered, no tool → invalid_reply, else append request + result and record the tool; after the loop → step_limit.',
    shape: 'call_tool: `fn = TOOLS.get(name)` … `if problems := validate(fn, args): return {"error": problems}` … `try: return {"result": fn(**args)}`. run_agent: `for _ in range(max_steps):` with the three outcomes and `return {"status": "step_limit", "tools": used}`.',
  },
  'harness-mock-harden': {
    idea: 'One gate function every call passes through: block, ask, replay, retry, then record. The order of the checks matters.',
    tool: 'The given `guard`, `approve`, `with_retries`, the `DONE` dict and the `TRACE` list; an if/elif chain that builds one outcome dict.',
    plan: 'Guard says no → blocked. Write and not approved → rejected. Key in DONE → replayed with the stored result. Otherwise run with retries, store by key → done. Append the outcome to TRACE and return it.',
    shape: '`if reason := guard(call): outcome = {"status": "blocked", ...}` / `elif ... not approve(call):` / `elif key in DONE:` / `else: result = with_retries(lambda: TOOLS[call["tool"]](**call["args"]))`, then `TRACE.append({"key": key, "tool": call["tool"], **outcome})`, `return outcome`.',
  },
}
