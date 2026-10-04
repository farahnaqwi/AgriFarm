"""Market prices: an independent reference for when the buyer names a price.

Compares an offer with the median of the last 4 weeks across markets. It reports the gap;
it never tells the farmer to sell or not.
"""
from statistics import median
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..store import db

router = APIRouter(prefix="/prices", tags=["Market prices"])
Commodity = Literal["coffee_parchment", "maize"]
MIN_POINTS = 3


class Offer(BaseModel):
    commodity: Commodity
    offer_tzs_per_kg: float
    market: str | None = None


@router.get("")
def prices(commodity: Commodity = "coffee_parchment", market: str | None = None):
    return [p for p in db["prices"] if p["commodity"] == commodity and (market is None or p["market"] == market)]


@router.post("/check-offer")
def check_offer(offer: Offer):
    rows = prices(offer.commodity, offer.market)
    recent_dates = sorted({r["date"] for r in rows})[-4:]
    recent = [r["tzs_per_kg"] for r in rows if r["date"] in recent_dates]
    if len(recent) < MIN_POINTS:
        return {"status": "not_sure", "reason": "not enough recent prices to compare"}
    ref = median(recent)
    gap = (offer.offer_tzs_per_kg - ref) / ref
    pct = round(abs(gap) * 100)
    where = offer.market or "all markets"
    if abs(gap) < 0.05:
        en = f"The offer is close to the recent price at {where} (about {ref:,.0f} TZS/kg)."
        sw = f"Bei uliyopewa iko karibu na bei ya karibuni {where} (takriban TZS {ref:,.0f} kwa kilo)."
    elif gap < 0:
        en = f"The offer is about {pct}% below the recent price at {where} ({ref:,.0f} TZS/kg)."
        sw = f"Bei uliyopewa iko chini kwa takriban {pct}% ya bei ya karibuni {where} (TZS {ref:,.0f} kwa kilo)."
    else:
        en = f"The offer is about {pct}% above the recent price at {where} ({ref:,.0f} TZS/kg)."
        sw = f"Bei uliyopewa iko juu kwa takriban {pct}% ya bei ya karibuni {where} (TZS {ref:,.0f} kwa kilo)."
    return {"status": "ok", "reference_tzs_per_kg": ref, "gap_percent": round(gap * 100, 1),
            "based_on": {"points": len(recent), "from": recent_dates[0], "to": recent_dates[-1],
                         "source": "WFP-style market price series (dummy values)"},
            "message": {"en": en + " The decision to sell is yours.", "sw": sw + " Uamuzi wa kuuza ni wako."}}
