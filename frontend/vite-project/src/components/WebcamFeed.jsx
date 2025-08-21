import { useEffect, useRef, useCallback, useState } from "react";
import { postJSON, API_BASE } from "../utils/api";
import useWebcamStream from "../hooks/useWebcamStream.jsx";
import useHeadPoseDetection from "../hooks/useHeadPoseDetection";

export default function WebcamFeed({ candidateId, candidateName, sessionId, onViolation, onDisqualify }) {
  // Inline styles replacing Tailwind utility classes
  const styles = {
    container: { position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: 8, overflow: 'hidden' },
    video: { width: '100%', height: '100%', objectFit: 'cover' },
    panelBase: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', padding: 24, textAlign: 'center', borderRadius: 8 },
    panelIconWrapError: { background: 'rgba(239,68,68,0.2)', padding: 16, borderRadius: 9999, marginBottom: 16 },
    title: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
    textMuted: { color: '#d1d5db', maxWidth: 560, margin: '0 auto 24px' },
    btn: { padding: '8px 16px', borderRadius: 8, fontWeight: 500, transition: 'background 0.2s', color: '#fff', display: 'inline-flex', alignItems: 'center', border: 'none', cursor: 'pointer' },
    btnPrimary: { background: '#2563eb' },
    btnDisabled: { background: '#3b82f6', cursor: 'not-allowed' },
    loadingRingOuter: { width: 64, height: 64, border: '4px solid rgba(59,130,246,0.2)', borderRadius: '50%', marginBottom: 24, position: 'relative' },
    loadingRingInner: { position: 'absolute', top: 0, left: 0, width: 64, height: 64, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' },
    loadingIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#60a5fa' },
    overlayInfo: { position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: 8, borderRadius: 6, fontSize: 14 },
    violationText: { color: '#f87171', fontWeight: 600, marginTop: 4 },
    processingBadge: { position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 12px', borderRadius: 9999, fontSize: 12, display: 'flex', alignItems: 'center' },
    processingDot: { width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginRight: 8 },
    icon: { width: 20, height: 20, marginRight: 8 },
  };
  const { 
    videoRef, 
    isStreaming, 
    error, 
    permissionDenied, 
    deviceError,
    startWebcam 
  } = useWebcamStream();
  
  const canvasRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [headPoseData, setHeadPoseData] = useState(null);
  const { detectHeadPose, checkSystemStatus } = useHeadPoseDetection();

  // Check system status on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await fetch(`${API_BASE}/status/`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Try to parse as JSON, but handle non-JSON responses gracefully
        try {
          const status = await response.json();
          setSystemStatus(status);
        } catch (jsonError) {
          console.warn('Received non-JSON response from status endpoint');
          setSystemStatus({ status: 'unknown', message: 'Status check completed' });
        }
      } catch (error) {
        console.error('Failed to check system status:', error);
        // Set a default status instead of showing an error
        setSystemStatus({ 
          status: 'error', 
          message: 'Proctoring service status unknown' 
        });
      }
    };
    
    initialize();
  }, []);

  // Retry when error
  const renderError = () => {
    let errorMessage = lastError || error;
    let title = "Webcam Error";
    
    if (permissionDenied) {
      title = "Camera Access Required";
      errorMessage = "Please allow camera access in your browser settings and click Retry.";
    } else if (deviceError) {
      title = "Camera Not Found";
      errorMessage = "No camera device was detected. Please connect a camera and try again.";
    }
    
    return (
      <div style={styles.panelBase}>
        <div style={styles.panelIconWrapError}>
          <svg style={{ width: 40, height: 40 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.textMuted}>{errorMessage}</p>
        <button onClick={startWebcam} style={{ ...styles.btn, ...(isProcessing ? styles.btnDisabled : styles.btnPrimary) }} disabled={isProcessing}>
          {!isProcessing ? (
            <>
              <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Try Again
            </>
          ) : (
            <>Starting...</>
          )}
        </button>
      </div>
    );
  };

  const renderLoading = () => (
    <div style={styles.panelBase}>
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={styles.loadingRingOuter}></div>
        <div style={styles.loadingRingInner}></div>
        <div style={styles.loadingIcon}>
          <svg style={{ width: 32, height: 32, color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Initializing Camera</h3>
      <p style={{ color: '#9ca3af', maxWidth: 560 }}>
        Please wait while we set up your camera. Make sure to allow camera access when prompted.
      </p>
    </div>
  );

  // Track frame timing and state
  const frameInterval = useRef(null);
  const lastProcessedTime = useRef(0);
  const frameId = useRef(0);
  const processingRef = useRef(false);
  const frameQueue = useRef([]);
  const isMounted = useRef(true);
  const isDisqualifiedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (frameInterval.current) {
        clearInterval(frameInterval.current);
      }
    };
  }, []);

  // Process the next frame in the queue
  const processNextFrame = useCallback(() => {
    if (frameQueue.current.length === 0 || processingRef.current || isDisqualifiedRef.current) {
      return;
    }

    const { frame, id, timestamp } = frameQueue.current.shift();
    
    // Skip if this frame is no longer relevant
    if (id !== frameId.current) {
      return;
    }

    processingRef.current = true;
    
    const processFrame = async () => {
      const image = frame;
      const currentTimestamp = Date.now();
      
      // Ensure we have a valid candidate ID and frame
      if (!candidateId || !image || isDisqualifiedRef.current) {
        processingRef.current = false;
        return;
      }

      try {
        const poseResponse = await detectHeadPose(image, candidateName, sessionId);
        // Normalize pose response
        let normalized = {};
        if (typeof poseResponse === 'string') {
          normalized = { message: poseResponse };
        } else if (poseResponse && typeof poseResponse === 'object') {
          normalized = poseResponse;
        }

        if (isMounted.current) {
          setHeadPoseData(prev => ({
            ...normalized,
            timestamp: currentTimestamp
          }));

          // Handle violations from head pose detection using multiple possible flags/fields
          const isViolation = !!(normalized.violation || normalized.bad_pose || normalized.alert || normalized.status === 'violation');
          if (isViolation) {
            const msg = normalized.message || normalized.warning || normalized.reason || 'Suspicious head movement detected';
            onViolation?.(msg);
          }

          // Handle disqualification/banned directly from frames response
          if (normalized?.status === 'banned' || normalized?.disqualified === true) {
            isDisqualifiedRef.current = true;
            if (frameInterval.current) {
              clearInterval(frameInterval.current);
              frameInterval.current = null;
            }
            onDisqualify?.(normalized?.message || normalized?.warning || 'Test terminated due to policy violation');
          }
        }
      } catch (error) {
        console.error('Error in frame processing:', error);
      } finally {
        processingRef.current = false;
        
        // Process next frame in the queue if available
        if (frameQueue.current.length > 0 && !isDisqualifiedRef.current) {
          processNextFrame();
        }
      }
    };
    
    // Start processing the frame
    processFrame();
  }, [candidateId, candidateName, sessionId, onViolation]);

  // Capture and queue frames at a controlled rate
  const captureAndQueueFrame = useCallback(() => {
    if (!videoRef.current || !isMounted.current || isDisqualifiedRef.current) {
      return;
    }

    const now = Date.now();
    
    // Limit frame processing to ~10fps to reduce load
    if (now - lastProcessedTime.current < 100) { // 100ms = ~10fps
      return;
    }
    
    lastProcessedTime.current = now;
    const currentFrameId = ++frameId.current;
    
    // Skip if we have too many frames in the queue
    if (frameQueue.current.length >= 2) {
      return;
    }
    
    try {
      // Create canvas if it doesn't exist
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      
      const video = videoRef.current;
      // Ensure metadata loaded before reading dimensions
      if (video.readyState < 2) {
        return;
      }
      
      // Ensure video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('Video dimensions are zero, skipping frame capture');
        return;
      }
      
      // Set canvas dimensions to match video
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;
      
      const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
      
      // Draw the current video frame to the canvas
      try {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      } catch (drawError) {
        console.error('Error drawing video frame:', drawError);
        return;
      }
      
      // Convert to JPEG with 70% quality to reduce size while maintaining quality
      let image;
      try {
        image = canvasRef.current.toDataURL('image/jpeg', 0.7);
      } catch (encodeError) {
        console.error('Error encoding image:', encodeError);
        return;
      }
      
      // Add frame to queue for processing
      frameQueue.current.push({
        frame: image,
        id: currentFrameId,
        timestamp: now
      });
      
      // Start processing if not already in progress
      if (!processingRef.current && !isDisqualifiedRef.current) {
        processNextFrame();
      }
    } catch (error) {
      console.error('Error in frame capture:', error);
    }
    
    // Skip if we have too many frames in the queue
    if (frameQueue.current.length >= 2) {
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Create canvas if it doesn't exist
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      
      const video = videoRef.current;
      // Ensure metadata loaded before reading dimensions
      if (video.readyState < 2) {
        return;
      }
      
      // Ensure video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("Video dimensions are zero, skipping frame capture");
        return;
      }
      
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;
      
      const context = canvasRef.current.getContext("2d", { willReadFrequently: true });
      
      // Draw the current video frame to the canvas
      try {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      } catch (drawError) {
        console.error("Error drawing video frame:", drawError);
        return;
      }
      
      // Skip processing if this is not the most recent frame
      if (currentFrameId !== frameId.current) {
        return;
      }
      
      // Convert to JPEG with 70% quality to reduce size while maintaining quality
      let image;
      try {
        image = canvasRef.current.toDataURL("image/jpeg", 0.7);
      } catch (encodeError) {
        console.error("Error encoding image:", encodeError);
        return;
      }

      // Process frame in the queue
      frameQueue.current.push({
        frame: image,
        id: currentFrameId,
        timestamp: Date.now()
      });
      
      // If not already processing, start processing the queue
      if (!processingRef.current && !isDisqualifiedRef.current) {
        processNextFrame();
      }

      // Send frame to server in the background for phone detection and ban handling
      postJSON("/frames/", { 
        candidate_id: candidateId, 
        image
      })
      .then(response => {
        try { console.debug('frames/ response:', response); } catch {}

        // If backend returns a plain string, surface it as a warning
        if (typeof response === 'string' && response.trim().length > 0) {
          onViolation?.(response);
          return;
        }

        // Normalize potential cheating indicators
        const cheatingFlag = !!(response?.cheating || response?.is_cheating || response?.violation || response?.alert);
        if (cheatingFlag) {
          const msg = response?.warning || response?.message || response?.reason || 'Cheating behavior detected';
          onViolation?.(msg);
        }
        
        // Disqualification handling (support different shapes)
        if (response?.status === "banned" || response?.disqualified === true) {
          // Stop further processing and notify parent
          isDisqualifiedRef.current = true;
          if (frameInterval.current) {
            clearInterval(frameInterval.current);
            frameInterval.current = null;
          }
          onDisqualify?.(response?.message || response?.warning || 'Test terminated due to policy violation');
        }
      })
      .catch(error => {
        console.warn("Failed to send frame to server:", error);
        setLastError("Failed to send frame to server. Please check your connection.");
      });
    } catch (error) {
      console.error("Error capturing frame:", error);
      setLastError("Error capturing webcam frame");
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  }, [candidateId, onViolation, isProcessing, detectHeadPose]);

  // Set up frame capture when streaming starts/stops
  useEffect(() => {
    if (!isStreaming) {
      if (frameInterval.current) {
        clearInterval(frameInterval.current);
        frameInterval.current = null;
      }
      return;
    }
    
    // Start frame capture at ~10fps
    frameInterval.current = setInterval(() => {
      captureAndQueueFrame();
    }, 100); // Check for new frames every 100ms
    
    // Initial frame capture
    captureAndQueueFrame();
    
    return () => {
      if (frameInterval.current) {
        clearInterval(frameInterval.current);
        frameInterval.current = null;
      }
    };
  }, [isStreaming, captureAndQueueFrame]);

  return (
    <div style={styles.container}>
      {!isStreaming && !error && renderLoading()}
      {error && renderError()}
      <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
      {headPoseData && (
        <div style={styles.overlayInfo}>
          <div>Pitch: {headPoseData.pitch?.toFixed(2) || 'N/A'}°</div>
          <div>Yaw: {headPoseData.yaw?.toFixed(2) || 'N/A'}°</div>
          <div>Roll: {headPoseData.roll?.toFixed(2) || 'N/A'}°</div>
          {headPoseData.violation && (
            <div style={styles.violationText}>
              {headPoseData.message || 'Suspicious movement detected'}
            </div>
          )}
        </div>
      )}
      {isProcessing && (
        <div style={styles.processingBadge}>
          <div style={styles.processingDot}></div>
          Analyzing...
        </div>
      )}
    </div>
  );
}
