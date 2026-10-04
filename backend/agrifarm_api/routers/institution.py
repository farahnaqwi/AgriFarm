"""Institution side (World Bank, government, NGOs): registry map, targeting, delivery
tracking, impact, climate reporting and disaster response.

Institutions only see pseudonymous farmers who consented to programme sharing; names are
never returned. Farmers without consent are counted, not listed.
"""
from collections import Counter
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import geo
from ..auth import PROGRAM_OFFICER, require_role
from ..seed import season_of
from ..store import db, plots_of
from .alerts import evaluate as alert_for
from .insurance import season_rain
from .payments import propose

router = APIRouter(prefix="/institution", tags=["Institution dashboard"])
DROUGHT_RATIO = 0.75


def _visible(fid: str) -> bool:
    f = db["farmers"][fid]
    return f["consent"]["share_with_programmes"] and not f.get("withdrawn")


def _public(fid: str) -> dict:
    f = db["farmers"][fid]
    plots = plots_of(fid)
    return {"farmer_id": fid, "ward": f["ward"], "cooperative": f["cooperative"], "programmes": f["programmes"],
            "crops": sorted({p["crop"] for p in plots}), "total_ha": round(sum(p["area_ha"] for p in plots), 2)}


def _hidden_count(fids) -> int:
    return sum(1 for fid in fids if not _visible(fid))


@router.get("/registry.geojson")
def registry(ward: str | None = None, crop: str | None = None):
    features = [
        {"type": "Feature", "geometry": p["geometry"],
         "properties": {"plot_id": p["plot_id"], "farmer_id": p["farmer_id"], "crop": p["crop"],
                        "area_ha": p["area_ha"], "ward": db["farmers"][p["farmer_id"]]["ward"]}}
        for p in db["plots"].values()
        if _visible(p["farmer_id"]) and (ward is None or db["farmers"][p["farmer_id"]]["ward"] == ward)
        and (crop is None or p["crop"] == crop)
    ]
    return {"type": "FeatureCollection", "features": features}


@router.get("/targeting")
def targeting(ward: str | None = None, crop: str | None = None, max_ha: float | None = None,
              drought_season: str | None = None, with_alert: bool = False, not_in_programme: str | None = None):
    """e.g. smallholders under 2 ha, in wards where the 2024/25 season was a drought."""
    picked = []
    for fid, f in db["farmers"].items():
        plots = plots_of(fid)
        if not plots or not _visible(fid):
            continue
        reasons = []
        if ward and f["ward"] != ward:
            continue
        if crop and crop not in {p["crop"] for p in plots}:
            continue
        total = sum(p["area_ha"] for p in plots)
        if max_ha is not None:
            if total > max_ha:
                continue
            reasons.append(f"farms {total:.1f} ha")
        if drought_season:
            idx = season_rain(f["ward"], drought_season)
            if not idx or idx["ratio"] >= DROUGHT_RATIO:
                continue
            reasons.append(f"{drought_season} rain {idx['ratio']:.0%} of normal")
        if with_alert:
            alerts = [a for a in (alert_for(p) for p in plots) if a["status"] == "alert"]
            if not alerts:
                continue
            reasons.append(", ".join(a["alert"] for a in alerts))
        if not_in_programme and not_in_programme in f["programmes"]:
            continue
        picked.append({**_public(fid), "why": reasons})
    return {"count": len(picked), "farmers": picked,
            "note": "A shortlist for a person to review, not an eligibility decision."}


@router.get("/delivery")
def delivery():
    vouchers = list(db["vouchers"].values())
    redeemed = [v for v in vouchers if v["status"] == "redeemed"]
    payouts = list(db["payouts"].values())
    return {
        "vouchers": {"issued": len(vouchers), "redeemed": len(redeemed),
                     "redemption_rate": round(len(redeemed) / len(vouchers), 2) if vouchers else None,
                     "value_redeemed_tzs": sum(v["value_tzs"] for v in redeemed),
                     "by_dealer": Counter(v["dealer_id"] for v in redeemed),
                     "refused_redemptions": db["voucher_flags"]},
        "payouts": {status: {"count": sum(1 for p in payouts if p["status"] == status),
                             "tzs": sum(p["amount_tzs"] for p in payouts if p["status"] == status)}
                    for status in ("pending_approval", "paid", "rejected")},
        "ghost_risk": [{"farmer_id": fid, "reason": "registered but no mapped plot"}
                       for fid in db["farmers"] if not plots_of(fid) and not db["farmers"][fid].get("withdrawn")],
    }


