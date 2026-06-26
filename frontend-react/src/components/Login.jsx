import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn as LoginIcon } from 'lucide-react';
import API from '../api';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const from = location.state?.from || '/tickets';

  const canSubmit = email.trim() && pass.trim() && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    const emailClean = email.trim();
    const passClean = pass.trim();
    
    if (!emailClean || !passClean) {
      setMsg({ type: 'err', text: 'Ingresá tu correo y contraseña.' });
      return;
    }

    if (passClean.length < 6) {
      setMsg({ type: 'err', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    try {
      setLoading(true);
      console.log('[Login] Enviando petición a /auth/login');

      const response = await API.post('/auth/login', {
        email: emailClean,
        password: passClean
      });

      console.log('[Login] Respuesta recibida:', response.status);

      if (!response.data?.token) {
        console.error('[Login] Token no encontrado en la respuesta');
        setMsg({ type: 'err', text: 'Respuesta inválida del servidor.' });
        return;
      }

      const token = response.data.token;
      console.log('[Login] Token recibido, guardando...');

      if (remember) {
        localStorage.setItem('token', token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', token);
        localStorage.removeItem('token');
      }

      if (login) {
        await login(token, { remember });
      }

      console.log('[Login] Redirigiendo a:', from);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('[Login] Error:', err);
      console.error('[Login] Response:', err.response);
      console.error('[Login] Data:', err.response?.data);

      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 401) {
        setMsg({ type: 'err', text: 'Contraseña incorrecta. Verificá tus credenciales.' });
      } else if (status === 404) {
        setMsg({ type: 'err', text: 'Usuario no encontrado. Verificá tu correo electrónico.' });
      } else if (status === 403) {
        setMsg({ type: 'err', text: data?.message || 'Cuenta desactivada. Contactá al administrador.' });
      } else {
        const text = data?.message || data?.error || 'No se pudo iniciar sesión. Intentá nuevamente.';
        setMsg({ type: 'err', text });
      }
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
            <div className="auth-title">Iniciar sesión</div>
            <div className="auth-sub">TareaSync • Gestión de tareas</div>
          </div>
        </div>

        {msg.text && (
          <div className={`auth-msg ${msg.type}`}>
            {msg.type === 'err' ? '✕' : '✓'} {msg.text}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-row">
            <label className="auth-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              className="auth-input"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="pass">Contraseña</label>
            <div className="input-wrap">
              <input
                id="pass"
                name="password"
                type={show ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShow(s => !s)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={loading}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-row inline">
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={loading}
              />
              Recordarme
            </label>
            <Link className="auth-link" to="/recuperar">¿Olvidaste la contraseña?</Link>
          </div>

          <button className="auth-btn" type="submit" disabled={!canSubmit}>
            {loading ? <Loader2 size={20} className="spin" /> : <LoginIcon size={20} />}
            {loading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>

        <div className="auth-foot">
          <span>¿No tenés cuenta?</span>
          <Link className="auth-link" to="/register">Crear cuenta</Link>
          <span className="auth-separator">•</span>
          <Link className="auth-link" to="/">Volver al inicio</Link>
        </div>

        <div className="auth-version">
          v{import.meta.env.VITE_VERSION || '1.0.0'}
        </div>
      </div>
    </div>
  );
}

export default Login;