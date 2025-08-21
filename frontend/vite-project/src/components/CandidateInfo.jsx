export default function CandidateInfo({ name, id }) {
  const styles = {
    wrap: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    name: { fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 },
    id: { fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0 },
    btn: { padding: '8px 16px', fontWeight: 700, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 10, cursor: 'pointer' }
  };
  function clearRegistration() {
    if (window.confirm("Are you sure you want to end the session?")) {
      localStorage.removeItem("candidate_name");
      localStorage.removeItem("candidate_id");
      window.location.href = "/";
    }
  }

  return (
    <div style={styles.wrap}>
      <div>
        <h3 style={styles.name}>Welcome, {name}</h3>
        <p style={styles.id}>ID: {id}</p>
      </div>
      <button 
        onClick={clearRegistration}
        style={styles.btn}
      >
        End Session
      </button>
    </div>
  );
}
