import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { recuperarPassword } from '../api';
import './Auth.css';

function Recuperar() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const version = import.meta.env.VITE_VERSION;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setLoading(true);

    if (!email.trim()) {
      setMensaje('Por favor, ingresá tu correo electrónico.');
      setLoading(false);
      return;
    }

    try {
      await recuperarPassword(email.trim());
      setMensaje('Revisá tu email para recuperar la contraseña.');
      setEmail('');
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'Error al enviar el email.';
      setMensaje(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <img src="/logo.svg" alt="Logo" className="auth-logo" />
          <div>
            <div className="auth-title">Recuperar contraseña</div>
            <div className="auth-sub">TareaSync • Sistema de Tareas</div>
          </div>
        </div>

        {mensaje && (
          <div className={`auth-msg ${mensaje.includes('Revisá') ? 'ok' : 'err'}`}>
            {mensaje}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <label className="auth-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
              disabled={loading}
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="loader" /> : 'Enviar enlace'}
          </button>
        </form>

        <div className="auth-foot">
          <Link className="auth-link" to="/login">Volver a Iniciar sesión</Link>
          <span className="auth-separator">•</span>
          <Link className="auth-link" to="/register">Crear cuenta</Link>
        </div>

        <div className="auth-version">Versión: {version}</div>
      </div>
    </div>
  );
}

export default Recuperar;