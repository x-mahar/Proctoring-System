export default function CandidateInfo({ name, id }) {
  function clearRegistration() {
    if (window.confirm("Are you sure you want to end the session?")) {
      localStorage.removeItem("candidate_name");
      localStorage.removeItem("candidate_id");
      window.location.href = "/";
    }
  }

  return (
    <div className="flex justify-between items-center w-full">
      <div>
        <h3 className="text-2xl font-bold text-white">Welcome, {name}</h3>
        <p className="text-sm text-white/80">ID: {id}</p>
      </div>
      <button 
        onClick={clearRegistration} 
        className="px-4 py-2 font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
      >
        End Session
      </button>
    </div>
  );
}
