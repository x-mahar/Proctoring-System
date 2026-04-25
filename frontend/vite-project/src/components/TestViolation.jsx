import { useEffect } from "react";
import { API_BASE } from "../utils/api";

export default function TestViolation({ candidateId, candidateName, sessionId }) {
  useEffect(() => {
    // Test the endpoint directly
    const testViolation = async () => {
      console.log("🔴 TESTING VIOLATION DETECTION");
      console.log("Candidate ID:", candidateId);
      console.log("API Base:", API_BASE);
      
      // Create a simple test image
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = 'blue';
      ctx.font = '30px Arial';
      ctx.fillText('Test Face', 50, 100);
      const testImage = canvas.toDataURL('image/jpeg', 0.8);
      
      // Test head pose endpoint
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
      formData.append('file', dataURLtoBlob(testImage), 'test.jpg');
      formData.append('candidate_name', candidateName || 'test');
      formData.append('session_id', sessionId || 'test');
      
      try {
        console.log("📤 Sending test request to head pose endpoint...");
        const response = await fetch(`${API_BASE}/status/detect_head_pose`, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        console.log("✅ Head pose response:", data);
        
        // Check if violation is detected
        if (data.cheating === true || data.violation === true) {
          console.log("🚨 VIOLATION DETECTED IN TEST!");
          alert("Test violation detected! The backend is working correctly.");
        } else {
          console.log("No violation detected in test image");
        }
      } catch (error) {
        console.error("❌ Test failed:", error);
      }
    };
    
    // Run test after 3 seconds
    const timer = setTimeout(testViolation, 3000);
    return () => clearTimeout(timer);
  }, [candidateId, candidateName, sessionId]);
  
  return null;
}