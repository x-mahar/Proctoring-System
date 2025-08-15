# import cv2
# import mediapipe as mp
# import numpy as np
#
# mp_face_mesh = mp.solutions.face_mesh
# mp_drawing = mp.solutions.drawing_utils
# mp_drawing_styles = mp.solutions.drawing_styles
#
#
# class MediaPipeFaceMesh:
#     def __init__(self):
#         self.face_mesh = mp_face_mesh.FaceMesh(
#             static_image_mode=False,
#             max_num_faces=1,
#             refine_landmarks=True,
#             min_detection_confidence=0.5,
#             min_tracking_confidence=0.5
#         )
#
#     def get_landmarks(self, image: np.ndarray):
#         """Get landmarks with confidence checking"""
#         rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
#         result = self.face_mesh.process(rgb_image)
#         if result.multi_face_landmarks:
#             return result.multi_face_landmarks[0]
#         return None
#
#     def draw_landmarks(self, image: np.ndarray, landmarks) -> np.ndarray:
#         """Draw landmarks with custom styling"""
#         if landmarks is None:
#             return image
#
#         mp_drawing.draw_landmarks(
#             image=image,
#             landmark_list=landmarks,
#             connections=mp_face_mesh.FACEMESH_TESSELATION,
#             landmark_drawing_spec=None,
#             connection_drawing_spec=mp_drawing_styles
#             .get_default_face_mesh_tesselation_style()
#         )
#         return image

import cv2
import mediapipe as mp
import numpy as np

mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles


class MediaPipeFaceMesh:
    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def get_landmarks(self, image: np.ndarray):
        """Get landmarks object (for drawing or pose)"""
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb_image)
        if result.multi_face_landmarks:
            return result.multi_face_landmarks[0]
        return None

    def get_all_landmarks(self, image: np.ndarray):
        """Return full list of 468 landmark coordinates in (x, y, z)"""
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb_image)
        if result.multi_face_landmarks:
            face_landmarks = result.multi_face_landmarks[0]
            h, w, _ = image.shape
            return [
                {
                    "x": int(lm.x * w),
                    "y": int(lm.y * h),
                    "z": lm.z
                }
                for lm in face_landmarks.landmark
            ]
        return []

    def draw_landmarks(self, image: np.ndarray, landmarks) -> np.ndarray:
        if landmarks is None:
            return image
        mp_drawing.draw_landmarks(
            image=image,
            landmark_list=landmarks,
            connections=mp_face_mesh.FACEMESH_TESSELATION,
            landmark_drawing_spec=None,
            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style()
        )
        return image
