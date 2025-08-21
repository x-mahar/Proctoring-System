from fastapi import APIRouter, UploadFile, Form, HTTPException, File
from fastapi.responses import JSONResponse
from app.utils.stt_handler import speech_to_text
from app.utils.evaluator import evaluate_answer
from app.utils.logger import save_result
from datetime import datetime
from app.db.session import db
import traceback


router = APIRouter()
candidate_sessions = {}

def get_question_entry(session, question_id):
    return next((q for q in session["questions"] if q["question_id"] == question_id), None)

@router.post("/submit_answer")
async def submit_answer(
    candidate_id: str = Form(...),
    question_id: int = Form(...),
    expected_answer: str = Form(...),
    audio_file: UploadFile = File(...)
):
    if not audio_file:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        # user_answer = await speech_to_text(audio_file)
        user_answer = await speech_to_text(audio_file, candidate_id, question_id, expected_answer)
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    # If transcription is very short/empty, proceed with empty answer (no hard error)
    warning_msg = None
    if not user_answer or len(user_answer.strip()) < 3:
        user_answer = (user_answer or "").strip()
        if not user_answer:
            user_answer = ""
        warning_msg = "Transcription was very short or unclear"

    is_correct = evaluate_answer(user_answer, expected_answer)

    # Update in-memory session
    session = candidate_sessions.setdefault(candidate_id, {
        "questions": [],
        "score": 0,
        "start_time": datetime.now()
    })

    existing = get_question_entry(session, question_id)

    question_entry = {
        "question_id": question_id,
        "user_answer": user_answer,
        "expected_answer": expected_answer,
        "is_correct": is_correct,
        "score": 1 if is_correct else -1,
        "marked_for_review": False,
        "skipped": False,
        "edited": True if existing and existing.get("user_answer") else False
    }

    if existing:
        existing.update(question_entry)
    else:
        session["questions"].append(question_entry)

    # Update MongoDB QA log (one entry per candidate)
    db["qa_logs"].update_one(
        {"candidate_id": candidate_id},
        {"$pull": {"qa_log": {"question_id": question_id}}}
    )
    db["qa_logs"].update_one(
        {"candidate_id": candidate_id},
        {"$push": {"qa_log": question_entry}},
        upsert=True
    )

    # Update score
    session["score"] += 1 if is_correct else -1

    response = {
        "user_answer": user_answer,
        "is_correct": is_correct,
        "current_score": session["score"]
    }
    if warning_msg:
        response["warning"] = warning_msg
    return JSONResponse(status_code=200, content=response)

@router.post("/mark_review")
async def mark_for_review(candidate_id: str = Form(...), question_id: int = Form(...)):
    """
    Mark a question for review only if it has an answer.

    Prefer in-memory session for speed, but gracefully fall back to MongoDB so
    review state works even after backend restarts (which clear in-memory sessions).
    """
    session = candidate_sessions.get(candidate_id)
    if session:
        existing = get_question_entry(session, question_id)
        # Treat as eligible if the question exists and is not marked as skipped
        if existing and existing.get("skipped") is False:
            # Update in-memory state
            existing["marked_for_review"] = True
            # Persist mark state to MongoDB
            db["qa_logs"].update_one(
                {"candidate_id": candidate_id, "qa_log.question_id": question_id},
                {"$set": {"qa_log.$.marked_for_review": True}},
                upsert=True
            )
            return {"message": f"Q{question_id} marked for review."}

    # Fallback: Check MongoDB for an answered entry and mark it
    # Consider answered if an entry exists and it's not marked as skipped
    record = db["qa_logs"].find_one({
        "candidate_id": candidate_id,
        "qa_log": {"$elemMatch": {"question_id": question_id, "skipped": False}}
    })
    if not record:
        return JSONResponse(status_code=400, content={"error": "Please answer before marking for review."})

    # Persist mark state to MongoDB via positional operator
    db["qa_logs"].update_one(
        {"candidate_id": candidate_id, "qa_log.question_id": question_id},
        {"$set": {"qa_log.$.marked_for_review": True}},
        upsert=True
    )

    # If session exists but lacked the question entry (e.g., restart), optionally seed minimal state
    if session is not None:
        existing = get_question_entry(session, question_id)
        if not existing:
            session.setdefault("questions", []).append({
                "question_id": question_id,
                "user_answer": "(restored from DB)",
                "expected_answer": "",
                "is_correct": False,
                "score": 0,
                "marked_for_review": True,
                "skipped": False,
                "edited": False
            })
        else:
            existing["marked_for_review"] = True

    return {"message": f"Q{question_id} marked for review."}

