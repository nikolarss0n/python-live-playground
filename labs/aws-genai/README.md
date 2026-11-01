# Secure Python and AWS GenAI lab

Continue from the browser exercises in a normal Python project. This is an optional local lab, not a backend for the playground. It uses synthetic policy data and starts offline. No account, credentials, cloud resources, or model downloads are needed for the default run.

## Setup and run

Use Python 3.11 or later. Run these commands from this folder:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
.venv/bin/python -m pytest
.venv/bin/python -m aws_genai_lab.cli
.venv/bin/ruff check src tests
```

Package installation downloads dependencies from PyPI. Tests and the default demo make no network requests. On Windows, replace `.venv/bin/python` with `.venv\Scripts\python.exe` and use the equivalent Ruff executable.

The default command returns a provisional draft, separately identified synthetic tool evidence, and audit metadata. Its fixed model response demonstrates the plumbing; it is not a quality evaluation of an LLM.

## Work through the code

1. **Contracts:** `contracts.py` validates a question, exact JSON model output, tool arguments, and response/audit records. Try blank input, an extra `authorized` field, and a made-up tool name. Each should fail.
2. **Prompt and adapter:** `bedrock.py` keeps the system message separate from redacted user text. The real adapter calls `client.converse`, rejects malformed, blocked, or truncated responses, and records actual reported token usage. `test_bedrock.py` uses the real SDK with `botocore.stub.Stubber` to validate request parameters without sending them.
3. **Authorization:** `controls.py` has one read-only tool and a caller-owned document allowlist. Ask for `restricted-demo`: the model can propose it, but code denies it before reading. No model argument can extend permissions.
4. **Harness:** `harness.py` follows validate → model proposal → schema check → authorize → execute → audit. The direct adapter makes one proposal; it does not feed retrieved evidence back into a second model call. Review its draft against the separate evidence before treating it as grounded.
5. **Failure practice:** break the scope check and run tests; restore it, then break output validation or retry limits. Explain which test detects each regression. Add a denial test before introducing any new tool.

The input limit is 512 UTF-8 bytes, an explicit small payload bound rather than an exact tokenizer count. Output is capped at 192 requested tokens; usage comes from the provider response. Retry policy permits at most two attempts for throttling/service-unavailable errors, with bounded backoff. Authorization errors and ambiguous transport timeouts are not retried. The SDK disables its own retries in live mode, so layers cannot multiply attempts. Connect/read timeouts are 2/10 seconds; these are socket timeouts, not a guarantee of a total wall-clock deadline.

Audit events contain generated request IDs, decisions, attempt counts, and token usage. They exclude prompts, drafts, tool arguments, document bodies, and credentials. Email/secret-pattern redaction is a teaching example, not a complete PII detector or an authorization mechanism. There is no durable audit store, authentication server, deployment, or production security certification in this lab.

## Real LangChain, still offline

```sh
.venv/bin/python -m pip install -e '.[test,langchain]'
.venv/bin/python -m pytest
.venv/bin/python -m aws_genai_lab.langchain_demo
```

This separate demo uses real `create_agent` and `ChatBedrockConverse`, with two SDK-stubbed responses and the same code-enforced authorization. It performs native tool calling, observes the tool result, and validates the final JSON draft. Model-call and tool-call middleware bound it to two model calls and one tool call; graph-step limits are an additional bound. The tests also prove denial and runaway-loop stopping. LangSmith tracing is disabled for this invocation, including when a shell enables it. The default test suite skips the optional agent tests when the `langchain` extra is absent. Dependency minimums match the validated versions: LangChain 1.4.7 and langchain-aws 1.9.1.

The injected stub client uses fake credentials and disables user profile/config-file loading, including ambient `AWS_PROFILE` and `AWS_DEFAULT_PROFILE` selection, without changing the shell environment. Tests block outbound socket connections and AWS credential resolution. No real AWS configuration was inspected to validate this lab.

## Optional, explicitly authorized live experiment

Only after an owner approves your account, model, region, permissions, and spending, use an existing organization-approved AWS sign-in. Never paste keys into the playground or source files. The CLI reads AWS configuration and resolves credentials only after `--live` is selected.

```sh
# Replace these placeholders with your approved region and model ID.
AWS_REGION=YOUR_APPROVED_REGION BEDROCK_MODEL_ID=YOUR_APPROVED_MODEL_ID \
  .venv/bin/python -m aws_genai_lab.cli --live
```

This sends the one fixed `SYNTHETIC_QUESTION`, allows **one model request with no retry**, and requests at most 192 output tokens. It may incur a charge. It accepts no file uploads or arbitrary CLI question. The model must support Converse and the selected inference parameters. Validation can reject a model response even when AWS returns HTTP success.

For a separately approved native-tool experiment, the same environment variables with `python -m aws_genai_lab.langchain_demo --live` permit **up to two** model requests and one read-only synthetic tool call. Select a model that supports Converse tool calling. This small demo excludes application inference profiles to avoid implicit control-plane lookup calls.

Ask the account owner to scope `bedrock:InvokeModel` to the approved resource and region; do not grant broad administrative policies for a lab. Inference profiles can route across regions, so an approved region variable alone does not establish data residency. Review model availability, routing, provider terms, network controls, and invocation-log destinations before using any real data. AWS invocation logging can capture complete requests and responses; local redacted audit metadata does not control account-level logging. [Converse permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html), [AWS data protection](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html), [invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html).

No live model request, cloud deployment, IAM change, or production validation was performed while implementing this lab.

## Mapping to AWS agents

The local tool name and input schema correspond to an action definition; `execute_tool` corresponds to an authorized executor. With a hosted agent, fulfillment might run in Lambda or return control to your application. In either case, enforce caller authorization and input validation in the executor, not merely in the agent instructions.

As checked on **29 October 2026**, AWS calls the older service **Amazon Bedrock Agents Classic** and states it is no longer open to new customers; existing customers can continue using it. AWS points new users toward AgentCore. Learn the action-group concept for existing systems, then assess the currently available hosting/runtime options with your team. This lab provisions neither service. [Official action-group documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-action-create.html).

## Verification and limits

Offline tests cover contracts, prompt separation, redaction, model failures, attempt limits, tool allowlists, authorization denials, metadata-only audits, and real SDK/framework request paths. They do not establish live model accuracy, AWS IAM effectiveness, account-level logging behavior, deployment reliability, or isolation against arbitrary Python code. Completing exercises demonstrates practice, not the years of production experience expected by a senior role.

APIs checked against official documentation on 29 October 2026: [Boto3 Converse](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-runtime/client/converse.html), [botocore Config](https://docs.aws.amazon.com/botocore/latest/reference/config.html), [Stubber](https://docs.aws.amazon.com/botocore/latest/reference/stubber.html), [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents), [Bedrock integration](https://docs.langchain.com/oss/python/integrations/chat/bedrock), [call-limit middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in).
