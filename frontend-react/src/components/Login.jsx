import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginAPI } from '../api';
import { AuthContext } from '../context/AuthContext.jsx';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await loginAPI({ email, password });
      login(res.data.token);
      navigate('/dashboard');
    } catch {
      setError('❌ Invalid Credentials');
    }
  };

  return (
    <div className="login-container">
      <img src="/logo.png" alt="Logo" className="login-logo" />
      <h1 className="text-2xl font-bold text-black">Portfolio Investment</h1>
      <h2>🔐 Iniciar sesión</h2>
      <p>Accedé a tu cuenta para gestionar tus tickets de soporte.</p>

      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="📧 Email"
          required
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="🔑 Password"
          required
          autoComplete="current-password"
        />
        <div className="login-btn-wrapper">
          <button type="submit" className="home-btn">➡️ Login</button>
        </div>
      </form>

      {error && <p className="login-error">{error}</p>}
      <p className="app-version">Versión: {version}</p>

    </div>
  );
}

export default Login;
