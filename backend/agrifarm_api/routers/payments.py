"""Mock mobile-money wallets and the payout queue.

Insurance payouts, disaster relief and dealer reimbursements are all created as *proposals*.
Nothing is paid until a programme officer approves it. Transfers are simulated (no real M-Pesa).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import PROGRAM_OFFICER, require_role
from ..store import db, next_id

router = APIRouter(tags=["Payments (mock)"])
FUND = "W-PROGRAMME"


def propose(kind: str, payee_wallet: str, amount_tzs: int, reason: str, evidence: dict, ref: str) -> dict:
    """Create a pending payout, or return the existing one for the same ref (idempotent)."""
    for p in db["payouts"].values():
        if p["ref"] == ref:
            return p
    pid = next_id("PAY")
    db["payouts"][pid] = {"payout_id": pid, "kind": kind, "payee_wallet": payee_wallet, "amount_tzs": amount_tzs,
                          "reason": reason, "evidence": evidence, "ref": ref, "status": "pending_approval",
                          "created_at": datetime.now(timezone.utc).isoformat()}
    return db["payouts"][pid]


def _transfer(src: str, dst: str, amount: int, memo: str) -> dict:
    if db["wallets"][src]["balance_tzs"] < amount:
        raise HTTPException(409, "Programme fund has insufficient balance")
    db["wallets"][src]["balance_tzs"] -= amount
    db["wallets"][dst]["balance_tzs"] += amount
    entry = {"tx_id": next_id("TX"), "from": src, "to": dst, "amount_tzs": amount, "memo": memo,
             "at": datetime.now(timezone.utc).isoformat()}
    db["ledger"].append(entry)
    return entry


class Decision(BaseModel):
    note: str = ""


@router.get("/payouts")
def list_payouts(status: str | None = None, kind: str | None = None):
    return [p for p in db["payouts"].values()
            if (status is None or p["status"] == status) and (kind is None or p["kind"] == kind)]


@router.post("/payouts/{payout_id}/approve")
def approve(payout_id: str, body: Decision, officer: str = Depends(require_role(PROGRAM_OFFICER))):
    p = db["payouts"].get(payout_id)
    if not p:
        raise HTTPException(404, "Payout not found")
    if p["status"] != "pending_approval":
        raise HTTPException(409, f"Payout is already {p['status']}")
    tx = _transfer(FUND, p["payee_wallet"], p["amount_tzs"], f"{p['kind']} {p['ref']}")
    p.update(status="paid", decided_by=officer, decision_note=body.note, tx_id=tx["tx_id"])
    return p


@router.post("/payouts/{payout_id}/reject")
def reject(payout_id: str, body: Decision, officer: str = Depends(require_role(PROGRAM_OFFICER))):
    p = db["payouts"].get(payout_id)
    if not p:
        raise HTTPException(404, "Payout not found")
    if p["status"] != "pending_approval":
        raise HTTPException(409, f"Payout is already {p['status']}")
    p.update(status="rejected", decided_by=officer, decision_note=body.note)
    return p


@router.get("/wallets/{wallet_id}")
def wallet(wallet_id: str):
    w = db["wallets"].get(wallet_id)
    if not w:
        raise HTTPException(404, "Wallet not found")
    return {**w, "transactions": [t for t in db["ledger"] if wallet_id in (t["from"], t["to"])]}
