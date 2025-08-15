import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles.css"; // Make sure to import your stylesheet

export default function Register() {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  function generateCandidateId(name) {
    const timestamp = Date.now().toString().slice(-5);
    const initials = name
      .split(" ")
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");
    return `${initials}_${timestamp}`;
  }

  function handleRegister() {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    const candidateId = generateCandidateId(name);
    localStorage.setItem("candidate_name", name);
    localStorage.setItem("candidate_id", candidateId);
    navigate("/proctoring");
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <h2>🎯 Candidate Registration</h2>
          <p>Please enter your full name to start your proctoring session</p>
        </div>

        <div className="register-input">
          <label>
            <span>Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </label>
        </div>

        <button onClick={handleRegister} className="register-button">
          🚀 Start Session
        </button>

        <p className="register-footer">
          Your candidate ID will be generated automatically.
        </p>
      </div>
    </div>
  );
}
