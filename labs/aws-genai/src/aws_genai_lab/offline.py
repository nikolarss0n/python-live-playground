import json

from .bedrock import ConverseClient

DEMO_PROPOSAL = {
    "draft": (
        "Review generated answers before using them. Confirm this against the policy evidence."
    ),
    "action": {"name": "read_policy", "arguments": {"document_id": "demo-policy"}},
}


def response_fixture(proposal: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [
                    {"text": json.dumps(DEMO_PROPOSAL if proposal is None else proposal)},
                ],
            }
        },
        "stopReason": "end_turn",
        "usage": {"inputTokens": 100, "outputTokens": 30, "totalTokens": 130},
        "metrics": {"latencyMs": 1},
    }


class OfflineClient:
    def converse(self, **kwargs: object) -> dict[str, object]:
        return response_fixture()


def isolated_stub_client() -> ConverseClient:
    """SDK-backed test client with no access to user profiles or credential providers."""
    import os

    from botocore.session import Session

    # Remove both ambient profile lookups for this session without changing the user's shell.
    session = Session(session_vars={"profile": (None, None, None, None)})
    session.set_config_variable("config_file", os.devnull)
    session.set_config_variable("credentials_file", os.devnull)
    session.set_credentials("FAKE_ACCESS_KEY", "FAKE_SECRET_KEY", "FAKE_SESSION_TOKEN")
    return session.create_client("bedrock-runtime", region_name="us-east-1")
