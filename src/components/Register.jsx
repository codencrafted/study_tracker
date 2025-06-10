import React, { useState } from 'react';
// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, setDoc, query, where, getDocs } from "firebase/firestore"; 

// Firebase config
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

function Register({ goToLogin, onRegistered }) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Check if email already exists
      const q = query(collection(db, "study_tracker_user"), where("email", "==", form.email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert("This email is already registered.");
        setLoading(false);
        return;
      }
      // Add user to Firestore and save the unique id as a field
      const docRef = await addDoc(collection(db, "study_tracker_user"), {
        name: form.name,
        email: form.email,
        createdAt: new Date().toISOString()
      });
      // Update the same document to include the uid field
      await setDoc(doc(db, "study_tracker_user", docRef.id), {
        uid: docRef.id
      }, { merge: true });
      alert(`Registered! User ID: ${docRef.id}`);
      // Save unique id to local storage
      localStorage.setItem('study_tracker_uid', docRef.id);
      setForm({ name: '', email: '' });
      if (onRegistered) {
        onRegistered(docRef.id);
      }
    } catch (error) {
      alert("Error registering user: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </label>
        </div>
        <div>
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Submit"}
        </button>
      </form>
      <div style={{ marginTop: '1rem' }}>
        <span>Already have an account? </span>
        <button type="button" onClick={goToLogin}>Go to Login</button>
      </div>
    </div>
  );
}

export default Register;
