"""In-memory store seeded with dummy data. Restarting the server resets it.

Evidence reports are the exception: they live in Supabase (see routers/reports.py).
"""
import itertools

from . import seed

db: dict = {}
_ids = itertools.count(1)


def reset() -> None:
    db.clear()
    db.update(seed.build())


def next_id(prefix: str) -> str:
    return f"{prefix}-{next(_ids):05d}"


def farmer_or_404(farmer_id: str) -> dict:
    from fastapi import HTTPException
    farmer = db["farmers"].get(farmer_id)
    if not farmer:
        raise HTTPException(404, f"Farmer {farmer_id} not found")
    return farmer


def plots_of(farmer_id: str) -> list[dict]:
    return [p for p in db["plots"].values() if p["farmer_id"] == farmer_id]


reset()
