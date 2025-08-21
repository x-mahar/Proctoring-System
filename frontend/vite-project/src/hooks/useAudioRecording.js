import { useState, useRef } from "react";

export default function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Stopped recording, chunks:', chunks.length);
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
          console.log('Created blob of size:', blob.size, 'bytes');
          setAudioBlob(blob);
        } else {
          console.warn('No audio data recorded');
          setAudioBlob(null);
        }
        
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording and request data every 100ms
      mediaRecorder.start(100);
      mediaRecorderRef.current = { 
        mediaRecorder,
        stream // Keep reference to stop tracks later
      };
      
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err; // Re-throw to handle in the component
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      const { mediaRecorder } = mediaRecorderRef.current;
      mediaRecorder.requestData(); // Request any remaining data
      mediaRecorder.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  return { isRecording, audioBlob, startRecording, stopRecording };
}
