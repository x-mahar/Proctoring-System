import { useRef, useState, useCallback } from "react";

export default function useScreenRecording() {
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [error, setError] = useState(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Received chunk of size:', event.data.size);
          chunks.push(event.data);
        } else {
          console.warn('Empty or invalid data received from MediaRecorder');
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('MediaRecorder stopped, total chunks:', chunks.length);
        console.log('Total size:', chunks.reduce((acc, chunk) => acc + chunk.size, 0), 'bytes');
        if (chunks.length > 0) {
          setRecordedChunks([...chunks]); // Create a new array reference
        } else {
          console.warn('No data chunks were recorded');
          setError('No recording data was captured');
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Screen recording error:", err);
      setError(err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      // Request final data before stopping
      mediaRecorderRef.current.requestData();
      // Small delay to ensure data is processed
      setTimeout(() => {
        mediaRecorderRef.current?.stop();
        // Stop all tracks in the stream
        if (mediaRecorderRef.current?.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
      }, 100);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screen_recording_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearRecordedChunks = useCallback(() => {
    setRecordedChunks([]);
  }, []);

  return {
    isRecording,
    recordedChunks,
    error,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecordedChunks,
  };
}