@router.post("/skip_question")
async def skip_question(candidate_id: str = Form(...), question_id: int = Form(...)):
    try:
        # Check if already logged
        existing = db["qa_logs"].find_one({
            "candidate_id": candidate_id,
            "qa_log.question_id": question_id
        })

        if existing:
            return {"message": f"Question {question_id} already exists in logs"}

        log = {
            "question_id": question_id,
            "user_answer": "",
            "expected_answer": "",
            "is_correct": False,
            "score": 0,
            "marked_for_review": False,
            "skipped": True
        }

        db["qa_logs"].update_one(
            {"candidate_id": candidate_id},
            {"$push": {"qa_log": log}},
            upsert=True
        )

        return {"message": f"Question {question_id} skipped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error skipping question: {str(e)}")

@router.post("/get_result")
async def get_result(candidate_id: str = Form(...), candidate_name: str = Form(...)):
    try:
        print(f"[DEBUG] Fetching result for Candidate ID: {candidate_id}")

        record = db["qa_logs"].find_one({"candidate_id": candidate_id})
        print(f"[DEBUG] Record found in qa_logs: {record is not None}")

        if not record or "qa_log" not in record:
            print(f"[ERROR] No QA logs found for {candidate_id}")
            raise HTTPException(status_code=404, detail="No QA logs found")

        qa_log = record["qa_log"]

        # Validate entries in qa_log
        if not isinstance(qa_log, list) or not all(isinstance(q, dict) for q in qa_log):
            print("[ERROR] Invalid QA log format.")
            raise HTTPException(status_code=400, detail="Malformed QA log")

        # Calculate score and result
        score = sum(q.get("score", 0) for q in qa_log)
        total = len(qa_log)
        percentage = (score / total) * 100 if total else 0
        result = "Pass" if percentage >= 60 else "Fail"

        # ✅ Save to database using unified logic
        save_result(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            score=score,
            total_questions=total,
            result=result,
            percentage=percentage
        )

        # Clean QA log for frontend
        clean_qa_log = [
            {k: v for k, v in q.items() if k != "_id"} for q in qa_log
        ]

        return {
            "candidate_name": candidate_name,
            "candidate_id": candidate_id,
            "score": score,
            "qa_log": clean_qa_log,
            "total_questions": total,
            "percentage": percentage,
            "result": result,
            "test_completed": True,
            "completed_at": datetime.utcnow().isoformat()
        }

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        import traceback
        print("❌ Error in /get_result:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/get_review_questions")
async def get_review_questions(candidate_id: str):
    # Prefer in-memory session if available
    session = candidate_sessions.get(candidate_id)
    if session:
        review_questions = [q for q in session["questions"] if q.get("marked_for_review")]
        return {"review_questions": review_questions}

    # Fallback to MongoDB so review state survives restarts
    record = db["qa_logs"].find_one({"candidate_id": candidate_id})
    if not record or "qa_log" not in record:
        return {"review_questions": []}
    qa_log = record["qa_log"]
    if not isinstance(qa_log, list):
        return {"review_questions": []}
    review_questions = [
        {k: v for k, v in q.items() if k != "_id"}
        for q in qa_log if isinstance(q, dict) and q.get("marked_for_review")
    ]
    return {"review_questions": review_questions}


@router.post("/stt_only")
async def stt_only(
    candidate_id: str = Form(...),
    question_id: int = Form(...),
    expected_answer: str = Form(...),
    audio_file: UploadFile = File(...)
):
    try:
        # user_answer = await speech_to_text(audio_file)
        user_answer = await speech_to_text(audio_file, candidate_id, question_id, expected_answer)
        return {"user_answer": user_answer.strip()}
    except Exception as e:
        return {"error": str(e)}


@router.post("/check_status")
async def check_status(candidate_id: str = Form(...)):
    try:
        record = db["result"].find_one({"candidate_id": candidate_id})
        if record:
            if record.get("failed_due_to_cheating"):
                return {"test_completed": True, "banned": True,
                        "message": "You are disqualified due to repeated violations."}
            if record.get("test_completed"):
                return {"test_completed": True, "message": "Test already completed"}
        return {"test_completed": False}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
