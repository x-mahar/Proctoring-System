from ultralytics import YOLO
import numpy as np

# Load YOLO model globally once
model = YOLO("yolov8n.pt")  # YOLOv8 nano

# YOLOv8 COCO classes to watch
MOBILE_CLASSES = {"cell phone", "phone", "cellphone", "mobile phone"}
PERSON_CLASS = "person"

def get_yolo_results(image: np.ndarray):
    """
    Runs YOLO inference on the given image and returns the results.
    """
    return model.predict(image, imgsz=320, verbose=False)[0]


def detect_mobile_from_yolo(results, min_conf=0.5) -> bool:
    """
    Detects if a mobile phone is present in YOLO results with filtering.
    """
    for box in results.boxes:
        cls = int(box.cls[0].item())
        conf = box.conf[0].item()
        name = model.names[cls].lower()

        if name in MOBILE_CLASSES and conf >= min_conf:
            return True
    return False



def count_people(results, min_conf=0.5, min_area=15000) -> int:
    """
    Counts the number of people in the YOLO results with filtering.
    - Ignores detections with low confidence.
    - Ignores very small bounding boxes.
    """
    count = 0
    for box in results.boxes:
        cls = int(box.cls[0].item())
        conf = box.conf[0].item()
        name = model.names[cls].lower()

        if name == PERSON_CLASS and conf >= min_conf:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            area = (x2 - x1) * (y2 - y1)
            if area >= min_area:
                count += 1
    return count
