import React, { useState, useEffect, useRef } from 'react';
import { checkUserIdExists } from './db';
import Cookies from 'js-cookie';

function Login({ goToRegister, onLogin, prefillUid, goToSendEmail }) {
  const [uid, setUid] = useState(prefillUid || '');
  const [loading, setLoading] = useState(false);
  const formRef = useRef();
  const [localUid, setLocalUid] = useState('');

  useEffect(() => {
    // Get the UID from local storage on mount or when prefillUid changes
    const storedUid = localStorage.getItem('study_tracker_uid') || '';
    setLocalUid(storedUid);
  }, [prefillUid]);

  useEffect(() => {
    if (prefillUid) {
      setUid(prefillUid);
    } else {
      setUid(''); // Clear input if prefillUid is cleared
    }
  }, [prefillUid]);

  useEffect(() => {
    if (prefillUid && uid === prefillUid && formRef.current) {
      // Auto-submit the form when prefillUid is set and matches uid
      formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    // eslint-disable-next-line
  }, [uid, prefillUid]);

  useEffect(() => {
    const savedUid = Cookies.get('study_tracker_uid');
    if (savedUid) {
      onLogin(savedUid);
    }
  }, []); // Add onLogin to deps if needed

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const exists = await checkUserIdExists(uid);
    if (exists) {
      if (onLogin) onLogin(uid);
    } else {
      alert("Invalid Unique ID. Please try again.");
    }
    setUid(''); // Clear the input after submit
    setLoading(false);
  };

  return (
    <div>
      {/* Show the local stored UID as heading if present */}
      {localUid && (
        <div style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1em', color: '#2d2d2d' }}>
          Your Saved Unique ID: {localUid}
        </div>
      )}
      <h2>Login</h2>
      <form onSubmit={handleSubmit} ref={formRef}>
        <div>
          <label>
            Unique ID:
            <input
              type="text"
              value={uid}
              onChange={e => setUid(e.target.value)}
              required
              disabled={loading}
            />
          </label>
        </div>
        <button type="submit" disabled={loading || !uid}>
          {loading ? "Logging in..." : "Submit"}
        </button>
      </form>
      <div style={{ marginTop: '1rem' }}>
        <span>Don't have an account? </span>
        <button type="button" onClick={goToRegister}>Go to Register</button>
      </div>
      {/* Only show the Send via Email button if no localUid exists */}
      {!localUid && (
        <div style={{ marginTop: '1rem' }}>
          <span>Can't get your Unique ID? </span>
          <button
            type="button"
            onClick={goToSendEmail}
            style={{ color: '#1976d2', textDecoration: 'underline', marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Send via Email
          </button>
        </div>
      )}
    </div>
  );
}

export default Login;
