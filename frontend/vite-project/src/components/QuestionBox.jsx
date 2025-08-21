import { useState, useEffect } from "react";
import useAudioRecording from "../hooks/useAudioRecording";
import { getJSON, API_BASE } from "../utils/api";

export default function QuestionBox({ question, onNext, candidateId, candidateName, sessionId, onFinishTest, isLastQuestion, onRequestReview }) {
  const { isRecording, audioBlob, startRecording, stopRecording } = useAudioRecording();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);

  useEffect(() => {
    if (audioBlob) {
      submitAnswer();
    }
  }, [audioBlob]);

  // Reset state when question changes
  useEffect(() => {
    setError("");
    setHasAnswered(false);
  }, [question?.id]);

  async function handleAnswerClick() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function handleMarkForReview() {
    try {
      if (!hasAnswered) {
        setError("Please answer before marking for review.");
        return;
      }
      if (!candidateId || !question?.id) {
        setError("Missing candidate or question information.");
        return;
      }

      // Use application/x-www-form-urlencoded as per API docs
      const params = new URLSearchParams();
      params.append("candidate_id", String(candidateId));
      params.append("question_id", String(Number(question.id)));
      if (sessionId) params.append("session_id", String(sessionId));

      console.log('mark_review payload (urlencoded):', params.toString());
      const res = await fetch(`${API_BASE}/questions/mark_review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        console.warn('mark_review urlencoded failed:', payload);
        if (res.status === 400) {
          // Fallback: try multipart/form-data
          const form = new FormData();
          form.append('candidate_id', String(candidateId));
          form.append('question_id', String(Number(question.id)));
          if (sessionId) form.append('session_id', String(sessionId));
          console.log('mark_review payload (multipart): candidate_id, question_id');
          const res2 = await fetch(`${API_BASE}/questions/mark_review`, { method: 'POST', body: form });
          const ct2 = res2.headers.get('content-type') || '';
          const payload2 = ct2.includes('application/json') ? await res2.json() : await res2.text();
          if (!res2.ok) {
            const msg2 = (payload2 && (payload2.detail || payload2.message || payload2.error)) || `Failed to mark for review (${res2.status})`;
            throw new Error(msg2);
          }
          return; // success on fallback
        } else {
          const msg = (payload && (payload.detail || payload.message || payload.error)) || `Failed to mark for review (${res.status})`;
          throw new Error(msg);
        }
      }
    } catch (e) {
      setError(e?.message || "Failed to mark for review");
    }
  }

  async function handleSkip() {
    try {
      setError("");
      if (!candidateId || !question?.id) {
        setError("Missing candidate or question information.");
        return;
      }

      const params = new URLSearchParams();
      params.append("candidate_id", String(candidateId));
      params.append("question_id", String(Number(question.id)));

      const res = await fetch(`${API_BASE}/questions/skip_question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = (payload && (payload.detail || payload.message || payload.error)) || `Failed to skip question (${res.status})`;
        throw new Error(msg);
      }

      if (typeof onNext === 'function') onNext();
    } catch (e) {
      setError(e?.message || "Failed to skip question");
    }
  }

  async function submitAnswer() {
    if (!audioBlob) return;
    setIsSubmitting(true);
    setError("");
    
    try {
      const formData = new FormData();
      formData.append("candidate_id", candidateId);
      formData.append("question_id", question.id);
      formData.append("expected_answer", question.expected_answer || question.answer);
      if (sessionId) formData.append("session_id", sessionId);
      
      // Validate audio blob before proceeding
      if (!audioBlob) {
        console.error('No audio blob available');
        setError('Please record an answer before submitting');
        return;
      }

      console.log('Audio blob size:', audioBlob.size, 'bytes');
      
      if (audioBlob.size === 0) {
        console.error('Empty audio blob');
        setError('The recorded audio is empty. Please try again.');
        return;
      }
      
      // Create a file with proper name and type
      const audioFile = new File([audioBlob], `recording_${candidateId}_q${question.id}.webm`, {
        type: 'audio/webm;codecs=opus'
      });
      formData.append("audio_file", audioFile);
      
      // Log form data for debugging
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, key === 'audio_file' ? `File(${value.size} bytes, ${value.type})` : value);
      }

      console.log('Sending request to server...');
      const response = await fetch(`${API_BASE}/questions/submit_answer`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        console.error('Server error:', responseData);
        throw new Error(responseData.detail || responseData.message || responseData.error || `Server error: ${response.status}`);
      }
      
      // Success: consider answered on any 200 response so Mark for Review is enabled
      setHasAnswered(true);
      return responseData;
      
    } catch (err) {
      console.error('Error in submitAnswer:', {
        error: err,
        message: err.message,
        stack: err.stack,
      });
      setError(err.message || "Failed to submit answer. Please try again.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinish() {
    setIsSubmitting(true);
    try {
      // Check if there are marked-for-review questions first
      const data = await getJSON(`/questions/get_review_questions?candidate_id=${encodeURIComponent(candidateId)}`);
      const list = Array.isArray(data?.review_questions) ? data.review_questions : [];
      if (list.length > 0 && typeof onRequestReview === 'function') {
        // Hand over to parent to review before final submission
        onRequestReview(list);
        return;
      }

      // No items to review -> finalize
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
      onFinishTest(payload);
    } catch (err) {
      setError(err.message || "Failed to finish.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Inline styles (UI only)
  // Define base button style separately to avoid referencing `styles` before it's initialized
  const btnBase = { padding: '12px 18px', fontSize: 16, fontWeight: 800, borderRadius: 12, color: '#fff', boxShadow: '0 8px 18px rgba(0,0,0,0.25)', border: 'none', cursor: 'pointer', fontFamily: "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif" };

  const styles = {
    rootWrap: { position: 'relative', height: '100%', width: '100%' },
    glow: {
      position: 'absolute', inset: 0, borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12), rgba(59,130,246,0.12))',
      filter: 'blur(24px)'
    },
    card: {
      position: 'relative', color: '#fff', borderRadius: 16, padding: '24px 24px 32px', height: '100%',
      background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden'
    },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    badges: { display: 'flex', alignItems: 'center', gap: 12 },
    badge: { padding: '6px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' },
    badgeState: (active) => ({
      padding: '6px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
      background: active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
      border: `1px solid ${active ? 'rgba(248,113,113,0.4)' : 'rgba(52,211,153,0.4)'}`,
      color: active ? 'rgb(254,202,202)' : 'rgb(209,250,229)'
    }),
    badgeInfo: { padding: '6px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: 'rgb(191,219,254)', display: 'inline-flex', alignItems: 'center', gap: 8 },
    tinySpinner: { height: 12, width: 12, border: '2px solid rgba(191,219,254,0.6)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' },
    title: { fontSize: 22, fontWeight: 800 },
    rule: { height: 1, width: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)', margin: '16px 0' },
    content: { flex: 1 },
    question: { textAlign: 'left', fontSize: 18, lineHeight: 1.6 },
    qnum: { marginRight: 8, color: 'rgba(255,255,255,0.6)' },
    qtext: { color: 'rgba(255,255,255,0.92)' },
    error: { color: 'rgb(252,165,165)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '8px 12px', marginTop: 12 },
    actions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, marginTop: 6, marginBottom: 16 },
    btnAnswer: (active) => ({
      ...btnBase,
      fontWeight: 800,
      background: active
        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
        : 'linear-gradient(135deg, #22c55e, #16a34a)'
    }),
    btnSkip: {
      ...btnBase,
      background: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    btnReview: (enabled) => ({
      ...btnBase,
      background: enabled
        ? 'linear-gradient(135deg, #eab308, #ca8a04)'
        : 'rgba(107,114,128,0.6)',
      cursor: enabled ? 'pointer' : 'not-allowed'
    }),
    btnFinish: { ...btnBase, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'inline-flex', alignItems: 'center', gap: 8 },
    btnNext: { ...btnBase, fontWeight: 800, background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    smSpinner: { height: 16, width: 16, border: '2px solid rgba(255,255,255,0.6)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }
  };

  return (
    <div style={styles.rootWrap}>
      <div style={styles.glow} />
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.badges}>
            <span style={styles.badge}>Voice Question</span>
            <span style={styles.badgeState(isRecording)}>{isRecording ? "Recording..." : "Ready"}</span>
            {isSubmitting && (
              <span style={styles.badgeInfo}>
                <span style={styles.tinySpinner} />
                Submitting
              </span>
            )}
          </div>
          <h2 style={styles.title}>Exam</h2>
        </div>

        <div style={styles.rule} />

        <div style={styles.content}>
          <p style={styles.question}>
            <span style={styles.qnum}>Q{question.id}:</span>
            <span style={styles.qtext}>{question.question}</span>
          </p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.rule} />

        <div style={styles.actions}>
          <button
            onClick={handleAnswerClick}
            disabled={isSubmitting}
            style={styles.btnAnswer(isRecording)}
          >
            {isSubmitting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={styles.smSpinner}></span>
                Submitting...
              </span>
            ) : (
              isRecording ? "⏹️ Stop" : "🎤 Answer"
            )}
          </button>
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            style={styles.btnSkip}
            title="Skip this question"
          >
            ⏭️ Skip
          </button>
          <button
            onClick={handleMarkForReview}
            disabled={!hasAnswered || isSubmitting}
            style={styles.btnReview(hasAnswered)}
            title={hasAnswered ? "Mark this question for review" : "Answer first to enable marking"}
          >
            🔖 Mark for Review
          </button>
          {isLastQuestion ? (
            <button onClick={handleFinish} disabled={isSubmitting} style={styles.btnFinish}>
              {isSubmitting ? (
                <>
                  <span style={styles.smSpinner}></span>
                  Finishing...
                </>
              ) : (
                <>🏁 Finish Test</>
              )}
            </button>
          ) : (
            <button onClick={onNext} disabled={isSubmitting} style={styles.btnNext}>
              Next ➡️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
