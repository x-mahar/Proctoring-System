export default function ScreenShare() {
  async function startScreenRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      alert("Screen share started!");
      // Add recording logic
    } catch (err) {
      alert("Screen share permission denied.");
    }
  }

  return (
    <div className="bg-white/10 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Screen Sharing</h3>
      <div className="w-full h-44 bg-black/20 rounded-lg flex items-center justify-center">
        <p className="text-white/70">Your screen will be displayed here.</p>
      </div>
      <button 
        onClick={startScreenRecording} 
        className="w-full py-2 font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
      >
        Start Screen Share
      </button>
    </div>
  );
}
