from collections import deque
from fastapi import APIRouter, HTTPException, Form, UploadFile, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import numpy as np
import cv2
import base64
import binascii
from datetime import datetime, timedelta
import csv
import os
import logging
import filelock
import time


from pymongo.errors import PyMongoError
from app.db.session import db
from app.utils.mediapipe_handler import MediaPipeFaceMesh
from app.utils.head_pose_estimator import HeadPoseEstimator
from app.utils.yolo_handler import get_yolo_results, detect_mobile_from_yolo, count_people
from app.utils.logger import log_cheating_to_mongo
from app.utils.pose_rules import check_pose_violation
from app.utils.violation_handler import disqualify_candidate

# Configure logging
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

# Constants
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
CSV_FILE = "app/logs/pose_logs.csv"
RECORDINGS_DIR = "app/recordings"

# Initialize models with error handling
try:
    pose_estimator = HeadPoseEstimator()
    face_analyzer = MediaPipeFaceMesh()
except Exception as e:
    logger.error(f"Failed to initialize models: {str(e)}")
    raise RuntimeError("Failed to initialize required models") from e

# Global session trackers
cheating_lookaway_start = {}
face_not_detected_counter = {}
violation_count = {}
pause_until = {}
rolling_window = {}  # candidate_id -> deque of (yaw, pitch)

# Ensure directories exist
os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
os.makedirs(RECORDINGS_DIR, exist_ok=True)

class FramePayload(BaseModel):
    candidate_id: str
    image: str  # base64 string

def extract_base64(image_str: str) -> str:
    if image_str.startswith("data:image"):
        try:
            _, encoded = image_str.split(",", 1)
            return encoded
        except ValueError as e:
            logger.error(f"Invalid image header format: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image header format") from e
    return image_str

def validate_image_size(encoded: str):
    size = (len(encoded) * 3) / 4
    if size > MAX_IMAGE_SIZE:
        logger.warning(f"Image too large: {size / 1024 / 1024:.2f}MB")
        raise HTTPException(
            status_code=413,
            detail=f"Image too large (max {MAX_IMAGE_SIZE / 1024 / 1024}MB)"
        )

def log_to_csv(data: list):
    lock = filelock.FileLock(f"{CSV_FILE}.lock")
    try:
        with lock:
            with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(data)
    except Exception as e:
        logger.error(f"CSV write failed: {str(e)}")

