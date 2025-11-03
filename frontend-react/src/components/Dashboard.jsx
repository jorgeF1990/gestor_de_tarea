import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const SEEN_KEY_ADMIN = 'dashboard_last_seen:v1';
const OPEN_KEY_ADMIN  = 'dashboard_open_cards:v1';
const THEME_KEY       = 'dashboard-theme';
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

/** ===== Helpers ===== */
const getActivityTs = (t) => {
  const created = t.fecha_creacion || t.createdAt;
  const updated = t.fecha_actualizacion || t.updatedAt;
  const lastHist = Array.isArray(t.historial) && t.historial.length
    ? t.historial[t.historial.length - 1]?.fecha
    : null;

  const times = [
    created ? new Date(created).getTime() : 0,
    updated ? new Date(updated).getTime() : 0,
    lastHist ? new Date(lastHist).getTime() : 0
  ].filter(Boolean);

  return times.length ? Math.max(...times) : 0;
};

const timeAgo = (dateLike) => {
  if (!dateLike) return '—';
  const ts = typeof dateLike === 'number' ? dateLike : new Date(dateLike).getTime();
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const s = Math.floor(diff/1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h/24);
  return `${d} d`;
};

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [mensajes, setMensajes] = useState({});
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const [flashIds, setFlashIds] = useState({});
  const [usuarioActual, setUsuarioAtual] = useState('');
  const [cambios, setCambios] = useState({});
  const [loading, setLoading] = useState(false);

  // Campana de novedades
  const [updates, setUpdates] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);

  // Auto-refresh + saving por ticket
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [saving, setSaving] = useState({}); // { [ticketId]: boolean }

  // Tema
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');

  // Toasts
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (msg, type = 'info', ttl = 3200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setToasts(prev => [...prev, { id, msg, type }]);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.28;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl);
  };

  /* ========================
     Tema (aplicar al documento)
     ======================== */
  useEffect(() => {
    const val = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    localStorage.setItem(THEME_KEY, val);
  }, [theme]);

  /* ========================
     Auth + carga inicial
     ======================== */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const payload = jwtDecode(token);
      if (payload.rol !== 'admin') { navigate('/'); return; }
      setUsuarioAtual(payload.email || '');
    } catch { navigate('/login'); return; }

    // Restaurar tarjetas abiertas
    try {
      const raw = localStorage.getItem(OPEN_KEY_ADMIN);
      if (raw) setAbiertos(JSON.parse(raw) || {});
    } catch {}

    cargarTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, estadoFiltro, prioridadFiltro]);

  // Auto-refresh cada 30s si está activado
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      cargarTickets({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, estadoFiltro, prioridadFiltro]);

  // Persistir abiertos
  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY_ADMIN, JSON.stringify(abiertos)); } catch {}
  }, [abiertos]);

  /* ========================
     Cargar tickets
     ======================== */
  const cargarTickets = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);
    try {
      const res = await axios.get(`${API}/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ordenar por “última actividad” desc (más recientes arriba)
      const ordenados = res.data.slice().sort((a, b) => getActivityTs(b) - getActivityTs(a));
      setTickets(ordenados);

      // limpiar abiertos sin ID
      setAbiertos(prev => {
        const next = {};
        const setIds = new Set(ordenados.map(t => t._id));
        Object.entries(prev).forEach(([id, v]) => { if (setIds.has(id)) next[id] = v; });
        return next;
      });

      calcularNovedades(ordenados);
    } catch {
      setTickets([]);
      setUpdates([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /* ========================
     Acciones: estado / prioridad
     ======================== */
  const actualizarTicket = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoEstado, nuevaPrioridad } = cambio;

    if (!nuevoEstado && !nuevaPrioridad) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ No hay cambios de estado o prioridad' }));
      return { ok: false, reason: 'nochanges' };
    }

    const payload = {};
    if (nuevoEstado) payload.estado = nuevoEstado;
    if (nuevaPrioridad) payload.prioridad = nuevaPrioridad;

    try {
      await axios.put(
        `${API}/tickets/${id}/estado`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      setTickets(prev => prev.map(t => t._id === id ? { ...t, ...payload, fecha_actualizacion: new Date().toISOString() } : t));
      setCambios(prev => { const n = { ...prev }; delete n[id]?.nuevoEstado; delete n[id]?.nuevaPrioridad; return n; });
      setMensajes(prev => ({ ...prev, [id]: '✅ Estado/prioridad actualizado' }));
      showToast('Ticket actualizado', 'success');
      await cargarTickets({ silent: true });
      return { ok: true };
    } catch (err) {
      const mensajeError = err.response?.data?.message || '❌ Error al actualizar estado/prioridad';
      setMensajes(prev => ({ ...prev, [id]: mensajeError }));
      showToast('No se pudo actualizar', 'error');
      return { ok: false, error: err };
    }
  };

  /* ========================
     Acciones: comentario + adjunto
     ======================== */
  const agregarComentarioDesdeDashboard = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoComentario, nuevoArchivo } = cambio;

    if (!nuevoComentario && !nuevoArchivo) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ Comentario vacío' }));
      return { ok: false, reason: 'empty' };
    }

    const formData = new FormData();
    if (nuevoComentario) formData.append('comentario', nuevoComentario);
    if (nuevoArchivo) formData.append('imagen', nuevoArchivo);

    try {
      await axios.put(
        `${API}/tickets/${id}/comentario`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCambios(prev => { const n = { ...prev }; if (n[id]) { delete n[id].nuevoComentario; delete n[id].nuevoArchivo; } return n; });
      setMensajes(prev => ({ ...prev, [id]: '✅ Comentario guardado' }));
      showToast('Comentario agregado', 'success');
      await cargarTickets({ silent: true });
      return { ok: true };
    } catch (err) {
      const mensajeError = err.response?.data?.message || '❌ Error al guardar comentario';
      setMensajes(prev => ({ ...prev, [id]: mensajeError }));
      showToast('No se pudo comentar', 'error');
      return { ok: false, error: err };
    }
  };

  /* ========================
     Leído + abrir/cerrar
     ======================== */
  const marcarLeido = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/tickets/${id}/leido`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await cargarTickets({ silent: true });
    } catch (err) {
      console.error('Error al marcar como leído:', err.message);
    }
  };

  const setOpenAndFocus = (id, open = true) => {
    setAbiertos(prev => ({ ...prev, [id]: open }));
    if (open) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`dash-ticket-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setFlashIds(prev => ({ ...prev, [id]: true }));
          setTimeout(() => setFlashIds(prev => { const n = { ...prev }; delete n[id]; return n; }), 1300);
        }
      });
      if (!abiertos[id]) marcarLeido(id);
    }
  };

  const toggleTicket = (id) => setOpenAndFocus(id, !abiertos[id]);

  /* ========================
     Helpers visuales
     ======================== */
  const tieneComentarioNuevoDeOtro = (ticket) => {
    const ultimo = ticket.historial?.[ticket.historial.length - 1];
    if (!ultimo) return false;
    if (ultimo.autor === usuarioActual) return false;
    const registro = ticket.leidoPor?.find(l => l.usuario === usuarioActual);
    if (!registro) return true;
    return new Date(ultimo.fecha) > new Date(registro.fecha);
  };

  const colorEstado = {
    abierto:   '#22c55e',
    pendiente: '#e11d48',
    en_proceso:'#f59e0b',
    resuelto:  '#10b981',
    cerrado:   '#64748b',
    reabierto: '#fb923c',
    cancelado: '#ef4444'
  };

  const conteos = useMemo(() => {
    const inicial = {abierto:0, pendiente:0, en_proceso:0, resuelto:0, cerrado:0, reabierto:0, cancelado:0, total:0};
    return tickets.reduce((acc, t) => {
      const est = String(t.estado || '').toLowerCase();
      if (est && Object.prototype.hasOwnProperty.call(acc, est)) acc[est] += 1;
      acc.total += 1; return acc;
    }, inicial);
  }, [tickets]);

  const onCambio = (id, campo, valor) => {
    setCambios(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  /* ========================
     Novedades (campana)
     ======================== */
  const getSeenSnapshot = () => {
    try { const raw = localStorage.getItem(SEEN_KEY_ADMIN); if (raw) return JSON.parse(raw); } catch {}
    return {};
  };

  const buildCurrentSnapshot = (list) => {
    const snap = {};
    for (const t of list) {
      const last = t.historial?.[t.historial.length - 1];
      const lastISO = last?.fecha ? new Date(last.fecha).toISOString() : null;
      snap[t._id] = {
        estado: t.estado || '',
        prioridad: t.prioridad || '',
        lastISO,
        lastAutor: last?.autor || null,
        numero: t.numero_ticket,
        asunto: t.asunto,
        imagen: t.imagen || null
      };
    }
    return snap;
  };

  const calcularNovedades = (list) => {
    const seen = getSeenSnapshot();
    const curr = buildCurrentSnapshot(list);
    const cambios = [];

    for (const t of list) {
      const prev = seen[t._id];
      const now = curr[t._id];
      const lastAutor = now.lastAutor;

      if (!prev) {
        const ch = [];
        if (now.lastISO && lastAutor && lastAutor !== usuarioActual) ch.push('comentario');
        if (lastAutor && lastAutor !== usuarioActual) {
          if (now.estado) ch.push('estado');
          if (now.prioridad) ch.push('prioridad');
        }
        if (now.imagen && lastAutor && lastAutor !== usuarioActual) ch.push('imagen');
        if (t.estado === 'pendiente' && (t.historial?.length || 0) === 1 && lastAutor && lastAutor !== usuarioActual) {
          ch.push('nuevo');
        }
        if (ch.length) cambios.push({ id: t._id, numero: now.numero, asunto: now.asunto, changes: Array.from(new Set(ch)) });
        continue;
      }

      const ch = [];
      if ((prev.lastISO || '') !== (now.lastISO || '') && lastAutor && lastAutor !== usuarioActual) ch.push('comentario');
      if (prev.estado !== now.estado && lastAutor && lastAutor !== usuarioActual) ch.push('estado');
      if (prev.prioridad !== now.prioridad && lastAutor && lastAutor !== usuarioActual) ch.push('prioridad');
      if ((prev.imagen || null) !== (now.imagen || null) && lastAutor && lastAutor !== usuarioActual) ch.push('imagen');

      if (ch.length) cambios.push({ id: t._id, numero: now.numero, asunto: now.asunto, changes: Array.from(new Set(ch)) });
    }

    setUpdates(cambios);
  };

  const marcarTodoVisto = () => {
    const snap = buildCurrentSnapshot(tickets);
    try { localStorage.setItem(SEEN_KEY_ADMIN, JSON.stringify(snap)); } catch {}
    setUpdates([]);
    setPanelOpen(false);
    showToast('Novedades marcadas como vistas', 'info');
  };

  const marcarUnoVisto = (id) => {
    const seen = getSeenSnapshot();
    const curr = buildCurrentSnapshot(tickets);
    if (!curr[id]) return;
    const next = { ...seen, [id]: curr[id] };
    try { localStorage.setItem(SEEN_KEY_ADMIN, JSON.stringify(next)); } catch {}
    setUpdates(prev => {
      const rest = prev.filter(u => u.id !== id);
      if (rest.length === 0) setPanelOpen(false);
      return rest;
    });
  };

  /* ========================
     Guardar cambios (secuencial)
     ======================== */
  const guardarCambios = async (ticketId) => {
    if (saving[ticketId]) return;
    const cambio = cambios[ticketId] || {};
    const wantsEstado = !!cambio.nuevoEstado || !!cambio.nuevaPrioridad;
    const wantsComentario = !!cambio.nuevoComentario || !!cambio.nuevoArchivo;

    if (!wantsEstado && !wantsComentario) {
      setMensajes(prev => ({ ...prev, [ticketId]: '⚠️ No hay nada para guardar' }));
      return;
    }

    setSaving(prev => ({ ...prev, [ticketId]: true }));
    setMensajes(prev => ({ ...prev, [ticketId]: '' }));

    // 1) Primero estado/prioridad
    if (wantsEstado) {
      const r1 = await actualizarTicket(ticketId);
      if (!r1?.ok && r1?.reason !== 'nochanges') {
        setSaving(prev => ({ ...prev, [ticketId]: false }));
        return;
      }
    }

    // 2) Luego comentario/imagen
    if (wantsComentario) {
      const r2 = await agregarComentarioDesdeDashboard(ticketId);
      if (!r2?.ok && r2?.reason !== 'empty') {
        setSaving(prev => ({ ...prev, [ticketId]: false }));
        return;
      }
    }

    setSaving(prev => ({ ...prev, [ticketId]: false }));
    // Reordenar por última actividad sin pedir al server (optimista)
    setTickets(prev => prev.slice().sort((a, b) => getActivityTs(b) - getActivityTs(a)));
  };

  /* ========================
     Búsqueda + paginación
     ======================== */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem('dashboard-page-size') || 10);
    return [5,10,15,20,30,50].includes(saved) ? saved : 10;
  });

  useEffect(() => {
    localStorage.setItem('dashboard-page-size', pageSize);
    setPage(1); // si cambia el tamaño, volvemos a la primera página
  }, [pageSize]);

  const filteredTickets = useMemo(() => {
    const q = busquedaTexto.trim().toLowerCase();
    return tickets.filter(ticket => {
      if (!q) return true;
      return (
        ticket.numero_ticket?.toString().includes(q) ||
        ticket.asunto?.toLowerCase().includes(q) ||
        ticket.descripcion?.toLowerCase().includes(q) ||
        ticket.usuario_id?.email?.toLowerCase().includes(q)
      );
    });
  }, [tickets, busquedaTexto]);

  const pages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pageData = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    // Si los filtros/búsqueda dejan menos páginas de las actuales, ajustamos
    if (page > pages) setPage(pages);
  }, [pages, page]);

  /* ========================
     Render
     ======================== */
  return (
    <div className="dashboard-container">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Logo" className="dashboard-logo" />
          <div className="brand-meta">
            <h1>Panel de Tickets</h1>
            <p className="muted">Administración • Portfolio Investment</p>
          </div>
        </div>

        {/* Acciones topbar */}
        <div className="topbar-actions">
          <div className="topbar-group" style={{gap:8}}>
            

            {/* Auto refresh */}
            <label className="muted" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto 30s
            </label>

            <button className="btn btn-secondary btn-xs" onClick={()=>cargarTickets()}>
              {loading ? 'Actualizando…' : 'Refrescar'}
            </button>
          </div>

          {/* Campana */}
          <div className="bell-wrap">
            <button
              className="bell-btn"
              aria-label="Novedades"
              onClick={() => setPanelOpen(p => !p)}
              data-has-updates={updates.length > 0}
              title="Novedades"
            >
              🔔
              {updates.length > 0 && <span className="bell-badge">{updates.length}</span>}
            </button>

            {panelOpen && (
              <div className="bell-panel">
                <div className="bell-panel__head">
                  <strong>Novedades</strong>
                  <button className="btn btn-secondary btn-xs" onClick={marcarTodoVisto}>Marcar todo como visto</button>
                </div>
                {updates.length === 0 ? (
                  <div className="bell-empty">Sin novedades</div>
                ) : (
                  <ul className="bell-list">
                    {updates.map(u => (
                      <li
                        key={u.id}
                        className="bell-item"
                        onClick={() => { setPanelOpen(false); setOpenAndFocus(u.id, true); }}
                      >
                        <div className="bell-title">
                          <span className="muted">#{u.numero}</span> {u.asunto || 'Sin asunto'}
                        </div>
                        <div className="bell-tags">
                          {u.changes.includes('nuevo') && <span className="tag tag-purple">Nuevo</span>}
                          {u.changes.includes('comentario') && <span className="tag tag-green">Comentario</span>}
                          {u.changes.includes('estado') && <span className="tag tag-blue">Estado</span>}
                          {u.changes.includes('prioridad') && <span className="tag tag-amber">Prioridad</span>}
                          {u.changes.includes('imagen') && <span className="tag tag-cyan">Imagen</span>}
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => { e.stopPropagation(); marcarUnoVisto(u.id); }}
                            title="Marcar este ticket como visto"
                          >
                            Marcar como visto
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      

      {/* Resumen */}
      <div className="dashboard-resumen">
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.abierto}` }}>
          <div className="resumen-title">Abiertos</div><div className="resumen-value">{conteos.abierto}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.pendiente}` }}>
          <div className="resumen-title">Pendientes</div><div className="resumen-value">{conteos.pendiente}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.en_proceso}` }}>
          <div className="resumen-title">En proceso</div><div className="resumen-value">{conteos.en_proceso}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.resuelto}` }}>
          <div className="resumen-title">Resueltos</div><div className="resumen-value">{conteos.resuelto}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.reabierto}` }}>
          <div className="resumen-title">Reabiertos</div><div className="resumen-value">{conteos.reabierto}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.cancelado}` }}>
          <div className="resumen-title">Cancelados</div><div className="resumen-value">{conteos.cancelado}</div>
        </div>
        <div className="resumen-card" style={{ borderLeft: `6px solid ${colorEstado.cerrado}` }}>
          <div className="resumen-title">Cerrados</div><div className="resumen-value">{conteos.cerrado}</div>
        </div>
        <div className="resumen-card total">
          <div className="resumen-title">Total</div><div className="resumen-value">{conteos.total}</div>
        </div>
      </div>

      <h2>Panel principal (Admin)</h2>

      <input
        type="text"
        className="dashboard-search"
        placeholder="Buscar por ticket, asunto, descripción o usuario"
        value={busquedaTexto}
        onChange={e => { setBusquedaTexto(e.target.value); setPage(1); }}
      />

      <div className="dashboard-filters">
        <select onChange={e => { setEstadoFiltro(e.target.value); setPage(1); }} value={estadoFiltro}>
          <option value="">Todos los estados</option>
          <option value="abierto">Abierto</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
          <option value="reabierto">Reabierto</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select onChange={e => { setPrioridadFiltro(e.target.value); setPage(1); }} value={prioridadFiltro} style={{ marginLeft: '10px' }}>
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </select>

        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
          <span className="muted">Por página</span>
          <select
            className="btn btn-secondary btn-xs"
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
          >
            {[5,10,15,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* LISTA paginada */}
      {loading && (
        <div className="empty"><span className="loader" /> Cargando…</div>
      )}

      {!loading && pageData.length === 0 && (
        <div className="empty">No hay resultados con los filtros actuales.</div>
      )}

      {!loading && pageData.length > 0 && pageData.map(ticket => {
        const esNuevo = ticket.estado === 'pendiente' && ticket.historial?.length === 1;
        const abierto = !!abiertos[ticket._id];
        const comentarioNuevo = tieneComentarioNuevoDeOtro(ticket);
        const cambio = cambios[ticket._id] || {};
        const createdAt = ticket.fecha_creacion || ticket.createdAt;
        const lastTs = getActivityTs(ticket);

        return (
          <div
            key={ticket._id}
            id={`dash-ticket-${ticket._id}`}
            className={`dashboard-ticket ${esNuevo ? 'highlight' : ''} ${flashIds[ticket._id] ? 'flash' : ''}`}
          >
            <div className="dashboard-ticket-header">
              <p>
                <strong>Ticket #{ticket.numero_ticket}</strong>
                <span className="chip-mini" title="Última actividad" style={{ marginLeft: 8 }}>
                  ⏱ {timeAgo(lastTs)}
                </span>
              </p>
              {comentarioNuevo && <span className="dashboard-new-comment">🆕 Nuevo comentario sin leer</span>}
              <button onClick={() => toggleTicket(ticket._id)}>
                {abierto ? '🔽 Cerrar' : '▶️ Abrir'}
              </button>
            </div>

            {!abierto && (
              <p>
                <strong>Estado actual:</strong>{' '}
                <span className={`dashboard-status ${ticket.estado}`}>{ticket.estado}</span>{' '}
                / <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>{' '}
                / <strong>Usuario:</strong> {ticket.usuario_id?.email}{' '}
                / <strong>Creado:</strong> {createdAt ? new Date(createdAt).toLocaleString() : '—'}
              </p>
            )}

            {abierto && (
              <>
                <p><strong>Asunto:</strong> {ticket.asunto}</p>
                <p><strong>Descripción:</strong> {ticket.descripcion}</p>
                <p>
                  <strong>Estado actual:</strong>{' '}
                  <span className={`dashboard-status ${ticket.estado}`}>{ticket.estado}</span>{' '}
                  - <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>
                  {' '}- <strong>Últ. actividad:</strong> {timeAgo(lastTs)}
                </p>
                <p><strong>Correo del usuario:</strong> {ticket.usuario_id?.email}</p>
                <p><strong>Fecha de creación:</strong> {createdAt ? new Date(createdAt).toLocaleString() : '—'}</p>

                {esNuevo && <p className="dashboard-new-comment">🆕 Ticket nuevo sin procesar</p>}

                {ticket.imagen && (
                  <div>
                    <p><strong>Imagen adjunta:</strong></p>
                    <a
                      href={`${API}/uploads/${ticket.imagen}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={`${API}/uploads/${ticket.imagen}`}
                        alt="Adjunto"
                        width="200"
                        style={{ border: '1px solid #ccc', marginTop: '10px', borderRadius: 8 }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://via.placeholder.com/200?text=Imagen+no+disponible';
                        }}
                      />
                    </a>
                  </div>
                )}

                {ticket.historial?.length > 0 && (
                  <ul className="dashboard-history ticket-history">
                    {ticket.historial.map((h, i) => (
                      <li key={i}>
                        {new Date(h.fecha).toLocaleString()} - <strong>{h.estado}</strong>: {h.comentario} {h.autor && `(${h.autor})`}
                        {h.imagen && (
                          <div>
                            <a
                              href={`${API}/uploads/${h.imagen}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={`${API}/uploads/${h.imagen}`}
                                alt="Adjunto"
                                width="150"
                                style={{ marginTop: '5px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://via.placeholder.com/150?text=Imagen';
                                }}
                              />
                            </a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Acciones */}
                <div className="actions-card">
                  <div className="actions-header">
                    <div>
                      <div className="actions-title">Actualizar ticket</div>
                      <div className="actions-subtitle">Estado, prioridad y comentario con adjunto</div>
                    </div>
                  </div>

                  <div className="actions-grid">
                    <div className="form-item">
                      <label className="form-label">Nuevo estado</label>
                      <select
                        className="form-select"
                        value={cambio.nuevoEstado || ''}
                        onChange={e => onCambio(ticket._id, 'nuevoEstado', e.target.value)}
                      >
                        <option value="" disabled>Seleccionar…</option>
                        <option value="Abierto">Abierto</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En_proceso">En proceso</option>
                        <option value="Resuelto">Resuelto</option>
                        <option value="Cerrado">Cerrado</option>
                        <option value="Reabierto">Reabierto</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>

                    <div className="form-item">
                      <label className="form-label">Nueva prioridad</label>
                      <select
                        className="form-select"
                        value={cambio.nuevaPrioridad || ''}
                        onChange={e => onCambio(ticket._id, 'nuevaPrioridad', e.target.value)}
                      >
                        <option value="" disabled>Seleccionar…</option>
                        <option value="Baja">Baja</option>
                        <option value="Media">Media</option>
                        <option value="Alta">Alta</option>
                      </select>
                    </div>

                    <div className="form-item form-item--wide">
                      <label className="form-label">Comentario</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Escribí el comentario… (podés pegar una captura con Ctrl+V)"
                        value={cambio.nuevoComentario || ''}
                        onChange={e => onCambio(ticket._id, 'nuevoComentario', e.target.value)}
                        onPaste={e => {
                          const items = e.clipboardData.items;
                          for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                              const file = items[i].getAsFile();
                              onCambio(ticket._id, 'nuevoArchivo', file);
                            }
                          }
                        }}
                        rows={3}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <div className="hint-row">
                        <span className="hint">Sugerencia: arrastrá o pegá una captura</span>
                        <span className="counter">{(cambio.nuevoComentario || '').length}/1000</span>
                      </div>
                    </div>

                    <div className="form-item form-item--wide">
                      <label className="form-label">Adjuntar imagen</label>
                      <div
                        className="dropzone pretty"
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          onCambio(ticket._id, 'nuevoArchivo', file);
                        }}
                      >
                        <input
                          id={`file-${ticket._id}`}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => onCambio(ticket._id, 'nuevoArchivo', e.target.files?.[0])}
                        />
                        <label htmlFor={`file-${ticket._id}`} className="btn btn-secondary">Elegir imagen</label>
                        {cambio.nuevoArchivo && <span className="file-name">{cambio.nuevoArchivo.name || 'captura'}</span>}
                        {cambio.nuevoArchivo && (
                          <button className="btn btn-ghost" type="button" onClick={() => onCambio(ticket._id, 'nuevoArchivo', null)}>Quitar</button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="actions-footer">
                    <button
                      onClick={() => guardarCambios(ticket._id)}
                      className="btn"
                      disabled={!!saving[ticket._id]}
                      title={saving[ticket._id] ? 'Guardando…' : 'Guardar cambios'}
                    >
                      {saving[ticket._id] ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    {mensajes[ticket._id] && <span className="status-msg">{mensajes[ticket._id]}</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Paginador */}
      {!loading && filteredTickets.length > 0 && (
        <div className="tks-pag" style={{marginTop:16}}>
          <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button>
          <span className="tks-badge">{page} / {pages}</span>
          <button className="btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
        </div>
      )}

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

export default Dashboard;
