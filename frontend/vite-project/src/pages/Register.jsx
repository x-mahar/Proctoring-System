import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON, getJSON } from "../utils/api";

export default function Register() {
  const styles = {
    page: {
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      background: 'radial-gradient(1200px 600px at 10% 10%, rgba(99,102,241,0.18), transparent),\n                  radial-gradient(1200px 600px at 90% 20%, rgba(168,85,247,0.15), transparent),\n                  radial-gradient(1200px 600px at 10% 90%, rgba(59,130,246,0.12), transparent),\n                  #0b1020',
      color: '#fff'
    },
    card: {
      width: '100%',
      maxWidth: 540,
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 16
    },
    header: { marginBottom: 0 },
    title: { fontSize: 24, fontWeight: 800, marginBottom: 6 },
    subtitle: { color: 'rgba(255,255,255,0.85)' },
    inputWrap: { },
    label: { display: 'block', marginBottom: 8, fontWeight: 700 },
    input: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.25)',
      background: 'rgba(0,0,0,0.25)',
      color: '#fff',
      outline: 'none'
    },
    error: {
      color: 'rgb(252,165,165)',
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(248,113,113,0.35)',
      borderRadius: 10,
      padding: '8px 12px',
      marginTop: 0
    },
    button: {
      width: '100%',
      marginTop: 4,
      padding: '12px 16px',
      fontWeight: 800,
      borderRadius: 10,
      color: '#fff',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #3b82f6)',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 10px 20px rgba(0,0,0,0.25)'
    },
    buttonDisabled: {
      opacity: 0.7,
      cursor: 'not-allowed'
    },
    footer: { marginTop: 8, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }
  };
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState(true);
  const navigate = useNavigate();

  // Ping backend status once on mount to inform the user if server is down
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getJSON("/status/");
        if (mounted) setBackendOnline(true);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleRegister() {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const data = await postJSON("/register/", { name });
      localStorage.setItem("candidate_name", data.name);
      localStorage.setItem("candidate_id", data.candidate_id);
      navigate("/proctoring");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {!backendOnline && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(248,113,113,0.35)',
            color: 'rgb(252,165,165)',
            fontWeight: 600
          }}>
            Backend is not reachable. Please start the server at 127.0.0.1:8000 and try again.
          </div>
        )}
        <div style={styles.header}>
          <h2 style={styles.title}>🎯 Candidate Registration</h2>
          <p style={styles.subtitle}>Please enter your full name to start your proctoring session</p>
        </div>

        <div style={styles.inputWrap}>
          <label>
            <span style={styles.label}>Full Name</span>
            <input
              style={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              disabled={isLoading}
            />
          </label>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button 
          onClick={handleRegister} 
          style={{ ...styles.button, ...(isLoading ? styles.buttonDisabled : null) }} 
          disabled={isLoading}
        >
          {isLoading ? "Registering..." : "🚀 Start Session"}
        </button>

        <p style={styles.footer}>
          Your candidate ID will be generated automatically.
        </p>
      </div>
    </div>
  );
}
