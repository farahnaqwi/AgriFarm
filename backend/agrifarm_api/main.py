"""AgriFarm platform API.

Farmer side: registry, voice advisor, satellite alerts, e-vouchers, insurance, prices, evidence reports.
Institution side: registry map, targeting, delivery tracking, impact, climate, disaster response.
Everything except evidence reports runs on dummy data held in memory (see seed.py).
"""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from fastapi import FastAPI  # noqa: E402

from . import store  # noqa: E402
from .routers import (advisor, alerts, farmers, institution, insurance, payments,  # noqa: E402
                      prices, reports, vouchers)

app = FastAPI(
    title="AgriFarm platform API",
    description="Dummy-data MVP. A person makes every decision that moves money; the AI says "
                "'not sure' instead of guessing. Send X-Role: program_officer or extension_officer "
                "for staff actions.",
)
for r in (farmers, advisor, alerts, vouchers, insurance, payments, prices, reports, institution):
    app.include_router(r.router)


@app.get("/health", tags=["System"])
def health():
    try:
        r = reports.supabase().table("reports").select("hash", count="exact").limit(1).execute()
        supabase = {"status": "connected", "reports": r.count}
    except Exception as e:  # report the problem instead of failing the whole health check
        supabase = {"status": "error", "detail": str(getattr(e, "detail", e))[:200]}
    return {"api": "ok", "supabase": supabase,
            "dummy_data": {k: len(store.db[k]) for k in ("farmers", "plots", "vouchers", "policies", "payouts")}}


@app.post("/demo/reset", tags=["System"])
def reset_demo():
    """Restore the dummy data to its starting state."""
    store.reset()
    return {"status": "reset"}
