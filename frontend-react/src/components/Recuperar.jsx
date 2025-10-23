import React, { useState } from 'react';
import { recuperarPassword } from '../api'; // Asegurate de tener esta función en tu archivo de API

function Recuperar() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const version = import.meta.env.VITE_VERSION;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await recuperarPassword(email);
      setMensaje(' Revisa tu Email para recuperar la contraseña');
    } catch {
      setMensaje(' Error al enviar el Email');
    }
  };

  return (
    <div className="login-container">
      <img src="/logo.png" alt="Logo" className="login-logo" />
      <h1 className="text-2xl font-bold text-black">Portfolio Investment</h1>
      <h2>🔐 Recuperar contraseña</h2>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder=" Email registrado"
          required
        />
        <div className="login-btn-wrapper">
          <button type="submit" className="home-btn">Send Link</button>
        </div>
      </form>
      {mensaje && <p>{mensaje}</p>}
      <p className="app-version">Versión: {version}</p>
    </div>
  );
}

export default Recuperar;