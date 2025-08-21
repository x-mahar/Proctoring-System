import { useEffect, useState, useRef, useCallback } from "react";
import useScreenRecording from "../hooks/useScreenRecording";
import { API_BASE } from "../utils/api";

export default function ScreenShare({ candidateId }) {
  const styles = {
    card: { background: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16, color: '#fff', overflow: 'hidden' },
    title: { fontSize: 18, fontWeight: 700 },
    preview: { width: '100%', height: 176, background: 'rgba(0,0,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    hint: { color: 'rgba(255,255,255,0.7)' },
    error: { color: 'rgb(252,165,165)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '8px 12px' },
    button: (recording) => ({ width: '100%', padding: '10px 14px', fontWeight: 800, borderRadius: 10, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 8px 18px rgba(0,0,0,0.25)', background: recording ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', fontFamily: "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif" }),
    uploading: { color: 'rgba(255,255,255,0.85)', textAlign: 'center' }
  };
  const { 
    isRecording, 
    recordedChunks, 
    error: recordingError, 
    startRecording, 
    stopRecording,
    clearRecordedChunks 
  } = useScreenRecording();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    if (recordedChunks.length > 0) {
      // Avoid unhandled promise rejection in console
      uploadRecording().catch(() => {});
    }
  }, [recordedChunks]);

  async function handleToggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const uploadRecording = useCallback(async () => {
    if (recordedChunks.length === 0) {
      setError('No recording data to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    
    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('candidate_id', candidateId);
      
      // Create file with timestamp in name
      const filename = `recording-${candidateId}-${Date.now()}.webm`;
      formData.append('recording', new File([blob], filename, { type: 'video/webm' }));

      const controller = new AbortController();
      // Increase timeout to 60s to accommodate slower networks/larger files
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(`${API_BASE}/frames/upload_screen_recording`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Upload failed');
      }
      
      // Clear recorded chunks after successful upload
      clearRecordedChunks();
      
      try {
        return await response.json();
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        return { success: true };
      }
      
    } catch (err) {
      const errorMessage = err.name === 'AbortError' 
        ? 'Upload timed out. Please try again.'
        : err.message || 'Failed to upload recording';
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [candidateId, recordedChunks]);

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Screen Sharing</h3>
      <div style={styles.preview}>
        {isRecording ? (
          <p style={styles.hint}>Screen recording is in progress...</p>
        ) : (
          <p style={styles.hint}>Your screen will be displayed here.</p>
        )}
      </div>
      {(error || recordingError) && (
        <div style={styles.error}>
          {error || recordingError}
        </div>
      )}
      <button 
        onClick={handleToggleRecording} 
        disabled={isUploading}
        style={styles.button(isRecording)}>
        {isRecording ? "Stop Screen Share" : "Start Screen Share"}
      </button>
      {isUploading && <p style={styles.uploading}>Uploading...</p>}
    </div>
  );
}
