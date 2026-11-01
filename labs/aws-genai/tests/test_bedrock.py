import os

import pytest
from botocore.exceptions import ReadTimeoutError
from botocore.stub import Stubber

from aws_genai_lab.bedrock import BedrockAdapter, ModelFailure, request_parameters
from aws_genai_lab.contracts import Question
from aws_genai_lab.offline import isolated_stub_client, response_fixture

QUESTION = Question(text="What does the synthetic policy require?")
MODEL_ID = "amazon.nova-lite-v1:0"


def test_stub_client_ignores_ambient_profiles_without_changing_environment(monkeypatch):
    monkeypatch.setenv("AWS_PROFILE", "nonexistent-lab-profile")
    monkeypatch.setenv("AWS_DEFAULT_PROFILE", "nonexistent-lab-default")
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_response("converse", response_fixture(), request_parameters(QUESTION, MODEL_ID))
        result = BedrockAdapter(client, MODEL_ID).propose(QUESTION)
        assert result.proposal.action.name == "read_policy"
        stubber.assert_no_pending_responses()
    assert os.environ["AWS_PROFILE"] == "nonexistent-lab-profile"
    assert os.environ["AWS_DEFAULT_PROFILE"] == "nonexistent-lab-default"


def test_real_sdk_request_shape_and_response_contract():
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_response("converse", response_fixture(), request_parameters(QUESTION, MODEL_ID))
        result = BedrockAdapter(client, MODEL_ID).propose(QUESTION)
        assert result.proposal.action.name == "read_policy"
        assert result.input_tokens == 100
        stubber.assert_no_pending_responses()


def test_throttle_retries_once_with_bounded_backoff():
    client = isolated_stub_client()
    delays = []
    with Stubber(client) as stubber:
        stubber.add_client_error(
            "converse",
            "ThrottlingException",
            expected_params=request_parameters(QUESTION, MODEL_ID),
        )
        stubber.add_response("converse", response_fixture(), request_parameters(QUESTION, MODEL_ID))
        result = BedrockAdapter(client, MODEL_ID, sleep=delays.append).propose(QUESTION)
        assert result.attempts == 2
        assert delays == [0.1]
        stubber.assert_no_pending_responses()


@pytest.mark.parametrize(
    "code,attempts", [("AccessDeniedException", 1), ("ThrottlingException", 2)]
)
def test_failure_stops_at_policy_limit(code, attempts):
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        for _ in range(attempts):
            stubber.add_client_error(
                "converse", code, service_message="secret input must not appear"
            )
        with pytest.raises(ModelFailure) as failure:
            BedrockAdapter(client, MODEL_ID, sleep=lambda seconds: None).propose(QUESTION)
        assert failure.value.attempts == attempts
        assert "secret" not in str(failure.value)
        stubber.assert_no_pending_responses()


def test_single_call_mode_does_not_retry_throttling():
    client = isolated_stub_client()
    with Stubber(client) as stubber:
        stubber.add_client_error("converse", "ThrottlingException")
        with pytest.raises(ModelFailure) as failure:
            BedrockAdapter(client, MODEL_ID, max_attempts=1).propose(QUESTION)
        assert failure.value.attempts == 1
        stubber.assert_no_pending_responses()


def test_transport_timeout_is_not_retried():
    class SlowClient:
        calls = 0

        def converse(self, **kwargs):
            self.calls += 1
            raise ReadTimeoutError(endpoint_url="https://synthetic.invalid")

    client = SlowClient()
    with pytest.raises(ModelFailure, match="transport"):
        BedrockAdapter(client, MODEL_ID).propose(QUESTION)
    assert client.calls == 1
