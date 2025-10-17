import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

function Home() {
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null); 
  const [mensaje, setMensaje] = useState('');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

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
      setMensaje('✅ Ticket creado correctamente');
      setAsunto('');
      setDescripcion('');
      setImagen(null);
      setPreview(null); 
    } catch {
      setMensaje('❌ Error al crear el ticket');
    }
  };

  const handleImage = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImagen(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result); 
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🎫 Bienvenido al sistema de tickets</h2>
      <p>Gestioná tus solicitudes de soporte de forma rápida, segura y personalizada.</p>

      {!user ? (
        <div style={{ marginTop: '20px', background: '#f9f9f9', padding: '15px', border: '1px solid #ccc' }}>
          <p>🔒 Para crear un ticket necesitás estar logueado.</p>
          <Link to="/login">
            <button style={{ marginRight: '10px' }}>Iniciar sesión</button>
          </Link>
          <Link to="/register">
            <button>Registrarse</button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <input
            type="text"
            value={asunto}
            onChange={e => setAsunto(e.target.value)}
            placeholder="📝 Asunto"
            required
            style={{ display: 'block', marginBottom: '10px', width: '100%' }}
          />
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="📄 Descripción"
            required
            style={{ display: 'block', marginBottom: '10px', width: '100%', height: '100px' }}
          />

          <div
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
            style={{
              border: '2px dashed #ccc',
              padding: '2px',
              marginBottom: '11px',
              textAlign: 'center',
              backgroundColor: '#fafafa',
              cursor: 'pointer'
            }}
          >
            <input
              type="file"
              onChange={e => handleImage(e.target.files[0])}
              accept="image/*"
              style={{ display: 'block', margin: '10px auto' }}
            />
            {imagen && <p>✅ Imagen seleccionada: {imagen.name}</p>}
            {preview && (
              <img
                src={preview}
                alt="Vista previa"
                style={{ maxWidth: '100%', maxHeight: '200px', marginTop: '10px' }}
              />
            )}
          </div>

          <button type="submit">📤 Crear Ticket</button>
        </form>
      )}

      {mensaje && <p style={{ marginTop: '15px' }}>{mensaje}</p>}
    </div>
  );
}

export default Home;