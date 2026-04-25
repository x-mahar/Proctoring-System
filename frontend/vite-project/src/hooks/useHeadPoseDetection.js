import { useCallback } from 'react';
import { API_BASE } from '../utils/api';

const useHeadPoseDetection = () => {
  const detectHeadPose = useCallback(async (imageData, candidateName, sessionId) => {
    try {
      console.log('detectHeadPose called with:', {
        candidateName,
        sessionId,
        imageDataLength: imageData?.length
      });

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

      console.log('Sending head pose request to:', `${API_BASE}/status/detect_head_pose`);
      
      const res = await fetch(`${API_BASE}/status/detect_head_pose`, {
        method: 'POST',
        body: formData,
      });

      console.log('Head pose response status:', res.status);
      
      const contentType = res.headers.get('content-type') || '';
      let payload;
      
      if (contentType.includes('application/json')) {
        payload = await res.json();
        console.log('Head pose JSON response:', payload);
      } else {
        const text = await res.text();
        console.log('Head pose text response:', text);
        payload = { message: text };
      }
      
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.message || 'Head pose request failed');
      }
      
      return payload;
    } catch (error) {
      console.error('Error detecting head pose:', error);
      throw error;
    }
  }, []);

  const checkSystemStatus = useCallback(async () => {
    try {
      console.log('Checking system status at:', `${API_BASE}/status/`);
      const response = await fetch(`${API_BASE}/status/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('System status:', data);
      return data;
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