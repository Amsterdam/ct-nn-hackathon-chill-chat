import json
import os
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.llm import generate
from src.prompts import (
    FREEZE_SYSTEM,
    FREEZE_USER_TEMPLATE,
    GENERATE_CHAT_BULLYING_RULES,
    GENERATE_CHAT_SYSTEM,
    GENERATE_CHAT_TEASING_RULES,
    GENERATE_CHAT_USER_TEMPLATE,
    MEDIATION_SYSTEM,
    MEDIATION_USER_TEMPLATE,
    REPORT_SYSTEM,
    REPORT_USER_TEMPLATE,
)

load_dotenv()

app = FastAPI(title="Chill AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    author: str
    text: str


class MediationRequest(BaseModel):
    messages: list[ChatMessage]
    flag_count: int


class MediationResponse(BaseModel):
    title: str
    body: str
    suggestion: str


class FreezeRequest(BaseModel):
    messages: list[ChatMessage]


class FreezeResponse(BaseModel):
    summary: str
    redirect_prompt: str


class GeneratedMessage(BaseModel):
    author: str
    text: str
    stage: Literal["neutral", "teasing", "mocking"]


class GenerateChatRequest(BaseModel):
    length: int = 14
    topic: str | None = None
    mode: Literal["teasing", "bullying"] = "bullying"


class GenerateChatResponse(BaseModel):
    target: str
    messages: list[GeneratedMessage]


class FreezeEvent(BaseModel):
    by: str
    at_message_count: int


class ReportRequest(BaseModel):
    messages: list[ChatMessage]
    target: str | None = None
    freeze_events: list[FreezeEvent]


class ReportResponse(BaseModel):
    summary: str
    key_messages: list[ChatMessage]
    freeze_summary: str
    talking_points: list[str]


def _format_messages(messages: list[ChatMessage]) -> str:
    return "\n".join(f"{m.author}: {m.text}" for m in messages)


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].lstrip("json").strip()
    return json.loads(raw)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/mediation", response_model=MediationResponse)
def mediation(req: MediationRequest):
    user = MEDIATION_USER_TEMPLATE.format(
        messages=_format_messages(req.messages),
        flag_count=req.flag_count,
    )
    raw = generate(MEDIATION_SYSTEM, user, max_tokens=300, force_json=True)
    try:
        return MediationResponse(**_parse_json(raw))
    except Exception as e:
        raise HTTPException(500, f"LLM returned malformed response: {e}\nraw: {raw}")


@app.post("/api/freeze", response_model=FreezeResponse)
def freeze(req: FreezeRequest):
    user = FREEZE_USER_TEMPLATE.format(messages=_format_messages(req.messages))
    raw = generate(FREEZE_SYSTEM, user, max_tokens=400, force_json=True)
    try:
        return FreezeResponse(**_parse_json(raw))
    except Exception as e:
        raise HTTPException(500, f"LLM returned malformed response: {e}\nraw: {raw}")


@app.post("/api/report", response_model=ReportResponse)
def report(req: ReportRequest):
    if not req.freeze_events:
        freeze_events_str = "(geen bevries-momenten)"
    else:
        freeze_events_str = "\n".join(
            f"- {ev.by} drukte na bericht #{ev.at_message_count}"
            for ev in req.freeze_events
        )
    user = REPORT_USER_TEMPLATE.format(
        messages=_format_messages(req.messages),
        target=req.target or "geen",
        freeze_events_str=freeze_events_str,
    )
    raw = generate(REPORT_SYSTEM, user, max_tokens=900, force_json=True)
    try:
        return ReportResponse(**_parse_json(raw))
    except Exception as e:
        raise HTTPException(500, f"LLM returned malformed response: {e}\nraw: {raw}")


@app.post("/api/generate_chat", response_model=GenerateChatResponse)
def generate_chat(req: GenerateChatRequest):
    topic_line = f"\nOnderwerp/aanleiding: {req.topic}" if req.topic else ""
    mode_rules = GENERATE_CHAT_TEASING_RULES if req.mode == "teasing" else GENERATE_CHAT_BULLYING_RULES
    user = GENERATE_CHAT_USER_TEMPLATE.format(
        length=req.length,
        topic_line=topic_line,
        mode_rules=mode_rules,
    )
    raw = generate(GENERATE_CHAT_SYSTEM, user, max_tokens=2000, force_json=True)
    try:
        return GenerateChatResponse(**_parse_json(raw))
    except Exception as e:
        raise HTTPException(500, f"LLM returned malformed response: {e}\nraw: {raw}")
