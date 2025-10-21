import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Home.css';

function Home() {
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null); 
  const [mensaje, setMensaje] = useState('');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;


  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const formData = new FormData();
    formData.append('asunto', asunto);
    formData.append('descripcion', descripcion);
    if (imagen) formData.append('imagen', imagen);

    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/tickets`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setMensaje('✅ New Ticket Created Successfully');
      setAsunto('');
      setDescripcion('');
      setImagen(null);
      setPreview(null); 
    } catch {
      setMensaje(' Error creating the ticket!');
    }
  };

  const handleImage = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImagen(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result); 
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="home-container">
      <img src="/logo.png" alt="Logo" className="home-logo" />
      <h1 className="text-2xl font-bold text-black">Portfolio Investment</h1>

      <h2>🎫 Bienvenido al sistema de tickets</h2>
      <p>Gestioná tus solicitudes de soporte de forma rápida, segura y personalizada.</p>

      {!user ? (
        <div className="home-alert">
          <p>🔒 Para crear un ticket necesitás estar logueado.</p>
          <Link to="/login"><button className="home-btn">Login</button></Link>
          <Link to="/register"><button className="home-btn">Register</button></Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="home-form">
          <input
            type="text"
            value={asunto}
            onChange={e => setAsunto(e.target.value)}
            placeholder="📝 Asunto"
            required
          />
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="📄 Descripción"
            required
          />

          <div
            className="dropzone"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              handleImage(file);
            }}
            onPaste={e => {
              const item = e.clipboardData.items[0];
              if (item && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                handleImage(blob);
              }
            }}
          >
            <input
              type="file"
              onChange={e => handleImage(e.target.files[0])}
              accept="image/*"
            />
            {imagen && <p>✅ Selected Image: {imagen.name}</p>}
            {preview && <img src={preview} alt="Preview" />}
          </div>

          <button type="submit" className="home-btn">📤 Create Ticket</button>
        </form>
      )}

      {mensaje && (
        <p className={mensaje.includes('✅') ? 'success-message' : 'error-message'}>
          {mensaje}
        </p>
      )}
      <p className="app-version">Versión: {version}</p>

    </div>
  );
}

export default Home;