import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api';

function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register({ nombre, email, password });
      navigate('/login');
    } catch {
      setError('Error al registrar usuario');
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" required autoComplete="name" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" required autoComplete="email" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required autoComplete="new-password" />
        <button type="submit">Registrarse</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default Register;