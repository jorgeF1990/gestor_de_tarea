import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api';
import './Register.css';

function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register({ nombre, email, password });
      navigate('/login');
    } catch {
      setError('❌ Error al registrar usuario');
    }
  };

  return (
    <div className="register-container">
      <img src="/logo.png" alt="Logo" className="register-logo" />
      <h1 className="text-2xl font-bold text-black">Portfolio Investment</h1>
      <h2>📝 Registro</h2>
      <p>Creá tu cuenta para comenzar a gestionar tus tickets de soporte.</p>

      <form onSubmit={handleSubmit} className="register-form">
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="👤 Full name"
          required
          autoComplete="name"
        />
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
          autoComplete="new-password"
        />
        <div className="register-btn-wrapper">
          <button type="submit" className="home-btn">✅ Register</button>
        </div>
      </form>

      {error && <p className="register-error">{error}</p>}
      <p className="app-version">Versión: {version}</p>
    </div>
  );
}

export default Register;
