"""Satellite crop alerts from monthly Sentinel-2 NDVI (dummy series) and rainfall.

An alert compares a plot's NDVI with the same month in earlier years. A drop is only called
"water stress" when rainfall agrees; a drop with normal rain is sent to the extension officer
because it could be pests or disease. Cloudy images produce "not sure", never a guess.
"""
from fastapi import APIRouter, HTTPException

from ..seed import CURRENT_MONTH
from ..store import db

router = APIRouter(prefix="/alerts", tags=["Satellite crop alerts"])

DROP_RATIO = 0.80      # NDVI below 80% of its usual value for this month
DRY_RAIN_RATIO = 0.70  # rain below 70% of normal
WET_MONTH_MM = 30      # below this normal, it's dry season and rain can't be compared
CROP_SW = {"coffee": "kahawa", "maize": "mahindi", "beans": "maharage"}

MESSAGES = {
    "water_stress": {
        "en": "Your {crop} field looks drier than usual for {month}. If you can, water or mulch it within 3 days.",
        "sw": "Shamba lako la {crop} linaonekana kukauka kuliko kawaida kwa {month}. Ukiweza, mwagilia au weka matandazo ndani ya siku 3."},
    "vegetation_drop": {
        "en": "Your {crop} field looks weaker than usual, but rain was normal. It could be pests or disease: please show it to the extension officer.",
        "sw": "Shamba lako la {crop} linaonekana dhaifu kuliko kawaida, lakini mvua ilikuwa ya kawaida. Huenda ni wadudu au ugonjwa: tafadhali mwonyeshe afisa ugani."},
    "not_sure": {
        "en": "The satellite could not see your field clearly this month (clouds). No alert; we will check again.",
        "sw": "Satelaiti haikuweza kuona shamba lako vizuri mwezi huu (mawingu). Hakuna tahadhari; tutaangalia tena."},
}


def evaluate(plot: dict, month: str = CURRENT_MONTH) -> dict:
    series = {r["month"]: r for r in db["ndvi"].get(plot["plot_id"], [])}
    now = series.get(month)
    base = [r["ndvi"] for m, r in series.items() if m[5:] == month[5:] and m < month and not r["cloudy"]]
    out = {"plot_id": plot["plot_id"], "farmer_id": plot["farmer_id"], "crop": plot["crop"], "month": month}
    if not now or not base:
        return {**out, "alert": None, "status": "not_sure", "reason": "no satellite history for this plot yet"}
    if now["cloudy"]:
        return {**out, "alert": None, "status": "not_sure", "reason": "cloudy image"}

    ward = db["farmers"][plot["farmer_id"]]["ward"]
    rain = next(r for r in db["rain"][ward] if r["month"] == month)
    ndvi_ratio = now["ndvi"] / (sum(base) / len(base))
    evidence = {"ndvi": now["ndvi"], "ndvi_usual": round(sum(base) / len(base), 3), "ndvi_ratio": round(ndvi_ratio, 2),
                "rain_mm": rain["mm"], "rain_normal_mm": rain["normal_mm"],
                "sources": "Sentinel-2 NDVI + CHIRPS rainfall (dummy values)"}
    if ndvi_ratio >= DROP_RATIO:
        return {**out, "alert": None, "status": "ok", "evidence": evidence}
    if rain["normal_mm"] < WET_MONTH_MM:
        kind, confidence = "water_stress", "medium (dry season; rain comparison not possible)"
    elif rain["mm"] / rain["normal_mm"] < DRY_RAIN_RATIO:
        kind, confidence = "water_stress", "high (satellite and rainfall agree)"
    else:
        kind, confidence = "vegetation_drop", "low: cause unknown, needs a person"
    return {**out, "alert": kind, "status": "alert", "confidence": confidence, "evidence": evidence,
            "message": {"en": MESSAGES[kind]["en"].format(crop=plot["crop"], month=month),
                        "sw": MESSAGES[kind]["sw"].format(crop=CROP_SW.get(plot["crop"], plot["crop"]), month=month)}}


@router.get("")
def all_alerts(ward: str | None = None, month: str = CURRENT_MONTH, only_alerts: bool = True):
    results = [evaluate(p, month) for p in db["plots"].values()
               if ward is None or db["farmers"][p["farmer_id"]]["ward"] == ward]
    return [r for r in results if r["status"] != "ok"] if only_alerts else results


@router.get("/plots/{plot_id}")
def plot_alert(plot_id: str, month: str = CURRENT_MONTH):
    plot = db["plots"].get(plot_id)
    if not plot:
        raise HTTPException(404, "Plot not found")
    result = evaluate(plot, month)
    if result["status"] == "not_sure":
        result["message"] = MESSAGES["not_sure"]
    return result
