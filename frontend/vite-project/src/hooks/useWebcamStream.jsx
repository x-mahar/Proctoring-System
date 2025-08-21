import { useEffect, useRef, useState, useCallback } from "react";

export default function useWebcamStream() {
  const videoRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [deviceError, setDeviceError] = useState(false);

  const handleStreamSuccess = useCallback((stream) => {
    if (!videoRef.current) return;
    
    // Stop any existing tracks
    if (videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    videoRef.current.srcObject = stream;
    
    // Add a small delay to allow the video element to be ready
    setTimeout(() => {
      if (!videoRef.current) return;
      
      // Set the video element's currentTime to 0 to ensure clean start
      videoRef.current.currentTime = 0;
      
      // Mute the video to prevent autoplay issues
      videoRef.current.muted = true;
      
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Webcam stream started");
            setIsStreaming(true);
            setError(null);
          })
          .catch(err => {
            console.error("❌ Error playing video stream:", err);
            // Auto-retry once after a short delay
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play()
                  .then(() => {
                    console.log("✅ Webcam stream started after retry");
                    setIsStreaming(true);
                    setError(null);
                  })
                  .catch(retryErr => {
                    console.error("❌ Retry failed:", retryErr);
                    setError("Could not start video feed. Please check your camera and try again.");
                  });
              }
            }, 500);
          });
      }
    }, 100);
  }, []);

  const handleStreamError = useCallback((err) => {
    console.error("❌ Webcam access error:", err);

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (err.name === "NotAllowedError") {
      setPermissionDenied(true);
      setError("Camera access denied. Please allow camera in your browser settings.");
    } else if (err.name === "NotFoundError") {
      setDeviceError(true);
      setError("No camera device found. Please connect a camera and retry.");
    } else if (err.name === "NotReadableError") {
      setError("Camera is already in use by another app.");
    } else {
      setError(`Failed to access webcam: ${err.message || "Unknown error"}`);
    }
  }, []);

  const startWebcam = useCallback(async () => {
    setError(null);
    setPermissionDenied(false);
    setDeviceError(false);
    setIsStreaming(false);
    
    // Add a small delay to allow state to update and ensure clean start
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Your browser does not support webcam access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      console.log("✅ getUserMedia returned stream:", stream);
      handleStreamSuccess(stream);
    } catch (err) {
      handleStreamError(err);
    }
  }, [handleStreamSuccess, handleStreamError]);

  // Auto start on mount
  useEffect(() => {
    if (document.visibilityState === "visible") {
      startWebcam();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [startWebcam]);

  return {
    videoRef,
    isStreaming,
    error,
    permissionDenied,
    deviceError,
    startWebcam
  };
}
