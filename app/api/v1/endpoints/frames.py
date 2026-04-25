from collections import deque
from fastapi import APIRouter, HTTPException, Form, UploadFile
from fastapi.responses import JSONResponse
import numpy as np
import cv2
from datetime import datetime, timedelta
import csv
import os
import logging
import filelock
import time
from pathlib import Path

from pymongo.errors import PyMongoError
from app.db.session import db
from app.utils.mediapipe_handler import MediaPipeFaceMesh
from app.utils.head_pose_estimator import HeadPoseEstimator
from app.utils.yolo_handler import get_yolo_results, detect_mobile_from_yolo, count_people
from app.utils.logger import log_cheating_to_mongo
from app.utils.pose_rules import check_pose_violation
from app.utils.violation_handler import disqualify_candidate

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app/logs/api_debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

router = APIRouter()

CSV_FILE = "app/logs/pose_logs.csv"
RECORDINGS_DIR = "app/recordings"

try:
    pose_estimator = HeadPoseEstimator()
    face_analyzer = MediaPipeFaceMesh()
except Exception as e:
    logger.error(f"Failed to initialize models: {str(e)}")
    raise RuntimeError("Failed to initialize required models") from e

# ── Per-candidate session state ──
face_not_detected_counter = {}
phone_warning_count = {}
violation_count = {}
pause_until = {}
rolling_window = {}

# Moderate sensitivity thresholds
PHONE_BAN_THRESHOLD = 2
FACE_MISSING_THRESHOLD = 4

os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
os.makedirs(RECORDINGS_DIR, exist_ok=True)


def log_to_csv(data: list):
    lock = filelock.FileLock(f"{CSV_FILE}.lock")
    try:
        with lock:
            with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as f:
                csv.writer(f).writerow(data)
    except Exception as e:
        logger.error(f"CSV write failed: {str(e)}")


# ── Helper: derive a stable candidate_id from session_id ──
def get_candidate_id(session_id: str, candidate_name: str) -> str:
    """
    session_id format is: CAND-xxxx-randompart-timestamp
    We use the first two segments as candidate_id e.g. CAND-xxxx
    """
    parts = session_id.split("-")
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    return candidate_name or session_id


