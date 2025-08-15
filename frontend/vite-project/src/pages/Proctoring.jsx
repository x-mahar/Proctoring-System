import { useEffect, useState } from "react";
import { questions } from "../utils/questions";
import WebcamFeed from "../components/WebcamFeed";
import ScreenShare from "../components/ScreenShare";
import QuestionBox from "../components/QuestionBox";
import PopupModal from "../components/PopupModal";
import CandidateInfo from "../components/CandidateInfo";
import { useNavigate } from "react-router-dom";
import "./Proctoring.css";// Custom stylesheet

export default function Proctoring() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupVisible, setPopupVisible] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateId, setCandidateId] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const name = localStorage.getItem("candidate_name");
    const id = localStorage.getItem("candidate_id");

    if (!name || !id) {
      alert("No candidate info found. Please register first.");
      navigate("/");
      return;
    }
    setCandidateName(name);
    setCandidateId(id);
  }, []);

  function nextQuestion() {
    setCurrentQuestionIndex((prev) => {
      if (prev < questions.length - 1) return prev + 1;
      alert("You have reached the end. Click Finish Test.");
      return prev;
    });
  }

  return (
    <div className="proctoring-container">
      {/* Candidate Header */}
      <header className="candidate-header">
        <CandidateInfo name={candidateName} id={candidateId} />
      </header>

      {/* Main Layout */}
      <main className="proctoring-layout">
        <div className="left-panel">
          <WebcamFeed candidateId={candidateId} />
          <ScreenShare />
        </div>

        <div className="right-panel">
          <QuestionBox
            question={questions[currentQuestionIndex]}
            onNext={nextQuestion}
          />
        </div>
      </main>

      {/* Popup Modal */}
      {popupVisible && (
        <PopupModal
          message={popupMessage}
          onClose={() => setPopupVisible(false)}
        />
      )}
    </div>
  );
}
