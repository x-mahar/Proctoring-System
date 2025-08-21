import { useEffect, useState } from "react";
import { questions } from "../utils/questions";
import WebcamFeed from "../components/WebcamFeed";
import ScreenShare from "../components/ScreenShare";
import QuestionBox from "../components/QuestionBox";
import PopupModal from "../components/PopupModal";
import CandidateInfo from "../components/CandidateInfo";
import { useNavigate } from "react-router-dom";
import useTabViolationDetection from "../hooks/useTabViolationDetection";
import { postJSON, postForm, API_BASE } from "../utils/api";
// Removed external stylesheet; using inline styles only

export default function Proctoring() {
  // Inline styles for UI panels and overlays (replacing Tailwind utility classes)
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const styles = {
    // Page chrome
    container: {
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0b1020 0%, #0b1426 40%, #0e182e 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden'
    },
    glowA: { position: 'absolute', top: -120, left: -80, width: 480, height: 480, borderRadius: '50%', filter: 'blur(80px)', background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.25), transparent 60%)', pointerEvents: 'none' },
    glowB: { position: 'absolute', top: -80, right: -120, width: 520, height: 520, borderRadius: '50%', filter: 'blur(90px)', background: 'radial-gradient(circle at 70% 30%, rgba(168,85,247,0.22), transparent 60%)', pointerEvents: 'none' },
    glowC: { position: 'absolute', bottom: -140, left: '20%', width: 600, height: 600, borderRadius: '50%', filter: 'blur(100px)', background: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.18), transparent 60%)', pointerEvents: 'none' },
    header: {
      padding: '16px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    },
    headerBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 18, fontWeight: 800, letterSpacing: 0.4, background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' },
    layout: {
      display: 'grid',
      gridTemplateColumns: isNarrow ? '1fr' : '1.2fr 1fr',
      gap: 16,
      padding: 16,
      flex: 1,
      minHeight: 0,
      alignItems: 'stretch'
    },
    leftPanel: { display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 },
    rightPanel: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
    panel: {
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: '#fff',
      boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
    },
    title: { fontSize: 22, fontWeight: 800, marginBottom: 20 },
    stack: { display: "flex", flexDirection: "column", gap: 16 },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "rgba(0,0,0,0.30)",
      borderRadius: 8,
      padding: 16,
    },
    rowLabel: { color: "rgba(255,255,255,0.8)" },
    statusPass: { color: "#4ade80", fontSize: 18, fontWeight: 600 },
    statusFail: { color: "#f87171", fontSize: 18, fontWeight: 600 },
    statusUnknown: { color: "#ffffff", fontSize: 18, fontWeight: 600 },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
    btnBase: { padding: '10px 14px', fontWeight: 700, borderRadius: 10, color: '#fff', boxShadow: '0 8px 18px rgba(0,0,0,0.25)', border: 'none', cursor: 'pointer' },
    btnPrimary: { padding: '10px 14px', fontWeight: 800, borderRadius: 10, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #3b82f6)', border: 'none', boxShadow: '0 12px 24px rgba(59,130,246,0.25)', cursor: 'pointer' },
    btnSecondary: { padding: '10px 14px', fontWeight: 700, borderRadius: 10, color: '#fff', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 8px 18px rgba(0,0,0,0.25)', cursor: 'pointer' },
    btnSuccess: { padding: '10px 14px', fontWeight: 800, borderRadius: 10, color: '#fff', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', boxShadow: '0 12px 24px rgba(16,163,74,0.25)', cursor: 'pointer' },
    list: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
    listItem: { padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8 },
    listItemTitle: { fontWeight: 600 },
    listItemMeta: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4 },
    smallBadge: { display: "inline-block", marginTop: 8, fontSize: 12, padding: "4px 8px", background: "rgba(234,179,8,0.7)", borderRadius: 6 },
    mt12: { marginTop: 12 },
    mb16: { marginBottom: 16 },
    // Disqualified overlay
    overlay: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
    overlayCard: { background: "rgba(220,38,38,0.92)", color: "#fff", maxWidth: 520, width: "100%", borderRadius: 16, padding: 28, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.35)" },
    overlayTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
    overlayBtn: { padding: '10px 14px', fontWeight: 700, borderRadius: 10, color: '#fff', background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer' },
  };
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
    if (id) setCandidateId(id);
    if (!sid) {
      sid = `${id || 'CAND'}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
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
          formData.append("timestamp", new Date().toISOString());
          await postForm("/frames/log_tab_violation", formData);
          const message = `Warning: You have switched tabs ${violationCount} time(s). Further violations may lead to disqualification.`;
          setPopupMessage(message);
          setPopupVisible(true);
        } catch (error) {
          console.error("Failed to log tab violation:", error);
        }
      }
      logViolation();
    }
  }, [violationCount, candidateId]);

  function nextQuestion() {
    setCurrentQuestionIndex((prev) => {
      if (prev < questions.length - 1) return prev + 1;
      alert("You have reached the end. Click Finish Test.");
      return prev;
    });
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
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = (payload && (payload.detail || payload.message || payload.error)) || `Failed to get result (${res.status})`;
        throw new Error(msg);
      }
      setFinalResult(payload);
      setShowResult(true);
    } catch (err) {
      alert(err.message || 'Failed to get result');
    }
  }

  return (
    <div style={styles.container}>
      {/* Candidate Header */}
      <div style={styles.glowA} />
      <div style={styles.glowB} />
      <div style={styles.glowC} />
      <header style={styles.header}>
        <div style={styles.headerBar}>
          <h1 style={styles.headerTitle}>Proctoring Dashboard</h1>
          <CandidateInfo name={candidateName} id={candidateId} />
        </div>
      </header>

      {/* Main Layout */}
      <main style={styles.layout}>
        <div style={styles.leftPanel}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <WebcamFeed 
            candidateId={candidateId}
            candidateName={candidateName}
            sessionId={sessionId}
            onViolation={(msg) => { setPopupMessage(msg); setPopupVisible(true); }} 
            onDisqualify={(msg) => {
              setDisqualified(true);
              setPopupMessage(msg);
              setPopupVisible(true);
            }}
            />
          </div>
          <ScreenShare candidateId={candidateId} />
        </div>

        <div style={styles.rightPanel}>
          {showResult ? (
            <div style={styles.panel}>
              <h2 style={styles.title}>Result Summary</h2>
              {(() => {
                // Build an abstracted summary: only pass/fail
                let status = null;
                const payload = finalResult;

                const asObj = (val) => (val && typeof val === 'object' ? val : null);
                const obj = asObj(payload);

                if (obj) {
                  const rawStatus = obj.pass ?? obj.passed ?? obj.result ?? obj.status ?? null;
                  if (typeof rawStatus === 'boolean') status = rawStatus ? 'Pass' : 'Fail';
                  else if (typeof rawStatus === 'string') {
                    const s = rawStatus.toLowerCase();
                    status = s.includes('pass') ? 'Pass' : (s.includes('fail') ? 'Fail' : null);
                  }
                } else if (typeof payload === 'string') {
                  const s = payload.toLowerCase();
                  if (s.includes('pass') || s.includes('passed')) status = 'Pass';
                  else if (s.includes('fail') || s.includes('failed')) status = 'Fail';
                }

                if (status == null) status = 'Unknown';

                return (
                  <div style={styles.stack}>
                    <div style={styles.row}>
                      <span style={styles.rowLabel}>Overall Status</span>
                      <span style={status === 'Pass' ? styles.statusPass : status === 'Fail' ? styles.statusFail : styles.statusUnknown}>{status}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={styles.actions}>
                <button style={styles.btnPrimary} onClick={refetchResult}>Get Result</button>
                <button style={styles.btnSecondary} onClick={() => navigate('/')}>Home</button>
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
              onFinishTest={(result) => {
                setFinalResult(result);
                setShowResult(true);
              }}
              onRequestReview={(items) => {
                setReviewItems(items);
                setIsReviewMode(true);
              }}
            />
          ) : (
            <div style={styles.panel}>
              <h2 style={styles.title}>Review Marked Questions</h2>
              {reviewItems.length === 0 ? (
                <p style={styles.mb16}>No questions marked for review.</p>
              ) : (
                <ul style={styles.list}>
                  {reviewItems.map((item) => (
                    <li key={item.question_id} style={styles.listItem}>
                      <div style={styles.listItemTitle}>Q{item.question_id}</div>
                      {item.user_answer && (
                        <div style={styles.listItemMeta}>Your answer: {item.user_answer}</div>
                      )}
                      {item.edited && (
                        <span style={styles.smallBadge}>edited</span>
                      )}
                      <div style={styles.mt12}>
                        <button
                          style={styles.btnPrimary}
                          onClick={() => {
                            const idx = questions.findIndex((q) => q.id === item.question_id);
                            if (idx >= 0) setCurrentQuestionIndex(idx);
                            setIsReviewMode(false);
                          }}
                        >
                          Go to Q{item.question_id}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div style={styles.actions}>
                <button style={styles.btnSecondary} onClick={() => setIsReviewMode(false)}>Back</button>
                <button style={styles.btnSuccess} onClick={finalizeSubmission}>Submit Final</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Popup Modal */}
      {popupVisible && (
        <PopupModal
          message={popupMessage}
          onClose={() => setPopupVisible(false)}
        />
      )}

      {/* Disqualified overlay */}
      {disqualified && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <h2 style={styles.overlayTitle}>Disqualified</h2>
            <p style={{ marginBottom: 16 }}>{popupMessage || "Test terminated due to policy violation."}</p>
            <button
              onClick={() => {
                // Optionally navigate home or keep overlay
                // navigate("/");
                setPopupVisible(false);
              }}
              style={styles.overlayBtn}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
