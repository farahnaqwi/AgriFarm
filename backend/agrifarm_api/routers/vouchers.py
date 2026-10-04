"""Subsidy e-vouchers: issued to registered farmers, redeemable once, only at verified dealers.

Issuing refuses ghost beneficiaries (no mapped plot) and farmers who have not consented to
programme sharing. Every refused redemption is logged as a flag for the delivery dashboard.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import PROGRAM_OFFICER, require_role
from ..store import db, next_id, plots_of
from .payments import propose

router = APIRouter(prefix="/vouchers", tags=["Subsidy e-vouchers"])


class IssueRequest(BaseModel):
    programme_id: str
    farmer_ids: list[str]
    item: str = "NPK fertilizer 50 kg"
    value_tzs: int = 60_000


class Redemption(BaseModel):
    code: str
    dealer_id: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/issue")
def issue(body: IssueRequest, officer: str = Depends(require_role(PROGRAM_OFFICER))):
    if body.programme_id not in db["programmes"]:
        raise HTTPException(404, "Programme not found")
    issued, refused = [], []
    for fid in body.farmer_ids:
        farmer = db["farmers"].get(fid)
        reason = (
            "not registered" if not farmer
            else "no consent to programme sharing" if not farmer["consent"]["share_with_programmes"]
            else "no mapped plot (possible ghost beneficiary)" if not plots_of(fid)
            else "already holds an unused voucher for this item" if any(
                v["farmer_id"] == fid and v["item"] == body.item and v["status"] == "issued"
                for v in db["vouchers"].values())
            else None
        )
        if reason:
            refused.append({"farmer_id": fid, "reason": reason})
            continue
        vid = next_id("V")
        db["vouchers"][vid] = {"voucher_id": vid, "farmer_id": fid, "programme_id": body.programme_id,
                               "item": body.item, "value_tzs": body.value_tzs,
                               "code": f"CSC-{secrets.randbelow(900000) + 100000}", "status": "issued",
                               "issued_at": _now(), "issued_by": officer, "redeemed_at": None, "dealer_id": None}
        issued.append(db["vouchers"][vid])
    return {"issued": issued, "refused": refused}


@router.post("/redeem")
def redeem(body: Redemption):
    """Called by the dealer's phone. On success the dealer's reimbursement is queued for approval."""
    voucher = next((v for v in db["vouchers"].values() if v["code"] == body.code), None)
    dealer = db["dealers"].get(body.dealer_id)
    reason = ("unknown voucher code" if not voucher
              else "unknown dealer" if not dealer
              else "dealer is not verified" if not dealer["verified"]
              else f"voucher already {voucher['status']}" if voucher["status"] != "issued"
              else None)
    if reason:
        db["voucher_flags"].append({"code": body.code, "dealer_id": body.dealer_id, "reason": reason, "at": _now()})
        raise HTTPException(409, f"Redemption refused: {reason}")
    voucher.update(status="redeemed", redeemed_at=_now(), dealer_id=dealer["dealer_id"])
    payout = propose("dealer_reimbursement", f"W-{dealer['dealer_id']}", voucher["value_tzs"],
                     f"{voucher['item']} for {voucher['farmer_id']}", {"voucher_id": voucher["voucher_id"]},
                     ref=f"reimburse:{voucher['voucher_id']}")
    return {"voucher": voucher, "reimbursement": payout}


@router.get("")
def list_vouchers(farmer_id: str | None = None, status: str | None = None):
    return [v for v in db["vouchers"].values()
            if (farmer_id is None or v["farmer_id"] == farmer_id) and (status is None or v["status"] == status)]


@router.get("/dealers")
def dealers():
    return list(db["dealers"].values())


@router.get("/flags")
def flags():
    return db["voucher_flags"]
