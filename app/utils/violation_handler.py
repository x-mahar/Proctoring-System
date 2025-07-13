# app/utils/violation_handler.py

from datetime import datetime
from pymongo.errors import PyMongoError
from app.db.session import db
from app.utils.logger import log_cheating_to_mongo
import logging

logger = logging.getLogger(__name__)

def disqualify_candidate(candidate_id: str, reason: str, extra_data: dict = None) -> bool:
    """
    Disqualifies a candidate by updating MongoDB and logging the violation.
    Returns True if successful, False otherwise.
    """
    try:
        db["result"].update_one(
            {"candidate_id": candidate_id},
            {
                "$set": {
                    "result": "Fail",
                    "test_completed": True,
                    "banned": True,
                    "disqualified_reason": reason,
                    "completed_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        log_cheating_to_mongo(
            candidate_id=candidate_id,
            candidate_name=candidate_id,  # assuming name = id for now
            cheating_type=reason,
            details=extra_data or {}
        )

        logger.info(f"[Disqualified] {candidate_id} for: {reason}")
        return True

    except PyMongoError as e:
        logger.error(f"[MongoDB Error] Disqualification failed for {candidate_id}: {str(e)}")
        return False
