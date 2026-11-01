import os

import pytest
from botocore.stub import Stubber

pytest.importorskip(
    "langchain_aws", reason="Install the langchain extra for SDK-backed agent tests"
)

from langchain.agents.middleware.tool_call_limit import ToolCallLimitExceededError

from aws_genai_lab.contracts import Question
from aws_genai_lab.controls import DEMO_PRINCIPAL
from aws_genai_lab.langchain_demo import offline_demo, run_agent, tool_response_fixture
from aws_genai_lab.offline import isolated_stub_client, response_fixture


def test_offline_agent_ignores_ambient_profiles_without_changing_environment(monkeypatch):
    monkeypatch.setenv("AWS_PROFILE", "nonexistent-lab-profile")
    monkeypatch.setenv("AWS_DEFAULT_PROFILE", "nonexistent-lab-default")
    result = offline_demo()
    assert "review" in result.draft
    assert [event.outcome for event in result.audit] == ["allowed"]
    assert os.environ["AWS_PROFILE"] == "nonexistent-lab-profile"
    assert os.environ["AWS_DEFAULT_PROFILE"] == "nonexistent-lab-default"


def test_actual_langchain_agent_runs_two_stubbed_calls_and_authorizes_tool():
    result = offline_demo()
    assert "review" in result.draft
    assert [event.outcome for event in result.audit] == ["allowed"]


def test_actual_agent_cannot_read_restricted_policy():
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_response("converse", tool_response_fixture("restricted-demo"))
        stubber.add_response(
            "converse", response_fixture({"draft": "Access was denied.", "action": None})
        )
        result = run_agent(
            client, "amazon.nova-lite-v1:0", Question(text="Read policy"), DEMO_PRINCIPAL
        )
        assert [event.outcome for event in result.audit] == ["denied"]
        stubber.assert_no_pending_responses()


def test_agent_loop_stops_before_a_third_call():
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_response("converse", tool_response_fixture())
        stubber.add_response("converse", tool_response_fixture())
        with pytest.raises(ToolCallLimitExceededError, match="run limit exceeded"):
            run_agent(
                client, "amazon.nova-lite-v1:0", Question(text="Loop forever"), DEMO_PRINCIPAL
            )
        stubber.assert_no_pending_responses()
