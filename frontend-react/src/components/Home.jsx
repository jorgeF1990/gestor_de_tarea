import React, { useState, useContext, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import { AuthContext } from "../context/AuthContext";
import "./Home.css";
import AsignarUsuarios from "./AsignarUsuarios";
import RecurrenciaConfig from "./RecurrenciaConfig";

import {
  Calendar,
  Clock,
  Image as ImageIcon,
  Send,
  User,
  LogIn,
  UserPlus,
  LayoutDashboard,
  BarChart3,
  Ticket,
  AlertCircle,
  CheckCircle,
  Star,
  FileText,
  Paperclip,
  Trash2,
  CalendarDays,
  Clock3,
  Home as HomeIcon
} from 'lucide-react';

const MAX_ASUNTO = 120;
const MAX_DESC = 1000;

function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const version = import.meta.env.VITE_VERSION;

  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [vencimientoFecha, setVencimientoFecha] = useState("");
  const [vencimientoHora, setVencimientoHora] = useState("23:59");
  const [usuariosAsignados, setUsuariosAsignados] = useState([]);
  
  const [recurrenciaConfig, setRecurrenciaConfig] = useState({
    es_recurrente: false,
    recurrencia: null
  });
  
  const fileInputRef = useRef(null);
  const fechaInputRef = useRef(null);
  const horaInputRef = useRef(null);

  const resetForm = () => {
    setAsunto("");
    setDescripcion("");
    setImagen(null);
    setPreview(null);
    setVencimientoFecha("");
    setVencimientoHora("23:59");
    setUsuariosAsignados([]);
    setRecurrenciaConfig({
      es_recurrente: false,
      recurrencia: null
    });
  };

  const handleImage = (file) => {
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setMensaje("La imagen no puede superar los 5MB.");
      return;
    }
    
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
    if (file) handleImage(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type?.startsWith("image/")) {
        const blob = items[i].getAsFile();
        if (blob) handleImage(blob);
        break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!asunto.trim() || !descripcion.trim()) {
      setMensaje("Completá asunto y descripción.");
      return;
    }

    const formData = new FormData();
    formData.append("asunto", asunto.trim());
    formData.append("descripcion", descripcion.trim());
    
    if (vencimientoFecha) {
      formData.append("fecha_vencimiento", vencimientoFecha);
      formData.append("hora_vencimiento", vencimientoHora);
    }
    
    if (imagen) formData.append("imagen", imagen);
    
    if (usuariosAsignados.length > 0) {
      const usuariosIds = usuariosAsignados.map(u => u._id || u.id);
      formData.append("usuarios_asignados", JSON.stringify(usuariosIds));
    }

    if (recurrenciaConfig.es_recurrente && recurrenciaConfig.recurrencia) {
      const rec = recurrenciaConfig.recurrencia;
      formData.append("es_recurrente", "true");
      formData.append("recurrencia_tipo", rec.tipo);
      formData.append("recurrencia_intervalo", rec.intervalo?.toString() || "1");
      formData.append("solo_dias_habiles", rec.solo_dias_habiles ? "true" : "false");
      
      if (rec.tipo === 'semanal' && rec.dias_semana?.length) {
        formData.append("dias_semana", JSON.stringify(rec.dias_semana));
      }
      
      if (rec.tipo === 'mensual' && rec.dia_mes) {
        formData.append("dia_mes", rec.dia_mes.toString());
      }
      
      if (rec.fecha_fin) {
        formData.append("fecha_fin_recurrencia", rec.fecha_fin);
      }
    }

    try {
      setLoading(true);
      await API.post('/tickets', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMensaje("Tarea creada con éxito");
      resetForm();
      setTimeout(() => setMensaje(""), 5000);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Ocurrió un error al crear la tarea";
      setMensaje(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.rol === 'admin';

  return (
    <div className="home">
      <div className="home-card">
        <div className="home-header">
          <img src="/logo.svg" alt="Logo" className="home-logo" />
          <div className="home-title-group">
            <h1 className="home-title">TareaSync</h1>
            <p className="home-subtitle">Gestión inteligente de tareas</p>
          </div>
        </div>

        {!user ? (
          <div className="home-auth-cta">
            <div className="welcome-icon" aria-hidden="true">
              <Star size={48} />
            </div>
            <h2>Bienvenido</h2>
            <p>Para crear una tarea necesitás iniciar sesión.</p>
            <div className="home-auth-buttons">
              <Link to="/login" className="btn btn-primary">
                <LogIn size={16} /> Iniciar sesión
              </Link>
              <Link to="/register" className="btn btn-secondary">
                <UserPlus size={16} /> Registrarse
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h2 className="home-section-title">
              <FileText size={18} /> Crear nueva tarea
            </h2>
            <form className="home-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="asunto">
                  <span className="label-icon">📌</span> Asunto
                </label>
                <input
                  id="asunto"
                  name="asunto"
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value.slice(0, MAX_ASUNTO))}
                  placeholder="Ej.: No puedo acceder a mi cuenta"
                  maxLength={MAX_ASUNTO}
                  disabled={loading}
                  required
                  autoFocus
                />
                <div className="counter">
                  {asunto.length}/{MAX_ASUNTO}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="descripcion">
                  <FileText size={14} /> Descripción
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value.slice(0, MAX_DESC))}
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

              <div className="form-row">
                <div className="form-group half">
                  <label htmlFor="fecha_vencimiento">
                    <CalendarDays size={14} /> Fecha de vencimiento
                  </label>
                  <div className="date-time-wrapper" onClick={() => fechaInputRef.current?.showPicker()}>
                    <Calendar size={16} className="input-icon" />
                    <input
                      ref={fechaInputRef}
                      id="fecha_vencimiento"
                      name="fecha_vencimiento"
                      type="date"
                      value={vencimientoFecha}
                      onChange={(e) => setVencimientoFecha(e.target.value)}
                      disabled={loading}
                      aria-label="Fecha de vencimiento"
                    />
                  </div>
                </div>
                <div className="form-group half">
                  <label htmlFor="hora_vencimiento">
                    <Clock3 size={14} /> Hora de vencimiento
                  </label>
                  <div className="date-time-wrapper" onClick={() => horaInputRef.current?.showPicker()}>
                    <Clock size={16} className="input-icon" />
                    <input
                      ref={horaInputRef}
                      id="hora_vencimiento"
                      name="hora_vencimiento"
                      type="time"
                      value={vencimientoHora}
                      onChange={(e) => setVencimientoHora(e.target.value)}
                      disabled={loading}
                      step="60"
                      aria-label="Hora de vencimiento"
                    />
                  </div>
                </div>
              </div>

              <RecurrenciaConfig 
                config={recurrenciaConfig}
                onChange={setRecurrenciaConfig}
                disabled={loading}
              />

              <AsignarUsuarios 
                selectedUsers={usuariosAsignados}
                onUsersChange={setUsuariosAsignados}
              />

              <div className="form-group">
                <label htmlFor="imagen">
                  <ImageIcon size={14} /> Adjuntar imagen (opcional)
                </label>
                <div
                  className="dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Área para adjuntar imagen"
                >
                  <input
                    ref={fileInputRef}
                    id="imagen"
                    name="imagen"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleImage(e.target.files?.[0])}
                    disabled={loading}
                    aria-label="Seleccionar archivo de imagen"
                  />
                  {!preview ? (
                    <div className="dropzone-empty">
                      <ImageIcon size={32} className="dropzone-icon" />
                      <div>Arrastrá, pegá una captura o hacé click para elegir</div>
                      <small className="hint">Formatos: JPG, PNG, GIF (max 5MB)</small>
                    </div>
                  ) : (
                    <div className="dropzone-preview">
                      <img src={preview} alt="Vista previa de la imagen adjunta" />
                      <div className="preview-meta">
                        <span className="file-name">
                          <Paperclip size={12} /> {imagen?.name || "captura.png"}
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
                          aria-label="Quitar imagen"
                        >
                          <Trash2 size={14} /> Quitar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading}
                  aria-label="Crear nueva tarea"
                >
                  {loading ? (
                    <>
                      <span className="loader-small"></span> Enviando…
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Crear tarea
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {mensaje && (
          <div
            className={`home-alert ${mensaje.startsWith("Error") ? "err" : "ok"}`}
            role="alert"
          >
            {mensaje.startsWith("Error") ? (
              <AlertCircle size={16} aria-hidden="true" />
            ) : (
              <CheckCircle size={16} aria-hidden="true" />
            )}
            {mensaje}
          </div>
        )}

        <div className="home-footer">
          <span>Versión: {version}</span>
          <span>•</span>
          <Link to="/tickets" className="home-link">
            <Ticket size={14} /> Mis tareas
          </Link>
          {isAdmin && (
            <>
              <span>•</span>
              <Link to="/dashboard" className="home-link">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
              <span>•</span>
              <Link to="/stats" className="home-link">
                <BarChart3 size={14} /> Estadísticas
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;