def _season_ndvi(plot_id: str, season: str) -> float | None:
    vals = [r["ndvi"] for r in db["ndvi"].get(plot_id, [])
            if season_of(r["month"]) == season and r["month"][5:] in ("11", "12", "01", "02", "03", "04")
            and not r["cloudy"]]
    return mean(vals) if vals else None


@router.get("/impact")
def impact(programme_id: str = "P-CSC-DEMO", baseline: str = "2023/24", followup: str = "2025/26",
           crop: str = "coffee"):
    """Difference-in-differences of rainy-season NDVI, programme vs non-programme plots."""
    groups = {"programme": [], "comparison": []}
    for p in db["plots"].values():
        if p["crop"] != crop:
            continue
        before, after = _season_ndvi(p["plot_id"], baseline), _season_ndvi(p["plot_id"], followup)
        if before is None or after is None:
            continue
        key = "programme" if programme_id in db["farmers"][p["farmer_id"]]["programmes"] else "comparison"
        groups[key].append(after - before)
    summary = {k: {"plots": len(v), "mean_ndvi_change": round(mean(v), 3) if v else None} for k, v in groups.items()}
    did = (round(summary["programme"]["mean_ndvi_change"] - summary["comparison"]["mean_ndvi_change"], 3)
           if all(groups.values()) else None)
    return {"programme_id": programme_id, "crop": crop, "baseline": baseline, "followup": followup,
            "groups": summary, "difference_in_differences": did,
            "caveat": "Dummy data. Small samples and non-random enrolment: this is a signal to investigate, "
                      "not proof of impact. NDVI is a proxy for crop vigour, not yield."}


@router.get("/climate")
def climate(season: str = "2024/25"):
    wards = {}
    for ward in db["rain"]:
        idx = season_rain(ward, season)
        plots = [p for p in db["plots"].values() if db["farmers"][p["farmer_id"]]["ward"] == ward]
        wards[ward] = {"rain_ratio": idx["ratio"] if idx else None,
                       "drought": bool(idx and idx["ratio"] < DROUGHT_RATIO),
                       "registered_ha": round(sum(p["area_ha"] for p in plots), 1)}
    flood_ha = sum(p["area_ha"] for e in db["events"].values() for p in db["plots"].values()
                   if geo.contains(e["geometry"], *geo.centroid(p["geometry"])))
    programme_ha = sum(p["area_ha"] for p in db["plots"].values() if db["farmers"][p["farmer_id"]]["programmes"])
    return {
        "season": season, "wards": wards,
        "drought_affected_ha": round(sum(w["registered_ha"] for w in wards.values() if w["drought"]), 1),
        "flood_affected_ha": round(flood_ha, 1),
        "area_under_climate_smart_programme_ha": round(programme_ha, 1),
        "water_saved": None,
        "water_saved_note": "Not measured: needs irrigation meters or farmer-reported water use. Not estimated, to avoid an invented number.",
    }


@router.get("/disasters")
def disasters():
    return list(db["events"].values())


def _affected(event_id: str):
    event = db["events"].get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    hits = [p for p in db["plots"].values() if geo.contains(event["geometry"], *geo.centroid(p["geometry"]))]
    return event, sorted({p["farmer_id"] for p in hits}), hits


@router.get("/disasters/{event_id}/affected")
def affected(event_id: str):
    event, fids, hits = _affected(event_id)
    return {"event_id": event_id, "type": event["type"], "date": event["date"],
            "affected_ha": round(sum(p["area_ha"] for p in hits), 1),
            "farmers": [_public(f) for f in fids if _visible(f)],
            "not_listed_without_consent": _hidden_count(fids),
            "note": "Farmers without sharing consent are counted only; reach them through their cooperative."}


class Relief(BaseModel):
    amount_tzs_per_farmer: int = 100_000


@router.post("/disasters/{event_id}/propose-relief")
def propose_relief(event_id: str, body: Relief, officer: str = Depends(require_role(PROGRAM_OFFICER))):
    event, fids, _ = _affected(event_id)
    proposals = [propose("disaster_relief", db["farmers"][f]["wallet_id"], body.amount_tzs_per_farmer,
                         f"{event['type']} {event['date']}", {"event_id": event_id}, ref=f"relief:{event_id}:{f}")
                 for f in fids if _visible(f)]
    return {"proposed_by": officer, "proposals": proposals,
            "next_step": "Each proposal needs approval at POST /payouts/{id}/approve before money moves."}
