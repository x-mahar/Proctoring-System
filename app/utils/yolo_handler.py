from ultralytics import YOLO
import numpy as np
import cv2

# YOLOv8s is significantly better than nano for phone detection
# If you want to keep nano, at least lower the confidence threshold
model = YOLO("yolov8s.pt")  # upgrade from nano → small for much better accuracy

# All possible phone-related class names in COCO
MOBILE_CLASSES = {"cell phone"}  # COCO only has "cell phone" — don't add others, causes false positives
PERSON_CLASS = "person"

def get_yolo_results(image: np.ndarray):
    """
    Runs YOLO inference. 
    - imgsz=640 instead of 320 — better detection of objects filling the frame
    - conf=0.25 — lower threshold so partial/close-up phones still get caught
    """
    return model.predict(
        image,
        imgsz=640,    # was 320 — doubled resolution = much better detection
        conf=0.25,    # was default 0.5 — lower = catches more, filter by class below
        verbose=False
    )[0]


def detect_mobile_from_yolo(results, min_conf=0.30) -> bool:
    """
    Detects if a mobile phone is present.
    - min_conf lowered to 0.30 (was 0.5) — nano/small models rarely hit 0.5 for phones
    - Added partial detection: if phone fills >40% of frame width it's likely a close-up
    """
    img_w = results.orig_shape[1] if hasattr(results, 'orig_shape') else 640

    for box in results.boxes:
        cls  = int(box.cls[0].item())
        conf = box.conf[0].item()
        name = model.names[cls].lower()

        if name in MOBILE_CLASSES and conf >= min_conf:
            return True

        # Extra check: large "cell phone" box even at lower confidence
        # When phone is very close it fills frame and confidence can drop
        if name in MOBILE_CLASSES and conf >= 0.20:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            box_w = x2 - x1
            # If box is wider than 35% of frame width — likely a close-up phone
            if box_w / img_w > 0.35:
                return True

    return False


def count_people(results, min_conf=0.50, min_area=15000) -> int:
    """
    Counts people in frame.
    Kept at 0.50 confidence for people — YOLO is very accurate for people.
    """
    count = 0
    for box in results.boxes:
        cls  = int(box.cls[0].item())
        conf = box.conf[0].item()
        name = model.names[cls].lower()

        if name == PERSON_CLASS and conf >= min_conf:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            area = (x2 - x1) * (y2 - y1)
            if area >= min_area:
                count += 1
    return count