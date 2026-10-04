"""Run from backend/:  .venv\\Scripts\\python -m pytest -q
Covers the dummy-data platform. Supabase report endpoints are not exercised (live data)."""
import pytest
from fastapi.testclient import TestClient

from agrifarm_api import store
from agrifarm_api.main import app

OFFICER = {"X-Role": "program_officer", "X-User": "officer-1"}
EXTENSION = {"X-Role": "extension_officer"}
c = TestClient(app)
SQUARE = {"type": "Polygon", "coordinates": [[[32.930, -9.100], [32.931, -9.100], [32.931, -9.099],
                                              [32.930, -9.099], [32.930, -9.100]]]}


@pytest.fixture(autouse=True)
def fresh_data():
    store.reset()


def test_registration_needs_consent_and_measures_plot():
    body = {"ward": "Vwawa", "consent": {"registry": False}}
    assert c.post("/farmers", json=body).status_code == 400
    body["consent"]["registry"] = True
    body["plot"] = {"crop": "coffee", "geometry": SQUARE, "claimed_area_ha": 1.0}
    r = c.post("/farmers", json=body).json()
    assert r["farmer"]["farmer_id"].startswith("F-")
    assert r["plot"]["area_ha"] == pytest.approx(1.21, abs=0.05)  # ~110 m x 110 m


def test_withdrawal_erases_plots():
    c.delete("/farmers/F-MBZ001")
    f = c.get("/farmers/F-MBZ001").json()
    assert f["plots"] == [] and f["display_name"] is None


def test_advisor_answers_from_fixed_list_or_escalates():
    r = c.post("/advisor/ask", json={"text": "Majani ya kahawa yana madoa ya unga wa machungwa"}).json()
    assert r["status"] == "answered" and r["answer_id"] == "COFFEE_LEAF_RUST"
    r = c.post("/advisor/ask", json={"text": "my cow is sick", "language": "en"}).json()
    assert r["status"] == "not_sure"
    assert c.get("/advisor/escalations").status_code == 403
    esc = c.post(f"/advisor/escalations/{r['escalation_id']}/answer", json={"answer": "Call the vet."},
                 headers=EXTENSION).json()
    assert esc["status"] == "answered"


def test_alerts_cover_stress_pests_and_clouds():
    assert c.get("/alerts/plots/PL-012").json()["alert"] == "water_stress"
    assert c.get("/alerts/plots/PL-012", params={"month": "2025-02"}).json()["confidence"].startswith("high")
    assert c.get("/alerts/plots/PL-004", params={"month": "2026-02"}).json()["alert"] == "vegetation_drop"
    assert c.get("/alerts/plots/PL-002").json()["status"] == "not_sure"


def test_insurance_triggers_only_drought_wards_and_waits_for_approval():
    r = c.post("/insurance/evaluate", json={"season": "2024/25"}, headers=OFFICER).json()
    assert {p["payee_wallet"] for p in r["triggered"]} == {"W-F-MBZ009", "W-F-MBZ010"}
    assert all(p["status"] == "pending_approval" for p in r["triggered"])
    again = c.post("/insurance/evaluate", json={"season": "2024/25"}, headers=OFFICER).json()
    assert [p["payout_id"] for p in again["triggered"]] == [p["payout_id"] for p in r["triggered"]]  # idempotent


def test_payout_needs_officer_then_moves_money():
    pid = c.post("/insurance/evaluate", json={}, headers=OFFICER).json()["triggered"][0]["payout_id"]
    assert c.post(f"/payouts/{pid}/approve", json={}).status_code == 403
    paid = c.post(f"/payouts/{pid}/approve", json={}, headers=OFFICER).json()
    assert paid["status"] == "paid"
    assert c.get(f"/wallets/{paid['payee_wallet']}").json()["balance_tzs"] == paid["amount_tzs"]
    assert c.post(f"/payouts/{pid}/approve", json={}, headers=OFFICER).status_code == 409


def test_vouchers_block_ghosts_and_unverified_dealers():
    r = c.post("/vouchers/issue", headers=OFFICER, json={
        "programme_id": "P-CSC-DEMO", "farmer_ids": ["F-MBZ010", "F-MBZ011", "F-MBZ012"]}).json()
    assert [v["farmer_id"] for v in r["issued"]] == ["F-MBZ010"]
    assert {x["farmer_id"] for x in r["refused"]} == {"F-MBZ011", "F-MBZ012"}
    code = r["issued"][0]["code"]
    assert c.post("/vouchers/redeem", json={"code": code, "dealer_id": "D-03"}).status_code == 409
    ok = c.post("/vouchers/redeem", json={"code": code, "dealer_id": "D-01"}).json()
    assert ok["reimbursement"]["status"] == "pending_approval"
    assert c.post("/vouchers/redeem", json={"code": code, "dealer_id": "D-01"}).status_code == 409
    assert len(c.get("/vouchers/flags").json()) == 2


def test_price_check_reports_gap_without_advising():
    r = c.post("/prices/check-offer", json={"commodity": "coffee_parchment", "offer_tzs_per_kg": 5800}).json()
    assert r["gap_percent"] < -10 and "decision" in r["message"]["en"]


def test_institution_views_hide_non_consenting_farmers():
    ids = {f["properties"]["farmer_id"] for f in c.get("/institution/registry.geojson").json()["features"]}
    assert "F-MBZ011" not in ids and "F-MBZ001" in ids
    t = c.get("/institution/targeting", params={"max_ha": 2, "drought_season": "2024/25"}).json()
    assert {f["farmer_id"] for f in t["farmers"]} == {"F-MBZ009", "F-MBZ010"}
    assert all("display_name" not in f for f in t["farmers"])


def test_impact_climate_delivery_and_disaster():
    assert c.get("/institution/impact").json()["difference_in_differences"] > 0
    assert c.get("/institution/climate").json()["water_saved"] is None
    assert c.get("/institution/delivery").json()["ghost_risk"][0]["farmer_id"] == "F-MBZ012"
    affected = c.get("/institution/disasters/E-FLOOD-2026-03/affected").json()
    assert {f["ward"] for f in affected["farmers"]} == {"Mlowo"}
    r = c.post("/institution/disasters/E-FLOOD-2026-03/propose-relief", json={}, headers=OFFICER).json()
    assert len(r["proposals"]) == len(affected["farmers"])
