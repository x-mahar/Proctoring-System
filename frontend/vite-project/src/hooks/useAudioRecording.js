import { useState, useRef, useCallback } from "react";

export default function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      // Check supported MIME types
      let mimeType = '';
      const supportedTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4'];
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      console.log("Using MIME type:", mimeType || 'default');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined
      });
      
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("Received audio chunk:", event.data.size, "bytes");
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped, total chunks:", chunks.length);
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { 
            type: mimeType || 'audio/webm' 
          });
          console.log("Created audio blob:", blob.size, "bytes");
          setAudioBlob(blob);
        } else {
          console.warn("No audio chunks recorded");
          setAudioBlob(null);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log("Recording started successfully");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or error. Please allow microphone access and try again.");
      throw err;
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped audio track");
        });
        streamRef.current = null;
      }
      
      setIsRecording(false);
    }
  }, []);

  return { isRecording, audioBlob, startRecording, stopRecording };
}