import React, { useMemo, useState } from 'react';
import API from '../api';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';


export default function Register() {
  const navigate = useNavigate();

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [confirm, setConfirm] = useState('');

  const [show1, setShow1]     = useState(false);
  const [show2, setShow2]     = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ type: '', text: '' });

  // Indicador simple de fortaleza
  const strength = useMemo(() => {
    const p = pass || '';
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  }, [pass]);

  const strengthLabel = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][strength] || 'Muy débil';

  const validate = () => {
    if (!name.trim()) return 'Ingresá tu nombre.';
    if (!email.trim()) return 'Ingresá tu correo.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Ingresá un correo válido.';
    if (!pass) return 'Ingresá una contraseña.';
    if (pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (pass !== confirm) return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type:'', text:'' });

    const err = validate();
    if (err) { setMsg({ type:'err', text: err }); return; }

    try {
      setLoading(true);

      // 1) Registrar
      await API.post(`${API}/auth/register`, {
        nombre: name,      // si tu backend espera "nombre"
        email,
        password: pass
      });

      // 2) Auto-login para obtener token
      const { data } = await API.post(`${API}/auth/login`, { email, password: pass });
      if (!data?.token) {
        setMsg({ type:'err', text:'No se pudo iniciar sesión automáticamente. Ingresá manualmente.' });
        navigate('/login');
        return;
      }

      // 3) Guardar token en storage elegido
      if (remember) {
        localStorage.setItem('token', data.token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', data.token);
        localStorage.removeItem('token');
      }

      // 4) Redirigir según rol y forzar re-render global con storage event
      try {
        jwtDecode(data.token); // valida sintaxis
      } catch { /* ignore */ }

      // Dispara un evento para que otros componentes reactualicen estado de auth
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: data.token }));

      setMsg({ type:'ok', text:'Cuenta creada. Redirigiendo…' });
      // Ir al Home (tu Home ya muestra crear ticket si hay token)
      navigate('/');
    } catch (error) {
      const text = error?.response?.data?.error || 'No se pudo crear la cuenta.';
      setMsg({ type:'err', text });
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
            <div className="auth-title">Crear cuenta</div>
            <div className="auth-sub">TaskNest• Sistema de Tareas</div>
          </div>
        </div>

        {msg.text && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <label className="auth-label" htmlFor="name">Nombre</label>
            <input
              id="name"
              type="text"
              className="auth-input"
              placeholder="Tu nombre"
              value={name}
              onChange={e=>setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="pass">Contraseña</label>
            <div className="input-wrap">
              <input
                id="pass"
                type={show1 ? 'text' : 'password'}
                className="auth-input"
                placeholder="Mínimo 8 caracteres"
                value={pass}
                onChange={e=>setPass(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={()=>setShow1(s=>!s)}
                aria-label={show1 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show1 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show1 ? '🙈' : '👁️'}
              </button>
            </div>

            <div className="pw-strength">
              <div className={`bar ${strength >= 1 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 2 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 3 ? 'on' : ''}`} />
              <div className={`bar ${strength >= 4 ? 'on' : ''}`} />
              <span className="label">{strengthLabel}</span>
            </div>
          </div>

          <div className="auth-row">
            <label className="auth-label" htmlFor="conf">Confirmar contraseña</label>
            <div className="input-wrap">
              <input
                id="conf"
                type={show2 ? 'text' : 'password'}
                className="auth-input"
                placeholder="Repetí la contraseña"
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={()=>setShow2(s=>!s)}
                aria-label={show2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={show2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show2 ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="auth-row inline">
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
              Recordarme
            </label>
            <Link className="auth-link" to="/login">¿Ya tenés cuenta? Ingresar</Link>
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="loader" /> : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-foot">
          <Link className="auth-link" to="/">Volver al Home</Link>
        </div>
      </div>
    </div>
  );
}

