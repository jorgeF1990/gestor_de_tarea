// src/pages/Login.jsx
import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as loginAPI } from '../api';
import { AuthContext } from '../context/AuthContext.jsx';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // loginAPI devuelve res.data (por el wrapper handle en src/api.js)
      const data = await loginAPI({ email, password });
      // data debe contener { token, usuario }
      if (!data || !data.token) throw new Error('No se recibió token desde el servidor');
      // Guardar token en el contexto (AuthContext.login debe manejar almacenamiento)
      login(data.token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const msg = err?.message || err?.detalle || (err?.error || 'Credenciales inválidas');
      setError(msg);
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
      <p className="forgot-password">
        <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
      <p className="app-version">Versión: {version}</p>
    </div>
  );
}