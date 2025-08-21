import cv2
import numpy as np
import mediapipe as mp


class HeadPoseEstimator:
    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Stable landmark selection
        self.landmark_indices = [
            1,  # Nose tip
            10,  # Chin center
            152,  # Chin bottom
            33,  # Right eye outer corner
            263,  # Left eye outer corner
            61,  # Left mouth corner
            291,  # Right mouth corner
            199,  # Right temple
            419  # Left temple
        ]

        # Improved 3D model points (relative proportions)
        self.model_points = np.array([
            [0.0, 0.0, 0.0],  # Nose tip
            [0.0, -8.0, -4.0],  # Chin center
            [0.0, -9.0, -6.0],  # Chin bottom
            [5.0, 5.0, -5.0],  # Right eye
            [-5.0, 5.0, -5.0],  # Left eye
            [-3.5, -3.5, -4.0],  # Left mouth
            [3.5, -3.5, -4.0],  # Right mouth
            [7.0, 3.0, -4.0],  # Right temple
            [-7.0, 3.0, -4.0]  # Left temple
        ], dtype=np.float64)

        # Smoothing variables
        self.prev_rvec = None
        self.prev_tvec = None
        self.smoothing_factor = 0.6  # Higher = more smoothing

    def estimate_pose(self, image):
        try:
            img_h, img_w = image.shape[:2]
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_image)

            if not results.multi_face_landmarks:
                return None, None, None

            landmarks = results.multi_face_landmarks[0].landmark

            # Convert landmarks to image coordinates
            image_points = np.array([
                [landmarks[i].x * img_w, landmarks[i].y * img_h]
                for i in self.landmark_indices
            ], dtype=np.float64)

            # Camera matrix
            focal_length = img_w
            center = (img_w / 2, img_h / 2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype=np.float64)

            # Solve PnP with RANSAC
            _, rvec, tvec = cv2.solvePnP(
                self.model_points,
                image_points,
                camera_matrix,
                np.zeros((4, 1)),
                flags=cv2.SOLVEPNP_ITERATIVE,
                useExtrinsicGuess=False
            )

            # Apply smoothing
            if self.prev_rvec is not None:
                rvec = self.smoothing_factor * rvec + (1 - self.smoothing_factor) * self.prev_rvec
                tvec = self.smoothing_factor * tvec + (1 - self.smoothing_factor) * self.prev_tvec

            self.prev_rvec = rvec
            self.prev_tvec = tvec

            return rvec, tvec, camera_matrix

        except Exception as e:
            print(f"Pose estimation error: {e}")
            return None, None, None