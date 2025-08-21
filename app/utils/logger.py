import csv
import os
from datetime import datetime
from app.db.session import db

# ✅ Path for CSV cheating logs
CSV_CHEATING_LOG = os.path.join("app", "logs", "cheating_logs.csv")
os.makedirs(os.path.dirname(CSV_CHEATING_LOG), exist_ok=True)

# ✅ 1. Cheating logger (MongoDB + CSV)
def log_cheating_to_mongo(candidate_id, candidate_name, cheating_type, details):
    collection = db["cheating_logs"]
    timestamp = datetime.utcnow()
    warnings = {cheating_type: 1}

    existing = collection.find_one({"candidate_id": candidate_id})
    if existing:
        existing_warnings = existing.get("details", {}).get("warnings", {})
        existing_warnings[cheating_type] = existing_warnings.get(cheating_type, 0) + 1

        existing_types = [s.strip() for s in existing.get("cheating_type", "").split(",") if s.strip()]
        if cheating_type not in existing_types:
            existing_types.append(cheating_type)

        collection.update_one(
            {"candidate_id": candidate_id},
            {
                "$set": {
                    "candidate_name": candidate_name,
                    "cheating_type": ", ".join(sorted(existing_types)),
                    "timestamp": timestamp,
                    "details.yaw": details.get("yaw"),
                    "details.pitch": details.get("pitch"),
                    "details.roll": details.get("roll"),
                    "details.warnings": existing_warnings
                }
            }
        )
    else:
        collection.insert_one({
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "cheating_type": cheating_type,
            "timestamp": timestamp,
            "details": {
                "yaw": details.get("yaw"),
                "pitch": details.get("pitch"),
                "roll": details.get("roll"),
                "warnings": warnings
            }
        })

    # ✅ Write cheating info to CSV
    log_row = {
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "cheating_type": cheating_type,
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "yaw": details.get("yaw"),
        "pitch": details.get("pitch"),
        "roll": details.get("roll"),
        "warning_count": warnings.get(cheating_type, 1)
    }

    write_header = not os.path.exists(CSV_CHEATING_LOG)
    with open(CSV_CHEATING_LOG, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=log_row.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(log_row)

    print(f"[LOGGED] Cheating: {cheating_type} | Candidate: {candidate_name}")

# ✅ 2. Final result logger (MongoDB only)
def save_result(candidate_id, candidate_name, score, total_questions, result, percentage):
    now = datetime.utcnow()

    result_doc = {
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "score": score,
        "total_questions": total_questions,
        "percentage": percentage,
        "result": result,
        "test_completed": True,
        "completed_at": now
    }

    db["result"].update_one(
        {"candidate_id": candidate_id},
        {"$set": result_doc},
        upsert=True
    )

    print(f"[LOGGED] Final result (MongoDB) for {candidate_name}")
