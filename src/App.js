import './App.css';
import Register from './components/Register';
import Login from './components/Login';
import Homepage from './components/Homepage';
import SendEmail from './components/SendEmail';
import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

function App() {
  const [page, setPage] = useState('register');
  const [uid, setUid] = useState('');
  const [prefillUid, setPrefillUid] = useState('');

  // Check for existing login on mount
  useEffect(() => {
    const savedUid = Cookies.get('study_tracker_uid');
    if (savedUid) {
      setUid(savedUid);
      setPage('home');
    }
  }, []);

  const handleLogin = (userId) => {
    // Set cookie to expire in 7 days
    Cookies.set('study_tracker_uid', userId, { expires: 7 });
    setUid(userId);
    setPage('home');
  };

  const handleLogout = () => {
    Cookies.remove('study_tracker_uid');
    setUid('');
    setPrefillUid('');
    setPage('login');
  };

  const registerAndLogin = (newUid) => {
    setPrefillUid(newUid);
    setPage('login');
  };

  const goToRegister = () => {
    setPrefillUid('');
    setPage('register');
  };

  const goToSendEmail = () => {
    setPage('sendemail');
  };

  return (
    <div className="App">
      {page === 'register' ? (
        <Register goToLogin={() => setPage('login')} onRegistered={registerAndLogin} />
      ) : page === 'login' ? (
        <Login
          goToRegister={goToRegister}
          onLogin={handleLogin}
          prefillUid={prefillUid}
          goToSendEmail={goToSendEmail}
        />
      ) : page === 'sendemail' ? (
        <SendEmail 
          goToLogin={() => setPage('login')} 
          goToRegister={goToRegister}  // Add this line
        />
      ) : (
        <Homepage uid={uid} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
