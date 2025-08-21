from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import uuid4
import app.db.session as db_session
from pymongo import errors

router = APIRouter(tags=["Register"])

class RegisterRequest(BaseModel):
    name: str

@router.post("/")
def register_candidate(data: RegisterRequest):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    # Acquire DB lazily (will reconnect if Mongo started after app)
    db = db_session.get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable. Please ensure MongoDB is running.")

    candidate_id = f"CAND-{str(uuid4())[:8]}"
    try:
        db["candidates"].insert_one({
            "candidate_id": candidate_id,
            "name": name
        })
    except errors.PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Failed to register candidate: {str(e)}")

    return {
        "message": "Candidate registered successfully",
        "candidate_id": candidate_id,
        "name": name
    }
