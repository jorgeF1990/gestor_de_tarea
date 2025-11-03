// src/components/ResetPassword.jsx
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../api'; // Debe exportar: resetPassword(token, newPassword)
import './Auth.css';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show1, setShow1]       = useState(false);
  const [show2, setShow2]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState(null); // { type: 'ok'|'error', message: string }

  const strength = useMemo(() => {
    // Indicador simple de fortaleza
    const p = password || '';
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4); // 0..4
  }, [password]);

  const strengthLabel = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][strength] || 'Muy débil';

  const validate = () => {
    if (!token) return 'El enlace no es válido.';
    if (!password || !confirm) return 'Ambos campos son obligatorios.';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    return null;
  };

  const canSubmit = useMemo(() => !validate(), [password, confirm, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    const err = validate();
    if (err) {
      setStatus({ type: 'error', message: err });
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setStatus({ type: 'ok', message: res?.message || 'Contraseña actualizada correctamente.' });
      // Pequeña pausa para que el usuario lea el mensaje y redirigir
      setTimeout(() => navigate('/login'), 1800);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Error al actualizar la contraseña. El enlace podría haber expirado.';
      setStatus({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <img src="/logo.png" alt="Logo" className="auth-logo" />
          <div>
            <div className="auth-title">Restablecer contraseña</div>
            <div className="auth-sub">Ingresá tu nueva contraseña</div>
          </div>
        </div>

        {status?.message && (
          <div className={`auth-msg ${status.type === 'ok' ? 'ok' : 'err'}`}>
            {status.message}
          </div>
        )}

        {!token && (
          <div className="auth-msg err" style={{ marginTop: 12 }}>
            Enlace inválido. Pedí uno nuevo desde <Link className="auth-link" to="/recuperar">Recuperar</Link>.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <label className="auth-label" htmlFor="newpass">Nueva contraseña</label>
            <div className="input-wrap">
              <input
                id="newpass"
                type={show1 ? 'text' : 'password'}
                className="auth-input"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShow1((s) => !s)}
                aria-label={show1 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show1 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show1 ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Indicador de fortaleza */}
            <div className="pw-strength">
              <div className={`bar ${strength >= 1 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 2 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 3 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 4 ? 'on' : ''}`} />
              <span className="label">{strengthLabel}</span>
            </div>
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="confirmpass">Confirmar contraseña</label>
            <div className="input-wrap">
              <input
                id="confirmpass"
                type={show2 ? 'text' : 'password'}
                className="auth-input"
                placeholder="Repetí la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShow2((s) => !s)}
                aria-label={show2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show2 ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button className="auth-btn" type="submit" disabled={!canSubmit || loading}>
            {loading ? <span className="loader" /> : 'Restablecer contraseña'}
          </button>
        </form>

        <div className="auth-foot">
          <Link className="auth-link" to="/login">Volver a Ingresar</Link>
          <span style={{ opacity:.5, margin: '0 .5rem' }}>•</span>
          <Link className="auth-link" to="/recuperar">Solicitar nuevo enlace</Link>
        </div>
      </div>
    </div>
  );
}
