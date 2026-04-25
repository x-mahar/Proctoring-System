import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE } from "../utils/api";

// How many consecutive detections before firing a violation
const TRIGGER_THRESHOLD = 2;

export default function WebcamFeed({ candidateId, candidateName, sessionId, onViolation, onDisqualify }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs for values used inside intervals to avoid stale closures
  const violationCountRef = useRef(0);
  const [violationCountDisplay, setViolationCountDisplay] = useState(0);

  // Consecutive detection counters per violation type (for debouncing)
  const consecutiveRef = useRef({
    head_pose: 0,
    multiple_people: 0,
    face_not_detected: 0,
  });

  // Last shown status for the overlay badge
  const [statusBadge, setStatusBadge] = useState(null); // { type, message }

  // ── Start webcam ──
  useEffect(() => {
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (err) {
        setError(err.message);
      }
    }
    startWebcam();
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const fireViolation = useCallback((message, isBan = false) => {
    if (isBan) {
      onDisqualify?.(message);
      return;
    }
    violationCountRef.current += 1;
    setViolationCountDisplay(violationCountRef.current);
    onViolation?.(message);
  }, [onViolation, onDisqualify]);

  // ── Send frame every 4 seconds (slightly slower = less sensitive) ──
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || isProcessing) return;

      setIsProcessing(true);
      try {
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const video = videoRef.current;
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        const ctx = canvasRef.current.getContext("2d");
        ctx.drawImage(video, 0, 0);
        const imageData = canvasRef.current.toDataURL("image/jpeg", 0.8);

        const formData = new FormData();
        formData.append("file", dataURLtoBlob(imageData), "frame.jpg");
        formData.append("candidate_name", candidateName || "unknown");
        formData.append("session_id", sessionId || "unknown");

        const response = await fetch(`${API_BASE}/frames/`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) return;
        const result = await response.json();

        console.log("[WebcamFeed] Detection result:", result);

        // ── Handle banned / disqualified from backend ──
        if (result.status === "banned") {
          setStatusBadge({ type: "banned", message: result.message });
          fireViolation(result.message, true); // true = disqualify
          return;
        }

        // ── Handle paused state ──
        if (result.status === "paused") {
          setStatusBadge({ type: "paused", message: `Paused: ${result.remaining_seconds}s` });
          return;
        }

        // ── Phone detected (comes back as cheating: true, reason: "Mobile phone detected") ──
        if (result.cheating && result.reason?.toLowerCase().includes("mobile")) {
          setStatusBadge({ type: "phone", message: "📱 Phone detected!" });
          fireViolation("Phone detected in frame!", true); // instant ban
          return;
        }

        // ── Multiple people ──
        if (result.cheating && result.reason?.toLowerCase().includes("multiple people")) {
          consecutiveRef.current.multiple_people += 1;
          if (consecutiveRef.current.multiple_people >= TRIGGER_THRESHOLD) {
            consecutiveRef.current.multiple_people = 0;
            setStatusBadge({ type: "multiple", message: "👥 Multiple people detected" });
            fireViolation("Multiple people detected in frame!");
          } else {
            setStatusBadge({ type: "warning", message: `Multiple people (${consecutiveRef.current.multiple_people}/${TRIGGER_THRESHOLD})` });
          }
          return;
        } else {
          consecutiveRef.current.multiple_people = 0;
        }

        // ── Head pose / looking away ──
        if (result.cheating && result.reason && !result.reason.toLowerCase().includes("mobile")) {
          consecutiveRef.current.head_pose += 1;
          if (consecutiveRef.current.head_pose >= TRIGGER_THRESHOLD) {
            consecutiveRef.current.head_pose = 0;
            setStatusBadge({ type: "pose", message: `👀 ${result.reason}` });
            fireViolation(result.reason || "Head movement detected!");
          } else {
            setStatusBadge({ type: "warning", message: `Head pose (${consecutiveRef.current.head_pose}/${TRIGGER_THRESHOLD})` });
          }
          return;
        } else {
          consecutiveRef.current.head_pose = 0;
        }

        // ── Face not detected (warning only, not a hard violation unless repeated) ──
        if (result.warning && result.reason?.toLowerCase().includes("face")) {
          consecutiveRef.current.face_not_detected += 1;
          if (consecutiveRef.current.face_not_detected >= 4) {
            consecutiveRef.current.face_not_detected = 0;
            setStatusBadge({ type: "face", message: "🙈 Face not visible" });
            fireViolation("Face not visible for extended period!");
          } else {
            setStatusBadge({ type: "warning", message: "Face not clearly visible" });
          }
          return;
        } else {
          consecutiveRef.current.face_not_detected = 0;
        }

        // ── All clear ──
        setStatusBadge(null);

      } catch (err) {
        console.error("[WebcamFeed] Detection error:", err);
      } finally {
        setIsProcessing(false);
      }
    }, 4000); // 4 seconds between frames

    return () => clearInterval(interval);
  }, [isStreaming, candidateName, sessionId, fireViolation, isProcessing]);

  // Badge color map
  const badgeColors = {
    banned:   "rgba(220,38,38,0.95)",
    paused:   "rgba(234,179,8,0.9)",
    phone:    "rgba(220,38,38,0.95)",
    multiple: "rgba(239,68,68,0.9)",
    pose:     "rgba(234,179,8,0.85)",
    face:     "rgba(234,179,8,0.85)",
    warning:  "rgba(107,114,128,0.8)",
  };

  if (error) {
    return (
      <div style={{ color: "#f87171", padding: 16, textAlign: "center", fontSize: 13 }}>
        📷 Webcam Error: {error}
      </div>
    );
  }

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "#000",
      position: "relative",
      overflow: "hidden",
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {/* Analyzing indicator */}
      {isProcessing && (
        <div style={{
          position: "absolute",
          top: 6,
          left: 6,
          background: "rgba(0,0,0,0.6)",
          color: "rgba(255,255,255,0.7)",
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#60a5fa",
            display: "inline-block",
            animation: "pulse 1s infinite",
          }} />
          Analyzing
        </div>
      )}

      {/* Violation status badge */}
      {statusBadge && (
        <div style={{
          position: "absolute",
          bottom: 6,
          left: 6,
          right: 6,
          background: badgeColors[statusBadge.type] || "rgba(0,0,0,0.7)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 8px",
          borderRadius: 5,
          textAlign: "center",
        }}>
          {statusBadge.message}
        </div>
      )}

      {/* Violation count */}
      {violationCountDisplay > 0 && (
        <div style={{
          position: "absolute",
          top: 6,
          right: 6,
          background: "rgba(220,38,38,0.85)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 4,
        }}>
          ⚠️ {violationCountDisplay} violation{violationCountDisplay > 1 ? "s" : ""}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}