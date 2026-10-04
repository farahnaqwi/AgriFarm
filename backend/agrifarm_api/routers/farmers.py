"""Digital farmer ID: registration (voice + photo + walked boundary), plots, consent."""
import secrets
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import geo
from ..seed import DISTRICT, WARDS
from ..store import db, farmer_or_404, next_id, plots_of

router = APIRouter(prefix="/farmers", tags=["Farmer registry"])


class Consent(BaseModel):
    registry: bool = Field(description="Farmer agreed to be registered. Required.")
    share_with_programmes: bool = Field(False, description="Programmes and institutions may see her pseudonymous record.")


class NewPlot(BaseModel):
    crop: Literal["coffee", "maize", "beans", "other"]
    geometry: dict = Field(description="GeoJSON Polygon from walking the boundary")
    claimed_area_ha: float | None = None


class NewFarmer(BaseModel):
    display_name: str | None = None
    language: Literal["sw", "en"] = "sw"
    ward: str
    cooperative: str | None = None
    consent: Consent
    plot: NewPlot | None = None


def _add_plot(farmer_id: str, plot: NewPlot) -> dict:
    if plot.geometry.get("type") != "Polygon":
        raise HTTPException(422, "geometry must be a GeoJSON Polygon")
    pid = next_id("PL")
    row = {"plot_id": pid, "farmer_id": farmer_id, "crop": plot.crop, "geometry": plot.geometry,
           "area_ha": round(geo.area_ha(plot.geometry), 2), "claimed_area_ha": plot.claimed_area_ha,
           "boundary_method": "walked"}
    db["plots"][pid] = row
    db["ndvi"][pid] = []  # filled by the satellite precompute job
    return row


@router.post("", status_code=201)
def register(body: NewFarmer):
    if not body.consent.registry:
        raise HTTPException(400, "Registration needs the farmer's consent.")
    if body.ward not in WARDS:
        raise HTTPException(422, f"Unknown ward. Known: {', '.join(WARDS)}")
    fid = f"F-{secrets.token_hex(3).upper()}"  # pseudonymous: no phone number or national ID
    farmer = {"farmer_id": fid, "display_name": body.display_name, "language": body.language,
              "district": DISTRICT, "ward": body.ward, "cooperative": body.cooperative,
              "wallet_id": f"W-{fid}", "registered_by": "voice+photo+walked boundary",
              "consent": body.consent.model_dump(), "programmes": []}
    db["farmers"][fid] = farmer
    db["wallets"][farmer["wallet_id"]] = {"wallet_id": farmer["wallet_id"], "owner": fid,
                                         "provider": "M-Pesa (mock)", "balance_tzs": 0}
    plot = _add_plot(fid, body.plot) if body.plot else None
    return {"farmer": farmer, "plot": plot}


@router.get("/{farmer_id}")
def get_farmer(farmer_id: str):
    return {**farmer_or_404(farmer_id), "plots": plots_of(farmer_id)}


@router.post("/{farmer_id}/plots", status_code=201)
def add_plot(farmer_id: str, body: NewPlot):
    farmer_or_404(farmer_id)
    return _add_plot(farmer_id, body)


@router.put("/{farmer_id}/consent")
def update_consent(farmer_id: str, body: Consent):
    farmer = farmer_or_404(farmer_id)
    farmer["consent"] = body.model_dump()
    return farmer


@router.delete("/{farmer_id}")
def withdraw(farmer_id: str):
    """Farmer withdraws: personal details and plot shapes are erased; payment history stays for audit."""
    farmer = farmer_or_404(farmer_id)
    for p in plots_of(farmer_id):
        db["plots"].pop(p["plot_id"])
        db["ndvi"].pop(p["plot_id"], None)
    farmer.update(display_name=None, cooperative=None, withdrawn=True,
                  consent={"registry": False, "share_with_programmes": False})
    return {"farmer_id": farmer_id, "status": "withdrawn"}
