"""Verified farm evidence reports, stored in Supabase (live data, not dummy).

The app builds, hashes and signs each report with the shared JS engine (backend/engine).
This router stores and serves them; it does not re-hash or re-judge them.
Tables: reports(hash, report, created_at), site_visit_requests(report_hash, lender, ...).
"""
import os
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["Evidence reports (Supabase)"])


@lru_cache
def supabase():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(503, "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
    from supabase import create_client
    return create_client(url, key)  # service-role key: backend only, never shipped to the app


class NewReport(BaseModel):
    hash: str     # computed on the farmer's phone; also what the QR carries
    report: dict  # the whole signed report


class VisitRequest(BaseModel):
    lender: str


@router.post("", status_code=201)
def save_report(body: NewReport):
    return supabase().table("reports").insert(body.model_dump()).execute().data[0]


@router.get("/{report_hash}")
def get_report(report_hash: str):
    """Lender scans the QR. The lender page re-hashes the report itself to check it was not altered."""
    rows = supabase().table("reports").select("*").eq("hash", report_hash).execute().data
    if not rows:
        raise HTTPException(404, "Report not found")
    return rows[0]


@router.post("/{report_hash}/site-visit", status_code=201)
def request_site_visit(report_hash: str, body: VisitRequest):
    row = {"report_hash": report_hash, "lender": body.lender}
    return supabase().table("site_visit_requests").insert(row).execute().data[0]
