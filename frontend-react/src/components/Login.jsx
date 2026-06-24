// frontend-react/src/components/Login.jsx
import React, { useContext, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

const API = import.meta.env.VITE_BACKEND_URL || '';

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [show, setShow]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const canSubmit = email.trim() && pass.trim() && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type:'', text:'' });

    const emailClean = email.trim();
    const passClean  = pass.trim();
    if (!emailClean || !passClean) {
      setMsg({ type:'err', text:'Ingresá tu correo y contraseña.' });
      return;
    }

    try {
      setLoading(true);
      console.log('Enviando petición a:', `${API}/auth/login`);
      console.log('Email:', emailClean);
      
      const response = await axios.post(`${API}/auth/login`, 
        { email: emailClean, password: passClean },
        { withCredentials: false }
      );

      console.log('Respuesta completa:', response);
      console.log('Data:', response.data);
      console.log('Token:', response.data?.token);

      if (!response.data?.token) {
        console.error('Token no encontrado en la respuesta');
        setMsg({ type:'err', text:'Respuesta inválida del servidor.' });
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem('token', response.data.token);
      console.log('Token guardado en localStorage');

      // Guarda token vía contexto
      if (login) {
        await login(response.data.token, { remember });
      }

      // Redirigir
      navigate('/tickets');
    } catch (err) {
      console.error('Error en login:', err);
      console.error('Response:', err.response);
      console.error('Data:', err.response?.data);
      
      if (err?.response?.status === 404) {
        setMsg({
          type:'err',
          text:`No se encontró la ruta de login. Verificá que el backend exponga POST ${API}/auth/login`
        });
      } else {
        const text = err.response?.data?.message || err.response?.data?.error || 'No se pudo iniciar sesión.';
        setMsg({ type:'err', text });
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
            <div className="auth-title">Ingresar</div>
            <div className="auth-sub">TareaSync • Sistema de Tareas</div>
          </div>
        </div>

        {msg.text && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-row">
            <label className="auth-label" htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              className="auth-input"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
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
                onChange={e=>setPass(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
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
              <input
                type="checkbox"
                checked={remember}
                onChange={e=>setRemember(e.target.checked)}
              />
              Recordarme
            </label>
            <Link className="auth-link" to="/recuperar">¿Olvidaste la contraseña?</Link>
          </div>

          <button className="auth-btn" type="submit" disabled={!canSubmit}>
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