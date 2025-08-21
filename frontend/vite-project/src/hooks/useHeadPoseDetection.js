import { useCallback } from 'react';
import { API_BASE } from '../utils/api';

const useHeadPoseDetection = () => {
  const detectHeadPose = useCallback(async (imageData, candidateName, sessionId) => {
    try {
      // Convert data URL to Blob for multipart upload
      const dataURLtoBlob = (dataurl) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
      };

      const formData = new FormData();
      const blob = dataURLtoBlob(imageData);
      formData.append('file', blob, `frame_${Date.now()}.jpg`);
      formData.append('candidate_name', candidateName || 'unknown');
      formData.append('session_id', sessionId || 'unknown');

      const res = await fetch(`${API_BASE}/status/detect_head_pose`, {
        method: 'POST',
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error(payload?.detail || 'Head pose request failed');
      return payload;
    } catch (error) {
      console.error('Error detecting head pose:', error);
      throw error;
    }
  }, []);

  const checkSystemStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/status/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking system status:', error);
      throw error;
    }
  }, []);

  return {
    detectHeadPose,
    checkSystemStatus
  };
};

export default useHeadPoseDetection;

