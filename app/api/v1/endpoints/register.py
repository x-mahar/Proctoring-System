from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from app.db.session import db

router = APIRouter(tags=["Register"])

class RegisterRequest(BaseModel):
    name: str

@router.post("/")
def register_candidate(data: RegisterRequest):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    candidate_id = f"CAND-{str(uuid4())[:8]}"
    db["candidates"].insert_one({
        "candidate_id": candidate_id,
        "name": name
    })

    return {
        "message": "Candidate registered successfully",
        "candidate_id": candidate_id,
        "name": name
    }
