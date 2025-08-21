from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import app.db.session as db_session
from pymongo import errors

router = APIRouter()

class CandidateRegister(BaseModel):
    name: str

@router.post("/register-candidate/")
async def register_candidate(data: CandidateRegister):
    db = db_session.get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable. Please ensure MongoDB is running.")
    candidate = {
        "name": data.name,
        "registered_at": datetime.utcnow()
    }
    try:
        result = db["candidates"].insert_one(candidate)
    except errors.PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Failed to register candidate: {str(e)}")
    return {
        "candidate_id": str(result.inserted_id),
        "message": "Candidate registered successfully"
    }
