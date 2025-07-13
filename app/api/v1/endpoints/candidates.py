from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime
from app.db.session import db

router = APIRouter()

class CandidateRegister(BaseModel):
    name: str

@router.post("/register-candidate/")
async def register_candidate(data: CandidateRegister):
    candidate = {
        "name": data.name,
        "registered_at": datetime.utcnow()
    }
    result = db["candidates"].insert_one(candidate)
    return {
        "candidate_id": str(result.inserted_id),
        "message": "Candidate registered successfully"
    }
