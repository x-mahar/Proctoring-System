import { useEffect, useState } from "react";
import { questions } from "../utils/questions";
import WebcamFeed from "../components/WebcamFeed";
import ScreenShare from "../components/ScreenShare";
import QuestionBox from "../components/QuestionBox";
import PopupModal from "../components/PopupModal";
import CandidateInfo from "../components/CandidateInfo";
import { useNavigate } from "react-router-dom";
import useTabViolationDetection from "../hooks/useTabViolationDetection";
import { postForm, API_BASE } from "../utils/api";

export default function Proctoring() {
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  const [monitorCollapsed, setMonitorCollapsed] = useState(false);

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupVisible, setPopupVisible] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [disqualified, setDisqualified] = useState(false);
  const { violationCount } = useTabViolationDetection();
  const navigate = useNavigate();

  useEffect(() => {
    const name = localStorage.getItem("candidate_name");
    const id = localStorage.getItem("candidate_id");
    let sid = localStorage.getItem("session_id");
    if (!name || !id) {
      alert("No candidate info found. Please register first.");
      navigate("/");
      return;
    }
    setCandidateName(name);
    setCandidateId(id);
    if (!sid) {
      sid = `${id}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
      localStorage.setItem("session_id", sid);
    }
    setSessionId(sid);
  }, [navigate]);

  useEffect(() => {
    if (violationCount > 0 && candidateId) {
      async function logViolation() {
        try {
          const formData = new FormData();
          formData.append("candidate_id", candidateId);
          formData.append("reason", "User switched tabs");
          await postForm("/frames/log_tab_violation", formData);
          setPopupMessage(`Warning: You have switched tabs ${violationCount} time(s).`);
          setPopupVisible(true);
        } catch (error) {
          console.error("Failed to log tab violation:", error);
        }
      }
      logViolation();
    }
  }, [violationCount, candidateId]);

  function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }

  async function finalizeSubmission() {
    try {
      const formData = new FormData();
      formData.append("candidate_id", candidateId);
      formData.append("candidate_name", candidateName);
      const result = await postForm("/questions/get_result", formData);
      setFinalResult(result);
      setShowResult(true);
      setIsReviewMode(false);
    } catch (err) {
      alert(err.message || "Failed to submit results");
    }
  }

  async function refetchResult() {
    try {
      const params = new URLSearchParams();
      params.append("candidate_id", String(candidateId));
      params.append("candidate_name", String(candidateName));
      const res = await fetch(`${API_BASE}/questions/get_result`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || "Failed to get result");
      setFinalResult(payload);
      setShowResult(true);
    } catch (err) {
      alert(err.message);
    }
  }

  const handleViolation = (msg) => {
    setPopupMessage(msg);
    setPopupVisible(true);
  };

  const handleDisqualify = (msg) => {
    setDisqualified(true);
    setPopupMessage(msg);
    setPopupVisible(true);
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0b1020 0%, #0b1426 40%, #0e182e 100%)',
      color: '#fff',
      overflow: 'hidden',
      boxSizing: 'border-box',
      position: 'relative',
      fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
    }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: -120, left: -80, width: 480, height: 480, borderRadius: '50%', filter: 'blur(80px)', background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -140, right: '10%', width: 600, height: 600, borderRadius: '50%', filter: 'blur(100px)', background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 60%)', pointerEvents: 'none' }} />

      {/* ── HEADER ── */}
      <header style={{
        padding: '10px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{
            fontSize: 16,
            fontWeight: 800,
            background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
          }}>
            🎓 Interview Prep — Aptitude Test
          </h1>
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '3px 10px',
          }}>
            Question {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>
        <CandidateInfo name={candidateName} id={candidateId} />
      </header>

      {/* ── BODY ── */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        flexDirection: isNarrow ? 'column' : 'row',
      }}>

        {/* ── MAIN QUESTION AREA ── */}
        <div style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          padding: isNarrow ? '12px' : '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {showResult ? (
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Result Summary</h2>
              {(() => {
                let status = null;
                if (finalResult && typeof finalResult === "object") {
                  const raw = finalResult.pass ?? finalResult.passed ?? finalResult.result ?? finalResult.status;
                  if (typeof raw === "boolean") status = raw ? "Pass" : "Fail";
                  else if (typeof raw === "string")
                    status = raw.toLowerCase().includes("pass") ? "Pass" : "Fail";
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '14px 20px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>Overall Status</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: status === "Pass" ? "#4ade80" : "#f87171" }}>
                      {status || "Unknown"}
                    </span>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 12, marginTop: 'auto', justifyContent: 'flex-end' }}>
                <button onClick={refetchResult} style={btnStyle('primary')}>Get Result</button>
                <button onClick={() => navigate("/")} style={btnStyle('secondary')}>Home</button>
              </div>
            </div>
          ) : !isReviewMode ? (
            <QuestionBox
              question={questions[currentQuestionIndex]}
              onNext={nextQuestion}
              candidateId={candidateId}
              candidateName={candidateName}
              sessionId={sessionId}
              isLastQuestion={currentQuestionIndex === questions.length - 1}
              onFinishTest={(result) => { setFinalResult(result); setShowResult(true); }}
              onRequestReview={(items) => { setReviewItems(items); setIsReviewMode(true); }}
            />
          ) : (
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Review Marked Questions</h2>
              {reviewItems.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>No questions marked for review.</p>
              ) : (
                <>
                  <ul style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0, margin: 0, marginBottom: 16 }}>
                    {reviewItems.map((item) => (
                      <li key={item.question_id} style={{ padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                        <div style={{ fontWeight: 600 }}>Question {item.question_id}</div>
                        {item.user_answer && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Your answer: {item.user_answer}</div>}
                        <button
                          style={{ ...btnStyle('primary'), marginTop: 10, padding: '7px 14px', fontSize: 13 }}
                          onClick={() => {
                            const idx = questions.findIndex((q) => q.id === item.question_id);
                            if (idx >= 0) setCurrentQuestionIndex(idx);
                            setIsReviewMode(false);
                          }}
                        >
                          Go to Question
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button style={btnStyle('secondary')} onClick={() => setIsReviewMode(false)}>Back</button>
                    <button style={btnStyle('success')} onClick={finalizeSubmission}>Submit Final</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── MONITORING SIDEBAR (right) ── */}
        <div style={{
          width: monitorCollapsed ? 36 : (isNarrow ? '100%' : 240),
          minWidth: monitorCollapsed ? 36 : undefined,
          maxWidth: monitorCollapsed ? 36 : (isNarrow ? '100%' : 240),
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: isNarrow ? 'none' : '1px solid rgba(255,255,255,0.07)',
          borderTop: isNarrow ? '1px solid rgba(255,255,255,0.07)' : 'none',
          background: 'rgba(0,0,0,0.25)',
          transition: 'width 0.3s ease, max-width 0.3s ease',
          overflow: 'hidden',
          zIndex: 5,
        }}>

          {/* Sidebar header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: monitorCollapsed ? 'center' : 'space-between',
            padding: monitorCollapsed ? '10px 0' : '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}>
            {!monitorCollapsed && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                Proctoring
              </span>
            )}
            <button
              onClick={() => setMonitorCollapsed(!monitorCollapsed)}
              title={monitorCollapsed ? 'Show monitoring' : 'Hide monitoring'}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                flexShrink: 0,
                padding: 0,
              }}
            >
              {monitorCollapsed ? '◀' : '▶'}
            </button>
          </div>

          {/* Expanded sidebar content */}
          {!monitorCollapsed && (
            <div style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 10,
            }}>

              {/* ── Camera widget ── */}
              <div style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.09)',
                background: '#000',
                flexShrink: 0,
              }}>
                <div style={{
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.45)',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  letterSpacing: 0.5,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  CAMERA LIVE
                </div>
                <div style={{ height: 155, overflow: 'hidden' }}>
                  <WebcamFeed
                    candidateId={candidateId}
                    candidateName={candidateName}
                    sessionId={sessionId}
                    onViolation={handleViolation}
                    onDisqualify={handleDisqualify}
                  />
                </div>
              </div>

              {/* ── Screen share widget ── */}
              <div style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.09)',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <ScreenShare candidateId={candidateId} compact />
              </div>

              {/* ── Violation badge ── */}
              {violationCount > 0 && (
                <div style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  fontSize: 11,
                  color: 'rgb(254,202,202)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  ⚠️ {violationCount} tab violation{violationCount > 1 ? 's' : ''} detected
                </div>
              )}
            </div>
          )}

          {/* Collapsed icons */}
          {monitorCollapsed && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              fontSize: 15,
            }}>
              <span title="Camera">📷</span>
              <span title="Screen Share">🖥️</span>
              {violationCount > 0 && (
                <span title={`${violationCount} violations`} style={{ color: '#f87171' }}>⚠️</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Popup ── */}
      {popupVisible && (
        <PopupModal message={popupMessage} onClose={() => setPopupVisible(false)} />
      )}

      {/* ── Disqualified overlay ── */}
      {disqualified && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'rgba(220,38,38,0.92)', color: '#fff', maxWidth: 520, width: '100%', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Disqualified</h2>
            <p>{popupMessage}</p>
            <button
              onClick={() => { localStorage.clear(); navigate("/"); }}
              style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 10, color: '#fff', background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Button style helper ──
function btnStyle(variant) {
  const base = {
    padding: '10px 18px',
    fontWeight: 700,
    borderRadius: 10,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
  };
  if (variant === 'primary')   return { ...base, background: 'linear-gradient(135deg, #6366f1, #3b82f6)' };
  if (variant === 'secondary') return { ...base, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' };
  if (variant === 'success')   return { ...base, background: 'linear-gradient(135deg, #22c55e, #16a34a)' };
  return base;
}