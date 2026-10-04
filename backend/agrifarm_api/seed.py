"""Dummy data for the demo. Every value here is invented (provenance: mock).

Mbozi district, Songwe, Tanzania. Scenarios built in on purpose:
- 2024/25 rainy season drought in Isansa and Igamba (insurance trigger, targeting)
- dry spell stressing coffee in Igamba in Aug-Sep 2026 (satellite alert)
- pest-like NDVI drop on PL-004 in Feb 2026 with normal rain (alert says "ask a person")
- flood in Mlowo, March 2026 (disaster response)
- F-MBZ011 has not consented to programme sharing (hidden from institutions)
- F-MBZ012 is registered with no plot (ghost-beneficiary risk)
- D-03 is an unverified dealer (voucher redemption is refused)
"""
import math
import random
from datetime import date, timedelta

from . import geo

DISTRICT = "Mbozi"
CURRENT_MONTH = "2026-09"
WARDS = {  # approximate ward centres (lon, lat); dummy
    "Vwawa": (32.93, -9.10), "Mlowo": (32.96, -9.06), "Iyula": (32.83, -9.03),
    "Isansa": (32.86, -9.18), "Igamba": (32.99, -9.24),
}
DROUGHT_WARDS_2024_25 = {"Isansa", "Igamba"}
# Monthly rainfall normals (mm), unimodal Nov-Apr season. Dummy climatology.
RAIN_NORMAL = {1: 220, 2: 200, 3: 210, 4: 110, 5: 20, 6: 0, 7: 0, 8: 0, 9: 5, 10: 25, 11: 90, 12: 200}

FARMERS = [  # id, name, ward, cooperative, language, shares with programmes
    ("F-MBZ001", "Noor", "Vwawa", "Ondera Coffee Cooperative", "sw", True),
    ("F-MBZ002", "Juma", "Vwawa", "Ondera Coffee Cooperative", "sw", True),
    ("F-MBZ003", "Rehema", "Vwawa", None, "sw", True),
    ("F-MBZ004", "Baraka", "Mlowo", "Mlowo AMCOS", "sw", True),
    ("F-MBZ005", "Upendo", "Mlowo", "Mlowo AMCOS", "sw", True),
    ("F-MBZ006", "Hamisi", "Mlowo", None, "en", True),
    ("F-MBZ007", "Zawadi", "Iyula", "Iyula Growers", "sw", True),
    ("F-MBZ008", "Elias", "Iyula", None, "sw", True),
    ("F-MBZ009", "Mwanaisha", "Isansa", "Isansa AMCOS", "sw", True),
    ("F-MBZ010", "Daudi", "Igamba", "Igamba AMCOS", "sw", True),
    ("F-MBZ011", "Faraja", "Igamba", None, "sw", False),
    ("F-MBZ012", "Tumaini", "Igamba", None, "sw", True),
]
PLOTS = [  # farmer, crop, measured ha, claimed ha
    ("F-MBZ001", "coffee", 1.2, 1.0), ("F-MBZ001", "maize", 0.8, 1.0),
    ("F-MBZ002", "coffee", 0.6, 0.5), ("F-MBZ003", "maize", 1.5, 1.5),
    ("F-MBZ004", "maize", 2.0, 2.0), ("F-MBZ005", "coffee", 0.9, 1.0),
    ("F-MBZ006", "beans", 0.5, 0.5), ("F-MBZ007", "coffee", 1.8, 2.0),
    ("F-MBZ008", "maize", 3.5, 3.0), ("F-MBZ009", "coffee", 1.1, 1.0),
    ("F-MBZ009", "maize", 0.7, 0.5), ("F-MBZ010", "coffee", 1.4, 1.5),
    ("F-MBZ011", "maize", 1.0, 1.0), ("F-MBZ004", "coffee", 0.7, 0.5), ("F-MBZ008", "coffee", 1.0, 1.0),
]
PROGRAMME_ID = "P-CSC-DEMO"
PROGRAMME_FARMERS = {"F-MBZ001", "F-MBZ002", "F-MBZ003", "F-MBZ005", "F-MBZ007", "F-MBZ009"}


