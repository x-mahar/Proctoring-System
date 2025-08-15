violation_window = {}

def check_pose_violation(candidate_id, yaw, pitch, roll, now):
    """
    Improved cheating logic with time-based buffer and smoother thresholds.
    """
    if yaw is None or pitch is None or roll is None:
        return None

    if candidate_id not in violation_window:
        violation_window[candidate_id] = {"start": None, "reason": None}

    reason = None
    if abs(yaw) > 55:
        reason = f"Looking too far left/right (Yaw: {yaw:.1f}°)"
    elif pitch < -35:
        reason = f"Looking down too much (Pitch: {pitch:.1f}°)"
    elif pitch > 85:
        reason = f"Looking up too much (Pitch: {pitch:.1f}°)"
    elif abs(roll) > 30:
        reason = f"Head tilted (Roll: {roll:.1f}°)"

    if reason:
        if violation_window[candidate_id]["start"] is None:
            violation_window[candidate_id] = {"start": now, "reason": reason}
        else:
            delta = (now - violation_window[candidate_id]["start"]).total_seconds()
            if delta >= 3:  # ⏱️ sustain for 3 seconds
                return violation_window[candidate_id]["reason"]
    else:
        violation_window[candidate_id] = {"start": None, "reason": None}

    return None
