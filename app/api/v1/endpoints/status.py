from fastapi import APIRouter, UploadFile, File, Form
from PIL import Image
import numpy as np
import io
import cv2

from app.utils.head_pose_estimator import HeadPoseEstimator
from app.utils.logger import log_cheating_to_mongo  # ✅ updated import

router = APIRouter(tags=["Status"])
pose_estimator = HeadPoseEstimator()

@router.get("/")
def root():
    return {"message": "Head Pose Detection is Live!"}

@router.post("/detect_head_pose")
async def detect_head_pose(
    file: UploadFile = File(...),
    candidate_name: str = Form(...),
    session_id: str = Form(...)
):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        img = np.array(image)
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        # Head pose estimation
        rvec, tvec, _ = pose_estimator.estimate_pose(img)
        if rvec is None:
            reason = "No face detected"
            log_cheating_to_mongo(
                candidate_id=session_id,
                candidate_name=candidate_name,
                cheating_type=reason,
                details={"yaw": None, "pitch": None, "roll": None}
            )
            return {
                "yaw": None,
                "pitch": None,
                "roll": None,
                "cheating": True,
                "reason": reason
            }

        # Convert rvec to yaw/pitch/roll
        rotation_matrix, _ = cv2.Rodrigues(rvec)
        sy = np.sqrt(rotation_matrix[0, 0]**2 + rotation_matrix[1, 0]**2)
        singular = sy < 1e-6

        if not singular:
            pitch = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
            yaw = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
        else:
            pitch = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
            yaw = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = 0

        # Convert to degrees
        yaw = np.degrees(yaw)
        pitch = np.degrees(pitch)
        roll = np.degrees(roll)

        # Detect cheating
        cheating = False
        reason = "Normal head position"
        if abs(yaw) > 45:
            cheating = True
            reason = f"Head turned too far (Yaw: {yaw:.1f}°)"
        elif abs(pitch) > 30:
            cheating = True
            reason = f"Looking up/down suspiciously (Pitch: {pitch:.1f}°)"

        # Log only if cheating
        if cheating:
            log_cheating_to_mongo(
                candidate_id=session_id,
                candidate_name=candidate_name,
                cheating_type=reason,
                details={
                    "yaw": round(yaw, 2),
                    "pitch": round(pitch, 2),
                    "roll": round(roll, 2)
                }
            )

        # Return pose data
        return {
            "yaw": round(yaw, 2),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2),
            "cheating": cheating,
            "reason": reason
        }

    except Exception as e:
        return {"error": f"Error during detection: {str(e)}"}