def months(start=(2023, 1), end=(2026, 9)):
    y, m = start
    while (y, m) <= end:
        yield f"{y:04d}-{m:02d}"
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def season_of(month: str) -> str:
    """Rainy season label: Nov 2024 - Apr 2025 is '2024/25'."""
    y, m = map(int, month.split("-"))
    start = y if m >= 11 else y - 1
    return f"{start}/{str(start + 1)[2:]}"


def _rain(rng, ward: str, month: str) -> float:
    m = int(month[5:])
    factor = rng.uniform(0.85, 1.15)
    if ward in DROUGHT_WARDS_2024_25 and season_of(month) == "2024/25" and m in (11, 12, 1, 2, 3, 4):
        factor = rng.uniform(0.45, 0.6)
    if ward == "Mlowo" and month == "2026-03":
        factor = 2.3
    return round(RAIN_NORMAL[m] * factor, 1)


def _ndvi(rng, crop: str, ward: str, month: str, in_programme: bool) -> float:
    m = int(month[5:])
    if crop == "coffee":  # perennial: green all year, mild seasonal swing
        v = 0.62 + 0.08 * math.cos((m - 4) / 12 * 2 * math.pi)
    else:  # annuals: green Jan-Apr, bare Jun-Oct
        v = {1: 0.62, 2: 0.70, 3: 0.68, 4: 0.55, 5: 0.40, 6: 0.28, 7: 0.25,
             8: 0.24, 9: 0.24, 10: 0.26, 11: 0.32, 12: 0.48}[m]
    if ward in DROUGHT_WARDS_2024_25 and month in ("2025-01", "2025-02", "2025-03", "2025-04"):
        v *= 0.72
    if ward == "Igamba" and crop == "coffee" and month in ("2026-08", "2026-09"):
        v *= 0.7
    if in_programme and month >= "2025-11":
        v += 0.05  # dummy programme effect
    return round(min(0.9, max(0.05, v + rng.uniform(-0.02, 0.02))), 3)


