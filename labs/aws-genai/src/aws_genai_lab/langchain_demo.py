import argparse
from dataclasses import dataclass
from uuid import uuid4

from .bedrock import SYNTHETIC_QUESTION, SYSTEM_PROMPT, ConverseClient, LiveSettings, live_client
from .contracts import AuditEvent, Proposal, Question
from .controls import (
    DEMO_PRINCIPAL,
    AuthorizationDenied,
    Principal,
    read_authorized_policy,
    redact,
)
from .offline import isolated_stub_client, response_fixture


@dataclass(frozen=True)
class AgentResult:
    draft: str
    audit: tuple[AuditEvent, ...]


def run_agent(
    client: ConverseClient, model_id: str, question: Question, principal: Principal
) -> AgentResult:
    from langchain.agents import create_agent
    from langchain.agents.middleware import ModelCallLimitMiddleware, ToolCallLimitMiddleware
    from langchain.tools import tool
    from langchain_aws import ChatBedrockConverse
    from langsmith import tracing_context

    if "application-inference-profile" in model_id:
        raise ValueError(
            "This small demo requires an approved model ID, not an application profile"
        )
    request_id = str(uuid4())
    audit: list[AuditEvent] = []

    @tool
    def read_policy(document_id: str) -> str:
        """Read a synthetic policy document; caller authorization is enforced by the host."""
        try:
            text = read_authorized_policy(document_id, principal)
        except AuthorizationDenied:
            audit.append(
                AuditEvent(
                    request_id=request_id,
                    event="tool",
                    outcome="denied",
                    attempts=0,
                )
            )
            return "Denied by caller policy. No document was read."
        audit.append(
            AuditEvent(
                request_id=request_id,
                event="tool",
                outcome="allowed",
                attempts=0,
            )
        )
        return text

    model = ChatBedrockConverse(
        client=client,
        # Avoid creating a second AWS client or resolving credentials implicitly.
        bedrock_client=client,
        aws_access_key_id=None,
        aws_secret_access_key=None,
        aws_session_token=None,
        credentials_profile_name=None,
        bedrock_api_key=None,
        model_id=model_id,
        max_tokens=192,
        temperature=0,
    )
    agent = create_agent(
        model=model,
        tools=[read_policy],
        system_prompt=SYSTEM_PROMPT
        + (
            " Use the native read_policy tool when evidence is needed. "
            "After observing evidence, return JSON with draft and action:null."
        ),
        middleware=[
            ToolCallLimitMiddleware(run_limit=1, exit_behavior="error"),
            ModelCallLimitMiddleware(run_limit=2, exit_behavior="error"),
        ],
    )
    # Even if tracing is enabled in the shell, this lab must not send prompts to LangSmith.
    with tracing_context(enabled=False):
        result = agent.invoke(
            {"messages": [{"role": "user", "content": redact(question.text)}]},
            config={"recursion_limit": 20},
        )
    answer = Proposal.model_validate_json(result["messages"][-1].text)
    if answer.action is not None:
        raise ValueError("Final answer must not contain an unexecuted action")
    return AgentResult(draft=redact(answer.draft), audit=tuple(audit))


def tool_response_fixture(document_id: str = "demo-policy") -> dict[str, object]:
    response = response_fixture()
    response["stopReason"] = "tool_use"
    response["output"] = {
        "message": {
            "role": "assistant",
            "content": [
                {
                    "toolUse": {
                        "toolUseId": "synthetic-tool-1",
                        "name": "read_policy",
                        "input": {"document_id": document_id},
                    },
                }
            ],
        }
    }
    return response


def offline_demo() -> AgentResult:
    from botocore.stub import Stubber

    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_response("converse", tool_response_fixture())
        stubber.add_response(
            "converse",
            response_fixture(
                {
                    "draft": "The synthetic policy requires review of generated answers.",
                    "action": None,
                }
            ),
        )
        result = run_agent(
            client,
            "amazon.nova-lite-v1:0",
            Question(text=SYNTHETIC_QUESTION),
            DEMO_PRINCIPAL,
        )
        stubber.assert_no_pending_responses()
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LangChain lab: offline SDK stubs by default")
    parser.add_argument("--live", action="store_true", help="Allow at most two Bedrock model calls")
    args = parser.parse_args(argv)
    try:
        if args.live:
            settings = LiveSettings.from_environment()
            result = run_agent(
                live_client(settings),
                settings.model_id,
                Question(text=SYNTHETIC_QUESTION),
                DEMO_PRINCIPAL,
            )
        else:
            result = offline_demo()
    except Exception:
        # This CLI boundary must not print an exception carrying a model transcript.
        print("Agent run failed. Check model compatibility, local setup, and offline tests.")
        return 1
    print(result.draft)
    for event in result.audit:
        print(event.model_dump_json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
