"""Parametric (index) insurance: payouts triggered by seasonal rainfall, no claim forms.

The index is ward rainfall for Nov-Apr vs normal. Below the trigger ratio the payout scales
linearly to 100% at the exit ratio. Payouts are proposals; a programme officer approves them.
Basis risk is real: the ward index can miss a farmer whose own field was hit (or wasn't).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import PROGRAM_OFFICER, require_role
from ..seed import season_of
from ..store import db
from .payments import propose

router = APIRouter(prefix="/insurance", tags=["Parametric insurance"])
SEASON_MONTHS = ("11", "12", "01", "02", "03", "04")


class Evaluation(BaseModel):
    season: str = "2024/25"


def season_rain(ward: str, season: str) -> dict | None:
    rows = [r for r in db["rain"][ward] if season_of(r["month"]) == season and r["month"][5:] in SEASON_MONTHS]
    if len(rows) < len(SEASON_MONTHS):
        return None
    total, normal = sum(r["mm"] for r in rows), sum(r["normal_mm"] for r in rows)
    return {"ward": ward, "season": season, "rain_mm": round(total), "normal_mm": normal,
            "ratio": round(total / normal, 2), "source": "CHIRPS (dummy values)"}


def payout_fraction(ratio: float, trigger: float, exit_: float) -> float:
    if ratio >= trigger:
        return 0.0
    return min(1.0, (trigger - ratio) / (trigger - exit_))


@router.get("/policies")
def policies(farmer_id: str | None = None):
    return [p for p in db["policies"].values() if farmer_id is None or p["farmer_id"] == farmer_id]


@router.get("/index/{ward}")
def index(ward: str, season: str = "2024/25"):
    if ward not in db["rain"]:
        raise HTTPException(404, "Unknown ward")
    result = season_rain(ward, season)
    if not result:
        raise HTTPException(404, "Season incomplete or not in data")
    return result


@router.post("/evaluate")
def evaluate(body: Evaluation, officer: str = Depends(require_role(PROGRAM_OFFICER))):
    """Run the index for every policy in the season. Creates payout proposals; pays nothing."""
    triggered, not_triggered, not_sure = [], [], []
    for pol in db["policies"].values():
        if pol["season"] != body.season:
            continue
        idx = season_rain(pol["ward"], body.season)
        if not idx:
            not_sure.append({"policy_id": pol["policy_id"], "reason": "rainfall data incomplete"})
            continue
        frac = payout_fraction(idx["ratio"], pol["trigger_ratio"], pol["exit_ratio"])
        if frac == 0:
            not_triggered.append({"policy_id": pol["policy_id"], "ward": pol["ward"], "ratio": idx["ratio"]})
            continue
        farmer = db["farmers"][pol["farmer_id"]]
        payout = propose("insurance", farmer["wallet_id"], round(pol["sum_insured_tzs"] * frac),
                         f"Rainfall index {idx['ratio']:.0%} of normal in {pol['ward']}, {body.season}",
                         {**idx, "payout_fraction": round(frac, 2)}, ref=f"ins:{pol['policy_id']}:{body.season}")
        triggered.append(payout)
    return {"season": body.season, "evaluated_by": officer, "triggered": triggered,
            "not_triggered": not_triggered, "not_sure": not_sure,
            "caveat": "Ward-level index: a farmer can be hit when the index is not (basis risk). "
                      "Disputes go to the programme officer."}
