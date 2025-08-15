export default function PopupModal({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/20 rounded-xl p-8 space-y-6 text-center shadow-lg max-w-sm w-full">
        <p className="text-lg text-white">{message}</p>
        <button 
          onClick={onClose} 
          className="px-6 py-2 font-semibold text-white bg-pink-500 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
