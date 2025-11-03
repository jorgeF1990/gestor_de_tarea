import React, { useState, useContext, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import "./Home.css";

const MAX_ASUNTO = 120;
const MAX_DESC = 1000;

function Home() {
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setAsunto("");
    setDescripcion("");
    setImagen(null);
    setPreview(null);
  };

  const handleImage = (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setMensaje("Solo se permiten imágenes.");
      return;
    }
    setImagen(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleImage(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type?.startsWith("image/")) {
        const blob = items[i].getAsFile();
        handleImage(blob);
        break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    if (!asunto.trim() || !descripcion.trim()) {
      setMensaje("Completá asunto y descripción.");
      return;
    }

    const formData = new FormData();
    formData.append("asunto", asunto.trim());
    formData.append("descripcion", descripcion.trim());
    if (imagen) formData.append("imagen", imagen);

    try {
      setLoading(true);
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/tickets`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMensaje("✅ Ticket creado con éxito");
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Ocurrió un error al crear el ticket";
      setMensaje(`⛔ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <div className="home-card">
        <div className="home-header">
          <img src="/logo.png" alt="Logo" className="home-logo" />
          <div>
            <h1 className="home-title">Portfolio Investment</h1>
            <p className="home-subtitle">Sistema de Tickets</p>
          </div>
        </div>

        {!user ? (
          <div className="home-auth-cta">
            <h2>Bienvenido 👋</h2>
            <p>Para crear un ticket necesitás iniciar sesión.</p>
            <div className="home-auth-buttons">
              <Link to="/login" className="btn btn-primary">Login</Link>
              <Link to="/register" className="btn btn-secondary">Register</Link>
            </div>
          </div>
        ) : (
          <>
            <h2 className="home-section-title">Crear nuevo ticket</h2>
            <form className="home-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="asunto">Asunto</label>
                <input
                  id="asunto"
                  type="text"
                  value={asunto}
                  onChange={(e) =>
                    setAsunto(e.target.value.slice(0, MAX_ASUNTO))
                  }
                  placeholder="Ej.: No puedo acceder a mi cuenta"
                  maxLength={MAX_ASUNTO}
                  disabled={loading}
                  required
                />
                <div className="counter">
                  {asunto.length}/{MAX_ASUNTO}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="descripcion">Descripción</label>
                <textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) =>
                    setDescripcion(e.target.value.slice(0, MAX_DESC))
                  }
                  placeholder="Contanos qué sucede, pasos para reproducir, capturas, etc."
                  rows={6}
                  maxLength={MAX_DESC}
                  disabled={loading}
                  required
                />
                <div className="counter">
                  {descripcion.length}/{MAX_DESC}
                </div>
              </div>

              <div className="form-group">
                <label>Adjuntar imagen (opcional)</label>
                <div
                  className="dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleImage(e.target.files?.[0])}
                    disabled={loading}
                  />
                  {!preview ? (
                    <div className="dropzone-empty">
                      <span className="dropzone-icon"></span>
                      <div>Arrastrá, pegá una captura o hacé click para elegir</div>
                    </div>
                  ) : (
                    <div className="dropzone-preview">
                      <img src={preview} alt="Vista previa" />
                      <div className="preview-meta">
                        <span className="file-name">
                          {imagen?.name || "captura.png"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagen(null);
                            setPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          disabled={loading}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Enviando…" : " Crear ticket"}
                </button>
              </div>
            </form>
          </>
        )}

        {mensaje && (
          <div
            className={`home-alert ${
              mensaje.startsWith("✅") ? "ok" : "err"
            }`}
          >
            {mensaje}
          </div>
        )}

        <div className="home-footer">
          <span>Versión: {version}</span>
          <span>•</span>
          <Link to="/tickets" className="home-link">Mis tickets</Link>
          {user?.rol === "admin" && (
            <>
              <span>•</span>
              <Link to="/dashboard" className="home-link">Dashboard</Link>
              <span>•</span>
              <Link to="/stats" className="home-link">Estadísticas</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
