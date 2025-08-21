export default function PopupModal({ message, onClose }) {
  const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    card: { background: 'rgba(255,255,255,0.20)', borderRadius: 12, padding: 24, textAlign: 'center', color: '#fff', width: '100%', maxWidth: 420, boxShadow: '0 20px 40px rgba(0,0,0,0.35)' },
    text: { fontSize: 18, textAlign: 'left' },
    btn: { padding: '10px 16px', fontWeight: 700, color: '#fff', background: '#ec4899', border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: 16 }
  };
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.text}>
          {typeof message === 'string' ? (
            <p>{message}</p>
          ) : (
            message
          )}
        </div>
        <button 
          onClick={onClose}
          style={styles.btn}
        >
          Close
        </button>
      </div>
    </div>
  );
}
