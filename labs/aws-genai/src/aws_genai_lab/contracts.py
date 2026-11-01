from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class Question(StrictModel):
    text: str = Field(min_length=1, max_length=512)

    @field_validator("text")
    @classmethod
    def useful_text(cls, value: str) -> str:
        text = value.strip()
        if not text or len(text.encode("utf-8")) > 512:
            raise ValueError("Use 1 to 512 UTF-8 bytes of question text")
        return text


class ToolArguments(StrictModel):
    document_id: str = Field(min_length=1, max_length=80)


class ToolCall(StrictModel):
    name: Literal["read_policy"]
    arguments: ToolArguments


class Proposal(StrictModel):
    draft: str = Field(min_length=1, max_length=600)
    action: ToolCall | None


class ToolEvidence(StrictModel):
    document_id: str
    text: str
    source: Literal["synthetic-fixture"] = "synthetic-fixture"


class AuditEvent(StrictModel):
    request_id: str
    event: Literal["model", "tool", "validation"]
    outcome: Literal["accepted", "rejected", "allowed", "denied", "failed"]
    attempts: int = Field(ge=0, le=2)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)


class LabResult(StrictModel):
    draft: str
    evidence: ToolEvidence | None
    audit: tuple[AuditEvent, ...]
