import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import './Tickets.css';

const STORAGE_KEY = 'tickets_view_prefs:v1'; // 🔒 clave de localStorage

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const [usuarioActual, setUsuarioActual] = useState('');

  // Composer por ticket (local-only)
  const [drafts, setDrafts] = useState({}); // { [id]: { texto, archivo, previewUrl } }

  // Toasts simples
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (msg, type = 'info', ttl = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setToasts(prev => [...prev, { id, msg, type }]);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.3;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl);
  };

  // 1) Cargar preferencias guardadas al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (typeof prefs.busqueda === 'string') setBusqueda(prefs.busqueda);
        if (typeof prefs.estadoFiltro === 'string') setEstadoFiltro(prefs.estadoFiltro);
        if (typeof prefs.prioridadFiltro === 'string') setPrioridadFiltro(prefs.prioridadFiltro);
      }
    } catch {}
  }, []);

  // 2) Guardar preferencias cuando cambien
  useEffect(() => {
    const prefs = { busqueda, estadoFiltro, prioridadFiltro };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
  }, [busqueda, estadoFiltro, prioridadFiltro]);

  // Auth + primera carga
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    try {
      const payload = jwtDecode(token);
      setUsuarioActual(payload.email || 'usuario');
    } catch {
      setUsuarioActual('usuario');
    }
    cargarTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro, prioridadFiltro]);

  const cargarTickets = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);

    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/tickets?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ordenados = data.slice().sort((a, b) => {
        const aNuevo = tieneComentarioNuevoDeOtro(a);
        const bNuevo = tieneComentarioNuevoDeOtro(b);
        if (aNuevo && !bNuevo) return -1;
        if (!aNuevo && bNuevo) return 1;
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      });
      setTickets(ordenados);
    } catch (err) {
      console.error(err);
      showToast('No se pudieron cargar los tickets', 'error');
      setTickets([]);
    }
  };

  const marcarLeido = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/leido`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Error al marcar leído:', err.response?.data || err.message);
    }
  };

  const toggleTicket = async (id) => {
    setAbiertos(prev => {
      const abierto = !prev[id];
      const next = { ...prev, [id]: abierto };
      if (abierto) marcarLeido(id);
      return next;
    });
  };

  const tieneComentarioNuevoDeOtro = (ticket) => {
    const ultimo = ticket.historial?.[ticket.historial.length - 1];
    if (!ultimo) return false;
    if (ultimo.autor === usuarioActual) return false;
    const reg = ticket.leidoPor?.find(l => l.usuario === usuarioActual);
    if (!reg) return true;
    return new Date(ultimo.fecha) > new Date(reg.fecha);
  };

  // Buscar + filtrar (simple)
  const ticketsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tickets.filter(t => {
      if (q) {
        const numero = String(t.numero_ticket || '');
        const asunto = String(t.asunto || '').toLowerCase();
        const desc = String(t.descripcion || '').toLowerCase();
        const email = String(t.usuario_id?.email || '').toLowerCase();
        const estado = String(t.estado || '').toLowerCase();
        const any =
          numero.includes(q) ||
          asunto.includes(q) ||
          desc.includes(q) ||
          email.includes(q) ||
          estado.includes(q);
        if (!any) return false;
      }
      if (estadoFiltro && t.estado !== estadoFiltro) return false;
      if (prioridadFiltro && t.prioridad !== prioridadFiltro) return false;
      return true;
    });
  }, [tickets, busqueda, estadoFiltro, prioridadFiltro]);

  // Draft helpers
  const onDraft = (id, campo, valor) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const handleImage = (id, file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const named = new File(
      [file],
      file.name && file.name !== 'blob'
        ? file.name
        : `captura-${Date.now()}.${file.type?.split('/')[1] || 'png'}`,
      { type: file.type || 'image/png' }
    );
    setDrafts(prev => {
      const prevItem = prev[id];
      if (prevItem?.previewUrl) URL.revokeObjectURL(prevItem.previewUrl);
      const previewUrl = URL.createObjectURL(named);
      return { ...prev, [id]: { ...(prevItem || {}), archivo: named, previewUrl } };
    });
  };

  const handlePasteAsFile = (id, e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const named = new File(
          [blob],
          `captura-${Date.now()}.${blob?.type?.split('/')[1] || 'png'}`,
          { type: blob?.type || 'image/png' }
        );
        handleImage(id, named);
      }
    }
  };

  const limpiarAdjunto = (id) => {
    setDrafts(prev => {
      const next = { ...prev };
      const curr = next[id];
      if (curr?.previewUrl) URL.revokeObjectURL(curr.previewUrl);
      if (next[id]) {
        delete next[id].archivo;
        delete next[id].previewUrl;
      }
      return next;
    });
  };

  const enviarComentario = async (ticketId) => {
    const token = localStorage.getItem('token');
    const d = drafts[ticketId] || {};
    if (!d.texto && !d.archivo) {
      showToast('Escribí un comentario o adjuntá una imagen', 'info');
      return;
    }

    const formData = new FormData();
    if (d.texto) formData.append('comentario', d.texto);
    if (d.archivo) formData.append('imagen', d.archivo);

    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${ticketId}/comentario`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // limpiar draft
      setDrafts(prev => {
        const next = { ...prev };
        const curr = next[ticketId];
        if (curr?.previewUrl) URL.revokeObjectURL(curr.previewUrl);
        next[ticketId] = { texto: '', archivo: null, previewUrl: undefined };
        return next;
      });

      showToast('Comentario enviado', 'success');
      await cargarTickets();
    } catch (err) {
      console.error(err);
      showToast('No se pudo enviar el comentario', 'error');
    }
  };

  const colorEstado = {
    abierto: '#22c55e',
    pendiente: '#e11d48',
    en_proceso: '#f59e0b',
    resuelto: '#10b981',
    cerrado: '#64748b',
    reabierto: '#fb923c',
    cancelado: '#ef4444',
  };

  const limpiarVista = () => {
    setBusqueda('');
    setEstadoFiltro('');
    setPrioridadFiltro('');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    showToast('Vista restablecida', 'info');
  };

  return (
    <div className="tickets--wrap">
      <img src="/logo.png" alt="Logo" className="tickets--logo" />
      <h2 className="tickets--title">Mis Tickets</h2>

      {/* Toolbar: búsqueda + filtros + contador + restablecer */}
      <div className="tickets--toolbar">
        <input
          type="text"
          className="tickets--search"
          placeholder="Buscar por #, asunto, descripción, estado o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          <option value="">Estado: todos</option>
          <option value="abierto">Abierto</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
          <option value="reabierto">Reabierto</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={prioridadFiltro} onChange={e => setPrioridadFiltro(e.target.value)}>
          <option value="">Prioridad: todas</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </select>
      </div>

      {/* Contador + Restablecer */}
      <div className="tickets--metaBar">
        <span className="count">
          Mostrando <strong>{ticketsFiltrados.length}</strong> de <strong>{tickets.length}</strong> tickets
        </span>
        <button className="btn btn-ghost" onClick={limpiarVista}>Restablecer vista</button>
      </div>

      {/* Lista */}
      <ul className="tickets--list">
        {ticketsFiltrados.length ? ticketsFiltrados.map(t => {
          const abierto = !!abiertos[t._id];
          const draft = drafts[t._id] || { texto: '', archivo: null, previewUrl: undefined };
          const nuevoDeOtro = tieneComentarioNuevoDeOtro(t);

          return (
            <li key={t._id} className={`ticket ${nuevoDeOtro ? 'is-new' : ''}`}>
              <header className="ticket__head">
                <div className="ticket__id">
                  <strong>#{t.numero_ticket}</strong> {t.asunto ? `– ${t.asunto}` : ''}
                </div>
                <div className="ticket__status">
                  <span
                    className="chip chip--estado"
                    style={{ backgroundColor: colorEstado[t.estado] || '#475569' }}
                  >
                    {t.estado.replace('_',' ')}
                  </span>
                  <span className={`chip chip--prio prio-${t.prioridad}`}>{t.prioridad}</span>
                </div>
                <button className="btn" onClick={() => toggleTicket(t._id)}>
                  {abierto ? 'Cerrar' : 'Abrir'}
                </button>
              </header>

              {!abierto && (
                <div className="ticket__row">
                  <span className="muted">
                    Creado: {new Date(t.fecha_creacion).toLocaleString()}
                  </span>
                  {nuevoDeOtro && <span className="badge">🆕 comentario nuevo</span>}
                </div>
              )}

              {abierto && (
                <div className="ticket__body">
                  <div className="meta">
                    <div><strong>Creado:</strong> {new Date(t.fecha_creacion).toLocaleString()}</div>
                    {t.usuario_id?.email && <div><strong>Tu email:</strong> {t.usuario_id.email}</div>}
                  </div>

                  {t.descripcion && (
                    <p className="desc"><strong>Descripción:</strong> {t.descripcion}</p>
                  )}

                  {t.imagen && (
                    <div className="block">
                      <p className="label">Imagen del ticket</p>
                      <a
                        href={`${import.meta.env.VITE_BACKEND_URL}/uploads/${t.imagen}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={`${import.meta.env.VITE_BACKEND_URL}/uploads/${t.imagen}`}
                          alt="Adjunto"
                          width="220"
                          className="img"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://via.placeholder.com/220?text=No+disponible'; }}
                        />
                      </a>
                    </div>
                  )}

                  {t.historial?.length > 0 && (
                    <div className="block">
                      <p className="label">Seguimiento</p>
                      <ul className="timeline">
                        {t.historial.map((h, i) => (
                          <li key={i} className={h.autor && h.autor !== usuarioActual ? 'from-other' : ''}>
                            <div className="timeline__line" />
                            <div className="timeline__dot" />
                            <div className="timeline__content">
                              <div className="timeline__meta">
                                <strong>{new Date(h.fecha).toLocaleString()}</strong> — {h.estado}
                                {h.autor && <span className="muted"> ({h.autor})</span>}
                              </div>
                              {h.comentario && <div>{h.comentario}</div>}
                              {h.imagen && (
                                <a
                                  href={`${import.meta.env.VITE_BACKEND_URL}/uploads/${h.imagen}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={`${import.meta.env.VITE_BACKEND_URL}/uploads/${h.imagen}`}
                                    alt="Adjunto"
                                    width="180"
                                    className="img img--small"
                                  />
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Composer sencillo */}
                  <div className="composer">
                    <label className="label">Agregar comentario</label>
                    <textarea
                      className="textarea"
                      placeholder="Escribí tu comentario… (podés pegar una captura con Ctrl+V)"
                      value={draft.texto || ''}
                      onChange={(e) => onDraft(t._id, 'texto', e.target.value)}
                      onPaste={(e) => handlePasteAsFile(t._id, e)}
                      rows={3}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <div
                      className="dropzone"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        handleImage(t._id, file);
                      }}
                      onPaste={(e) => handlePasteAsFile(t._id, e)}
                    >
                      <input
                        id={`file-${t._id}`}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleImage(t._id, e.target.files?.[0])}
                      />
                      <label htmlFor={`file-${t._id}`} className="btn btn-secondary">Adjuntar imagen</label>
                      {draft.archivo && <span className="file-name">{draft.archivo.name}</span>}
                      {(draft.archivo || draft.previewUrl) && (
                        <button className="btn btn-ghost" type="button" onClick={() => limpiarAdjunto(t._id)}>Quitar</button>
                      )}
                    </div>

                    {draft.previewUrl && (
                      <div className="preview">
                        <img src={draft.previewUrl} alt="Preview" className="img" />
                      </div>
                    )}

                    <div className="composer__footer">
                      <button
                        className="btn"
                        onClick={() => enviarComentario(t._id)}
                        disabled={!draft.texto && !draft.archivo}
                      >
                        Enviar comentario
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        }) : (
          <li className="empty">No se encontraron tickets con los filtros actuales.</li>
        )}
      </ul>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '⛔' : 'ℹ️'}
            </div>
            <div className="toast-msg">{t.msg}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✖</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Tickets;
