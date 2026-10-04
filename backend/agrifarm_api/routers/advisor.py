"""Voice advisor. Speech-to-text runs on the phone (MMS/Whisper); this receives the transcript.

The advisor only ever returns an answer from the fixed list in knowledge_base.py. When the
match is weak or ambiguous it says "not sure" and opens an escalation for an extension officer.
"""
import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import EXTENSION_OFFICER, require_role
from ..knowledge_base import ENTRIES, NOT_SURE, REVIEW_STATUS
from ..store import db, next_id

router = APIRouter(prefix="/advisor", tags=["Voice advisor"])

MIN_HITS = 2  # at least two distinct matching terms
MIN_MARGIN = 1  # and clearly ahead of the runner-up


class Question(BaseModel):
    text: str
    language: Literal["sw", "en"] = "sw"
    farmer_id: str | None = None


class OfficerAnswer(BaseModel):
    answer: str


def match(text: str) -> tuple[dict | None, int, list[str]]:
    words = set(re.findall(r"[a-zà-ÿ']+", text.lower()))
    scored = sorted(((sorted(words & set(e["keywords"])), e) for e in ENTRIES), key=lambda s: -len(s[0]))
    (best_terms, best), (second_terms, _) = scored[0], scored[1]
    if len(best_terms) >= MIN_HITS and len(best_terms) - len(second_terms) >= MIN_MARGIN:
        return best, len(best_terms), best_terms
    return None, len(best_terms), best_terms


@router.post("/ask")
def ask(q: Question):
    entry, hits, terms = match(q.text)
    if entry:
        return {"status": "answered", "answer_id": entry["id"], "answer": entry[q.language],
                "confidence": "high" if hits >= 3 else "medium", "matched_terms": terms,
                "review_status": REVIEW_STATUS,
                "note": "Advice only. Check with the extension officer before spending money."}
    esc_id = next_id("ESC")
    db["escalations"][esc_id] = {"escalation_id": esc_id, "farmer_id": q.farmer_id, "question": q.text,
                                 "language": q.language, "status": "open",
                                 "asked_at": datetime.now(timezone.utc).isoformat(), "answer": None}
    return {"status": "not_sure", "answer": NOT_SURE[q.language], "escalation_id": esc_id}


@router.get("/escalations")
def escalations(status: str = "open", _: str = Depends(require_role(EXTENSION_OFFICER))):
    return [e for e in db["escalations"].values() if e["status"] == status]


@router.post("/escalations/{escalation_id}/answer")
def answer(escalation_id: str, body: OfficerAnswer, officer: str = Depends(require_role(EXTENSION_OFFICER))):
    esc = db["escalations"].get(escalation_id)
    if not esc:
        raise HTTPException(404, "Escalation not found")
    esc.update(status="answered", answer=body.answer, answered_by=officer)
    return esc


@router.get("/escalations/{escalation_id}")
def escalation_status(escalation_id: str):
    """The farmer's phone polls this when it has signal, then plays the officer's answer."""
    esc = db["escalations"].get(escalation_id)
    if not esc:
        raise HTTPException(404, "Escalation not found")
    return {k: esc[k] for k in ("escalation_id", "status", "answer")}
