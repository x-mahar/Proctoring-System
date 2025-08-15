import { useEffect, useRef } from "react";

export default function WebcamFeed({ candidateId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    async function initWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
      } catch (err) {
        alert("Webcam access denied or unavailable.");
      }
    }
    initWebcam();
  }, []);

  return (
    <div className="bg-white/10 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Webcam</h3>
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-44 rounded-lg object-cover" />
    </div>
  );
}