def build() -> dict:
    rng = random.Random(42)
    farmers = {}
    for fid, name, ward, coop, lang, share in FARMERS:
        farmers[fid] = {
            "farmer_id": fid, "display_name": name, "language": lang, "district": DISTRICT, "ward": ward,
            "cooperative": coop, "wallet_id": f"W-{fid}", "registered_at": "2026-02-10T09:00:00Z",
            "registered_by": "voice+photo+walked boundary",
            "consent": {"registry": True, "share_with_programmes": share, "recorded_at": "2026-02-10T09:00:00Z"},
            "programmes": [PROGRAMME_ID] if fid in PROGRAMME_FARMERS else [],
        }

    plots, ndvi = {}, {}
    for i, (fid, crop, ha, claimed) in enumerate(PLOTS, start=1):
        lon, lat = WARDS[farmers[fid]["ward"]]
        geom = geo.square(lon + rng.uniform(-0.015, 0.015), lat + rng.uniform(-0.015, 0.015), ha)
        pid = f"PL-{i:03d}"
        plots[pid] = {"plot_id": pid, "farmer_id": fid, "crop": crop, "geometry": geom,
                      "area_ha": round(geo.area_ha(geom), 2), "claimed_area_ha": claimed,
                      "boundary_method": "walked"}
        ward = farmers[fid]["ward"]
        series = [{"month": mo, "ndvi": _ndvi(rng, crop, ward, mo, fid in PROGRAMME_FARMERS),
                   "cloudy": rng.random() < 0.08} for mo in months()]
        ndvi[pid] = series
    ndvi["PL-002"][-1]["cloudy"] = True   # Noor's maize: latest image is cloudy -> "not sure"
    ndvi["PL-012"][-1]["cloudy"] = False  # Daudi's coffee: clear view of the dry-spell stress
    feb = next(r for r in ndvi["PL-004"] if r["month"] == "2026-02")  # Rehema's maize: pest damage
    feb.update(ndvi=round(feb["ndvi"] * 0.6, 3), cloudy=False)       # while rain was normal

    rain = {w: [{"month": mo, "mm": _rain(rng, w, mo), "normal_mm": RAIN_NORMAL[int(mo[5:])]} for mo in months()]
            for w in WARDS}

    wallets = {f["wallet_id"]: {"wallet_id": f["wallet_id"], "owner": fid, "provider": "M-Pesa (mock)", "balance_tzs": 0}
               for fid, f in farmers.items()}
    dealers = {
        "D-01": {"dealer_id": "D-01", "name": "Vwawa Agro Inputs", "ward": "Vwawa", "verified": True},
        "D-02": {"dealer_id": "D-02", "name": "Mlowo Farm Supplies", "ward": "Mlowo", "verified": True},
        "D-03": {"dealer_id": "D-03", "name": "Roadside seller", "ward": "Igamba", "verified": False},
    }
    for d in dealers.values():
        wallets[f"W-{d['dealer_id']}"] = {"wallet_id": f"W-{d['dealer_id']}", "owner": d["dealer_id"],
                                           "provider": "M-Pesa (mock)", "balance_tzs": 0}
    wallets["W-PROGRAMME"] = {"wallet_id": "W-PROGRAMME", "owner": PROGRAMME_ID, "provider": "bank (mock)",
                              "balance_tzs": 50_000_000}

    vouchers = {}
    for n, fid in enumerate(sorted(PROGRAMME_FARMERS), start=1):
        vid = f"V-{n:04d}"
        redeemed = fid in {"F-MBZ001", "F-MBZ002", "F-MBZ005"}
        vouchers[vid] = {
            "voucher_id": vid, "farmer_id": fid, "programme_id": PROGRAMME_ID, "item": "NPK fertilizer 50 kg",
            "value_tzs": 60_000, "code": f"CSC-{1000 + n * 37}", "status": "redeemed" if redeemed else "issued",
            "issued_at": "2026-08-01T08:00:00Z", "redeemed_at": "2026-08-12T11:00:00Z" if redeemed else None,
            "dealer_id": "D-01" if redeemed else None,
        }

    policies = {f"POL-{i:03d}": {"policy_id": f"POL-{i:03d}", "farmer_id": fid, "product": "rainfall index (demo)",
                                 "ward": farmers[fid]["ward"], "season": "2024/25", "sum_insured_tzs": 300_000,
                                 "trigger_ratio": 0.75, "exit_ratio": 0.40}
                for i, fid in enumerate([f[0] for f in FARMERS[:10]], start=1)}

    prices = []
    for week in range(13):
        day = (date(2026, 7, 6) + timedelta(weeks=week)).isoformat()
        for market, bias in (("Vwawa", 1.0), ("Mlowo", 0.97), ("Mbeya", 1.06)):
            prices.append({"date": day, "market": market, "commodity": "coffee_parchment",
                           "tzs_per_kg": round(7000 * bias * rng.uniform(0.95, 1.05) + week * 15)})
            prices.append({"date": day, "market": market, "commodity": "maize",
                           "tzs_per_kg": round(780 * bias * rng.uniform(0.93, 1.07))})

    lon, lat = WARDS["Mlowo"]
    events = {"E-FLOOD-2026-03": {
        "event_id": "E-FLOOD-2026-03", "type": "flood", "date": "2026-03-14", "source": "mock (would be Sentinel-1 flood map)",
        "geometry": {"type": "Polygon", "coordinates": [[[lon - 0.03, lat - 0.03], [lon + 0.03, lat - 0.03],
                                                         [lon + 0.03, lat + 0.03], [lon - 0.03, lat + 0.03],
                                                         [lon - 0.03, lat - 0.03]]]}}}

    return {
        "farmers": farmers, "plots": plots, "ndvi": ndvi, "rain": rain, "wallets": wallets, "ledger": [],
        "dealers": dealers, "vouchers": vouchers, "voucher_flags": [], "policies": policies, "payouts": {},
        "prices": prices, "events": events, "escalations": {},
        "programmes": {PROGRAMME_ID: {"programme_id": PROGRAMME_ID, "name": "Climate-smart coffee (demo programme)",
                                      "sponsor": "fictional, for the demo", "started": "2025-11"}},
    }