@router.post("/", tags=["Frames"], operation_id="upload_candidate_frame")
async def upload_candidate_frame(
    file: UploadFile,
    candidate_name: str = Form(default="unknown"),
    session_id: str = Form(default="unknown"),
):
    now = datetime.now()
    candidate_id = get_candidate_id(session_id, candidate_name)

    logger.info(f"[{candidate_id}] Frame received from '{candidate_name}' session='{session_id}'")

    # ── Paused check ──
    if candidate_id in pause_until and now < pause_until[candidate_id]:
        remaining = int((pause_until[candidate_id] - now).total_seconds())
        return JSONResponse(status_code=200, content={
            "status": "paused",
            "message": f"Test paused for {remaining}s due to repeated violations.",
            "remaining_seconds": remaining
        })

    try:
        # ── Decode image from uploaded file bytes ──
        img_bytes = await file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        logger.info(f"[{candidate_id}] Image decoded: shape={img.shape}")

        response_data = {
            "status": "running",
            "timestamp": now.isoformat(),
            "yaw": None,
            "pitch": None,
            "roll": None,
            "cheating": False,
            "reason": "Normal",
            "warning": None,
        }

        # ── YOLO: Phone + multiple people ──
        try:
            results = get_yolo_results(img)

            # Phone detection — moderate (warn first, ban on repeat)
            if detect_mobile_from_yolo(results):
                phone_warning_count[candidate_id] = phone_warning_count.get(candidate_id, 0) + 1
                pcount = phone_warning_count[candidate_id]
                logger.info(f"[{candidate_id}] Phone detected ({pcount}/{PHONE_BAN_THRESHOLD})")

                if pcount >= PHONE_BAN_THRESHOLD:
                    phone_warning_count[candidate_id] = 0
                    db["result"].update_one(
                        {"candidate_id": candidate_id},
                        {"$set": {
                            "result": "Fail",
                            "test_completed": True,
                            "banned": True,
                            "disqualified_reason": "Mobile phone detected",
                            "completed_at": datetime.utcnow()
                        }},
                        upsert=True
                    )
                    log_cheating_to_mongo(candidate_id, candidate_id, "Mobile phone detected", {"violation_type": "mobile"})
                    return JSONResponse(status_code=200, content={
                        "status": "banned",
                        "message": "🚫 Disqualified: Mobile phone detected.",
                        "cheating": True,
                        "reason": "Mobile phone detected"
                    })
                else:
                    # First sighting — warn only, don't ban yet
                    return JSONResponse(status_code=200, content={
                        "status": "warning",
                        "message": f"⚠️ Warning {pcount}/{PHONE_BAN_THRESHOLD}: Phone detected. Remove it now.",
                        "cheating": True,
                        "reason": "Mobile phone detected",
                        "warning": f"Phone warning {pcount}/{PHONE_BAN_THRESHOLD}"
                    })
            else:
                # Phone gone — reset counter
                phone_warning_count[candidate_id] = 0

            # Multiple people
            people_count = count_people(results)
            if people_count > 1:
                response_data.update({
                    "cheating": True,
                    "reason": f"Multiple people detected ({people_count})"
                })

        except Exception as e:
            logger.error(f"[{candidate_id}] YOLO failed: {str(e)}")

        # ── Face mesh + Head pose ──
        try:
            landmarks = face_analyzer.get_all_landmarks(img)
            if not landmarks:
                time.sleep(0.1)
                landmarks = face_analyzer.get_all_landmarks(img)

            if not landmarks or len(landmarks) < 468:
                raise ValueError(f"Only {len(landmarks) if landmarks else 0} landmarks detected (need 468)")

            # Good detection — reset face counter
            face_not_detected_counter[candidate_id] = 0

            rvec, tvec, _ = pose_estimator.estimate_pose(img)
            if rvec is None:
                raise ValueError("Pose estimation failed (rvec is None)")

            rotation_matrix, _ = cv2.Rodrigues(rvec)
            sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
            singular = sy < 1e-6

            if not singular:
                pitch = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
                yaw   = np.arctan2(-rotation_matrix[2, 0], sy)
                roll  = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
            else:
                pitch = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
                yaw   = np.arctan2(-rotation_matrix[2, 0], sy)
                roll  = 0

            yaw   = round(np.degrees(yaw), 2)
            pitch = round(np.degrees(pitch), 2)
            roll  = round(np.degrees(roll), 2)
            if abs(roll) > 75:
                roll = 0

            if candidate_id not in rolling_window:
                rolling_window[candidate_id] = deque(maxlen=10)
            rolling_window[candidate_id].append((yaw, pitch))

            smoothed_yaw   = round(np.mean([y for y, _ in rolling_window[candidate_id]]), 2)
            smoothed_pitch = round(np.mean([p for _, p in rolling_window[candidate_id]]), 2)

            violation_reason = check_pose_violation(candidate_id, smoothed_yaw, smoothed_pitch, roll, now)
            if violation_reason:
                response_data.update({"cheating": True, "reason": violation_reason})

            response_data.update({"yaw": smoothed_yaw, "pitch": smoothed_pitch, "roll": roll})

        except ValueError as e:
            logger.warning(f"[{candidate_id}] Face detection issue: {str(e)}")
            face_not_detected_counter[candidate_id] = face_not_detected_counter.get(candidate_id, 0) + 1
            miss = face_not_detected_counter[candidate_id]

            if miss >= FACE_MISSING_THRESHOLD:
                # Only becomes a violation after 4 consecutive misses
                response_data.update({
                    "cheating": True,
                    "reason": "Face not visible for extended period",
                    "warning": f"Face missing {miss} consecutive frames"
                })
            else:
                # Not a violation yet — just a warning
                response_data.update({
                    "warning": f"Face not clearly visible ({miss}/{FACE_MISSING_THRESHOLD})",
                    "reason": str(e),
                    "cheating": False
                })

        except Exception as e:
            logger.error(f"[{candidate_id}] Unexpected error: {str(e)}", exc_info=True)
            response_data.update({"warning": "System error during processing", "cheating": False})

        # ── Violation counter + disqualify ──
        if response_data["cheating"]:
            count = violation_count.get(candidate_id, 0) + 1
            violation_count[candidate_id] = count

            try:
                log_cheating_to_mongo(candidate_id, candidate_id, response_data["reason"], {
                    "yaw": response_data["yaw"],
                    "pitch": response_data["pitch"],
                    "violation_count": count
                })
            except Exception:
                pass

            if count <= 2:
                response_data["warning"] = f"⚠️ Warning {count}/3: {response_data['reason']}"
                pause_until[candidate_id] = now + timedelta(seconds=15)
            else:
                success = disqualify_candidate(
                    candidate_id,
                    response_data["reason"],
                    {"yaw": response_data["yaw"], "pitch": response_data["pitch"], "violation_count": count}
                )
                if success:
                    return JSONResponse(status_code=200, content={
                        "status": "banned",
                        "message": "❌ Disqualified after repeated violations.",
                        "cheating": True,
                        "reason": response_data["reason"],
                        "violation_count": count
                    })

        # ── CSV log ──
        try:
            log_to_csv([
                now.isoformat(), candidate_id,
                response_data.get("yaw"), response_data.get("pitch"), response_data.get("roll"),
                response_data["cheating"], response_data["reason"],
                response_data.get("warning") or ""
            ])
        except Exception as e:
            logger.error(f"CSV logging failed: {str(e)}")

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{candidate_id}] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/upload_screen_recording", tags=["Frames"])
async def upload_screen_recording(
    candidate_id: str = Form(...),
    recording: UploadFile = Form(...)
):
    try:
        if not candidate_id or len(candidate_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid candidate ID")

        save_dir = Path(RECORDINGS_DIR)
        save_dir.mkdir(parents=True, exist_ok=True)
        file_path = save_dir / f"{candidate_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm"

        with open(file_path, "wb") as buffer:
            while content := await recording.read(1024 * 1024):
                buffer.write(content)

        return {"message": "✅ Screen recording saved.", "filename": str(file_path)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Recording upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Error saving recording") from e


@router.post("/log_tab_violation", tags=["Frames"])
async def log_tab_violation(
    candidate_id: str = Form(...),
    reason: str = Form(...),
    timestamp: str = Form(default="")
):
    try:
        if not candidate_id or len(candidate_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid candidate ID")

        db["cheating_logs"].insert_one({
            "candidate_id": candidate_id,
            "type": "tab_violation",
            "reason": reason,
            "timestamp": timestamp or datetime.utcnow().isoformat(),
            "logged_at": datetime.utcnow()
        })
        return JSONResponse(content={"message": "Violation logged"}, status_code=200)

    except PyMongoError as e:
        logger.error(f"MongoDB insert failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error") from e
    except Exception as e:
        logger.error(f"Tab violation logging failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e