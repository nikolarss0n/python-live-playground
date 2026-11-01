from uuid import uuid4

from .bedrock import BedrockAdapter, ModelFailure
from .contracts import AuditEvent, LabResult, Question
from .controls import AuthorizationDenied, Principal, execute_tool, redact


class HarnessFailure(Exception):
    def __init__(self, message: str, audit: tuple[AuditEvent, ...]):
        super().__init__(message)
        self.audit = audit


def run_question(question: Question, model: BedrockAdapter, principal: Principal) -> LabResult:
    request_id = str(uuid4())
    try:
        generated = model.propose(question)
    except ModelFailure as error:
        event = AuditEvent(
            request_id=request_id,
            event="model",
            outcome="failed",
            attempts=error.attempts,
        )
        raise HarnessFailure("Model request or response was rejected", (event,)) from error
    events = [
        AuditEvent(
            request_id=request_id,
            event="model",
            outcome="accepted",
            attempts=generated.attempts,
            input_tokens=generated.input_tokens,
            output_tokens=generated.output_tokens,
        )
    ]
    evidence = None
    if generated.proposal.action is not None:
        try:
            evidence = execute_tool(generated.proposal.action, principal)
        except AuthorizationDenied as error:
            events.append(
                AuditEvent(
                    request_id=request_id,
                    event="tool",
                    outcome="denied",
                    attempts=0,
                )
            )
            raise HarnessFailure("Tool authorization denied", tuple(events)) from error
        events.append(
            AuditEvent(
                request_id=request_id,
                event="tool",
                outcome="allowed",
                attempts=0,
            )
        )
    return LabResult(draft=redact(generated.proposal.draft), evidence=evidence, audit=tuple(events))
