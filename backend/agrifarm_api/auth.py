"""Demo roles. A real deployment would use Supabase Auth; here the caller sends an X-Role header.

Anything that moves money or overrides the system needs a named human role, so the
API itself enforces "a person makes the final call".
"""
from fastapi import Header, HTTPException

PROGRAM_OFFICER = "program_officer"
EXTENSION_OFFICER = "extension_officer"


def require_role(*roles: str):
    def check(x_role: str = Header(default="", alias="X-Role"), x_user: str = Header(default="", alias="X-User")):
        if x_role not in roles:
            raise HTTPException(403, f"Needs a person with role: {' or '.join(roles)} (send X-Role header).")
        return x_user or x_role
    return check
