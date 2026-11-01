import re
from dataclasses import dataclass

from .contracts import ToolArguments, ToolCall, ToolEvidence

POLICIES = {
    "demo-policy": (
        "Synthetic policy: review generated answers; never let a model authorize a payment."
    ),
    "restricted-demo": "Synthetic restricted policy. A demo learner cannot read this document.",
}


@dataclass(frozen=True)
class Principal:
    allowed_document_ids: frozenset[str]


DEMO_PRINCIPAL = Principal(allowed_document_ids=frozenset({"demo-policy"}))


class AuthorizationDenied(Exception):
    pass


def redact(text: str) -> str:
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[EMAIL]", text)
    return re.sub(r"(?i)\b(?:api_key|token|password)\s*[:=]\s*\S+", "[SECRET]", text)


def execute_tool(call: ToolCall, principal: Principal) -> ToolEvidence:
    # Authorization comes from the caller, never from model arguments or prompt text.
    if (
        call.name != "read_policy"
        or call.arguments.document_id not in principal.allowed_document_ids
    ):
        raise AuthorizationDenied("Tool request is outside the caller's scope")
    text = POLICIES.get(call.arguments.document_id)
    if text is None:
        raise AuthorizationDenied("Tool request is outside the caller's scope")
    return ToolEvidence(document_id=call.arguments.document_id, text=text)


def read_authorized_policy(document_id: str, principal: Principal) -> str:
    call = ToolCall(name="read_policy", arguments=ToolArguments(document_id=document_id))
    return execute_tool(call, principal).text