@router.post("/", tags=["Frames"], operation_id="upload_candidate_frame")
def upload_candidate_frame(payload: FramePayload):
    logger.info(f"Received frame from {payload.candidate_id}")

    now = datetime.now()
    candidate_id = payload.candidate_id

    if not candidate_id or len(candidate_id) > 100:
        raise HTTPException(status_code=400, detail="Invalid candidate ID")

    if candidate_id in pause_until and now < pause_until[candidate_id]:
        remaining = int((pause_until[candidate_id] - now).total_seconds())
        return JSONResponse(
            status_code=200,
            content={
                "status": "paused",
                "message": f"Test paused for {remaining} seconds due to repeated cheating.",
                "remaining_seconds": remaining
            }
        )

    try:
        encoded = extract_base64(payload.image)
        validate_image_size(encoded)

        try:
            img_bytes = base64.b64decode(encoded)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(status_code=400, detail="Could not decode image")
        except (binascii.Error, ValueError) as e:
            logger.error(f"Base64 decode error: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data") from e

        response_data = {
            "status": "running",
            "timestamp": now.isoformat(),
            "yaw": None,
            "pitch": None,
            "roll": None,
            "cheating": False,
            "reason": "Normal processing",
            "warning": None,
            "landmarks_sample": {},
            "all_landmarks": []
        }

        try:
            results = get_yolo_results(img)
            if detect_mobile_from_yolo(results):
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
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "banned",
                        "message": "🚫 Disqualified: Mobile phone detected.",
                        "cheating": True,
                        "reason": "Mobile phone detected"
                    }
                )
            if count_people(results) > 1:
                response_data.update({
                    "cheating": True,
                    "reason": "Multiple people detected"
                })
        except Exception as e:
            logger.error(f"YOLO processing failed: {str(e)}")

        smoothed_yaw = smoothed_pitch = roll = None
        try:
            logger.info(f"Processing image of shape {img.shape}")
            landmarks = face_analyzer.get_all_landmarks(img)
            if not landmarks:
                logger.warning("First face detection attempt failed, retrying...")
                time.sleep(0.1)
                landmarks = face_analyzer.get_all_landmarks(img)

            if not landmarks or len(landmarks) < 468:
                raise ValueError(f"Only {len(landmarks) if landmarks else 0} landmarks detected (need 468)")

            response_data["all_landmarks"] = landmarks
            if len(landmarks) > 33:
                response_data["landmarks_sample"] = {
                    "nose_tip": landmarks[1],
                    "left_eye_outer": landmarks[33]
                }

            rvec, tvec, _ = pose_estimator.estimate_pose(img)
            if rvec is None:
                raise ValueError("Pose estimation failed (rvec is None)")

            rotation_matrix, _ = cv2.Rodrigues(rvec)
            sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
            singular = sy < 1e-6

            if not singular:
                pitch = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
                yaw = np.arctan2(-rotation_matrix[2, 0], sy)
                roll = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
            else:
                pitch = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
                yaw = np.arctan2(-rotation_matrix[2, 0], sy)
                roll = 0

            yaw = round(np.degrees(yaw), 2)
            pitch = round(np.degrees(pitch), 2)
            roll = round(np.degrees(roll), 2)
            if abs(roll) > 75:
                roll = 0

            if candidate_id not in rolling_window:
                rolling_window[candidate_id] = deque(maxlen=10)
            rolling_window[candidate_id].append((yaw, pitch))

            smoothed_yaw = round(np.mean([y for y, _ in rolling_window[candidate_id]]), 2)
            smoothed_pitch = round(np.mean([p for _, p in rolling_window[candidate_id]]), 2)

            if smoothed_yaw is not None and smoothed_pitch is not None and roll is not None:
                violation_reason = check_pose_violation(candidate_id, smoothed_yaw, smoothed_pitch, roll, now)
                if violation_reason:
                    response_data.update({
                        "cheating": True,
                        "reason": violation_reason
                    })
            response_data.update({
                "yaw": smoothed_yaw,
                "pitch": smoothed_pitch,
                "roll": roll
            })
        except ValueError as e:
            logger.warning(f"Face detection issue: {str(e)}")
            face_not_detected_counter[candidate_id] = face_not_detected_counter.get(candidate_id, 0) + 1
            warning_msg = "Face not clearly visible - please adjust position"
            if face_not_detected_counter[candidate_id] >= 3:
                warning_msg = "Repeated face detection failures"
                response_data.update({
                    "cheating": True,
                    "reason": warning_msg
                })
            response_data.update({
                "warning": warning_msg,
                "reason": str(e),
                "yaw": None,
                "pitch": None,
                "roll": None
            })

        except Exception as e:
            logger.error(f"Unexpected processing error: {str(e)}", exc_info=True)
            response_data.update({
                "warning": "System error during processing",
                "reason": "Technical difficulty",
                "yaw": None,
                "pitch": None,
                "roll": None,
                "cheating": False
            })

        response_data["face_detection_failures"] = face_not_detected_counter.get(candidate_id, 0)

        if response_data["cheating"]:
            count = violation_count.get(candidate_id, 0) + 1
            violation_count[candidate_id] = count

            if count <= 2:
                response_data["warning"] = f"Warning {count}: {response_data['reason']}"
                pause_until[candidate_id] = now + timedelta(seconds=30)
            else:
                success = disqualify_candidate(
                    candidate_id,
                    response_data["reason"],
                    {
                        "yaw": response_data["yaw"],
                        "pitch": response_data["pitch"],
                        "roll": response_data["roll"],
                        "warning": response_data["warning"],
                        "violation_count": count
                    }
                )
                if success:
                    return JSONResponse(
                        status_code=200,
                        content={
                            "status": "banned",
                            "message": "❌ You are disqualified. Test ended due to repeated violations.",
                            "cheating": True,
                            "reason": response_data["reason"],
                            "violation_count": count
                        }
                    )

        try:
            log_to_csv([
                now.isoformat(),
                candidate_id,
                response_data["yaw"],
                response_data["pitch"],
                response_data["roll"],
                response_data["cheating"],
                response_data["reason"],
                response_data["warning"] or ""
            ])
        except Exception as e:
            logger.error(f"CSV logging failed: {str(e)}")

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/upload_screen_recording", tags=["Frames"])
async def upload_screen_recording(candidate_id: str = Form(...), recording: UploadFile = Form(...)):
    try:
        if not candidate_id or len(candidate_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid candidate ID")

        save_dir = Path(RECORDINGS_DIR)
        save_dir.mkdir(parents=True, exist_ok=True)
        file_path = save_dir / f"{candidate_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm"

        with open(file_path, "wb") as buffer:
            while content := await recording.read(1024 * 1024):  # 1MB chunks
                buffer.write(content)

        return {"message": "✅ Screen recording saved successfully.", "filename": str(file_path)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Recording upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Error saving recording") from e


@router.post("/log_tab_violation", tags=["Frames"])
async def log_tab_violation(candidate_id: str = Form(...), reason: str = Form(...), timestamp: str = Form(...)):
    try:
        if not candidate_id or len(candidate_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid candidate ID")

        db["cheating_logs"].insert_one({
            "candidate_id": candidate_id,
            "type": "tab_violation",
            "reason": reason,
            "timestamp": timestamp,
            "logged_at": datetime.utcnow()
        })
        return JSONResponse(content={"message": "Violation logged"}, status_code=200)

    except PyMongoError as e:
        logger.error(f"MongoDB insert failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error") from e
    except Exception as e:
        logger.error(f"Tab violation logging failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
