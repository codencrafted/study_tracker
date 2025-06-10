import React, { useState } from 'react';
import { init, send } from '@emailjs/browser';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBaPuCdflLnZJkpEoEUZ6DTKCcQ9CmdLo4",
  authDomain: "turea-2452b.firebaseapp.com",
  projectId: "turea-2452b",
  storageBucket: "turea-2452b.firebasestorage.app",
  messagingSenderId: "406829970034",
  appId: "1:406829970034:web:807daf84c8b1f8bc5288eb",
  measurementId: "G-TWSJ9LVHX6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SERVICE_ID = 'service_krymvsp';
const TEMPLATE_ID = 'template_fhu65d3';
const PUBLIC_KEY = 'NhxlzrXx-jdlCNitq';

// Initialize EmailJS with your public key
init(PUBLIC_KEY);

function SendEmail({ goToLogin, goToRegister }) {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fetchUserIdByEmail = async (email) => {
    try {
      const q = query(collection(db, "study_tracker_user"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null; // Email not found
      }
      
      // Get the first matching document
      const userDoc = querySnapshot.docs[0];
      return userDoc.id; // This is the uid
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const uid = await fetchUserIdByEmail(email);
      if (!uid) {
        setError(
          <div>
            Email not found. Would you like to register? 
            <button 
              onClick={goToRegister}
              style={{ marginLeft: '8px', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Register Now
            </button>
          </div>
        );
        setSending(false);
        return;
      }

      // Create template parameters
      const templateParams = {
        from_name: "Study Tracker",
        to_email: email,
        to_name: email.split('@')[0], // Use part before @ as name
        subject: "Your Study Tracker ID",
        passcode: uid,
        time: new Date().toLocaleTimeString()
      };

      console.log('Sending with params:', templateParams);

      // Send email using EmailJS
      const result = await send(
        SERVICE_ID,
        TEMPLATE_ID,
        templateParams
      );

      if (result.status === 200) {
        setUserId(uid);
        setSubmitted(true);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (err) {
      console.error('EmailJS error:', err);
      setError(`Failed to send email: ${err.text || err.message || 'Unknown error'}`);
    }
    setSending(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      alert('User ID copied to clipboard!');
    } catch {
      alert('Failed to copy User ID. Please copy manually.');
    }
  };

  return (
    <div>
      <h2>Request Unique ID via Email</h2>
      {submitted ? (
        <div>
          <p>Your request has been submitted. Please check your email for your Unique ID.</p>
          <button onClick={goToLogin}>Back to Login</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <label>
              Email:
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={sending}
              />
            </label>
          </div>
          <button type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Submit'}
          </button>
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        </form>
      )}
      <div style={{ marginTop: '1rem' }}>
        <button onClick={goToLogin}>Back to Login</button>
      </div>
    </div>
  );
}

export default SendEmail;
