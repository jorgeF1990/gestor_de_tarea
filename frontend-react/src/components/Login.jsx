import React, { useContext, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

const API = import.meta.env.VITE_BACKEND_URL;

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext); // ← usamos el contexto
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [show, setShow]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type:'', text:'' });

    if (!email.trim() || !pass.trim()) {
      setMsg({ type:'err', text:'Ingresá tu correo y contraseña.' });
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post(`${API}/auth/login`, { email, password: pass });

      if (!data?.token) {
        setMsg({ type:'err', text:'Respuesta inválida del servidor.' });
        return;
      }

      // 🔑 Guardar token en el contexto (esto dispara re-render global)
      await login(data.token, { remember });

      // (opcional) si querés seguir usando decode para alguna lógica local
      try {
        jwtDecode(data.token);
      } catch {}

      // 🧭 Ir al Home YA logueado (tu Home ya muestra crear ticket si hay user)
      navigate('/');

    } catch (err) {
      const text = err.response?.data?.error || 'No se pudo iniciar sesión.';
      setMsg({ type:'err', text });
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
            <div className="auth-title">Ingresar</div>
            <div className="auth-sub">Portfolio Investment • Sistema de Tickets</div>
          </div>
        </div>

        {msg.text && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <label className="auth-label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="pass">Contraseña</label>
            <div className="input-wrap">
              <input
                id="pass"
                type={show ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={pass}
                onChange={e=>setPass(e.target.value)}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={()=>setShow(s=>!s)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="auth-row inline">
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
              Recordarme
            </label>
            <Link className="auth-link" to="/recuperar">¿Olvidaste la contraseña?</Link>
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="loader" /> : 'Ingresar'}
          </button>
        </form>

        <div className="auth-foot">
          <span>¿No tenés cuenta?</span>
          <Link className="auth-link" to="/register">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
