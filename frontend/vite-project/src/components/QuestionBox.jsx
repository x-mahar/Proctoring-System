export default function QuestionBox({ question, onNext }) {
  return (
    <div className="bg-white/10 rounded-xl p-8 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-white mb-6 text-left">Voice-Based Question</h2>
      <p className="text-lg text-white/90 mb-8 text-left flex-grow">{`Q${question.id}: ${question.question}`}</p>
      <div className="flex justify-end space-x-4">
        <button className="px-6 py-2 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition">
          🎤 Answer
        </button>
        <button 
          onClick={onNext} 
          className="px-6 py-2 font-semibold text-white bg-white/20 rounded-lg hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 transition"
        >
          Next ➡️
        </button>
      </div>
    </div>
  );
}
