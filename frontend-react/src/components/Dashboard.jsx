import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const POLL_INTERVAL_MS = 8000; // 🔄 cada 8s revisamos novedades

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [mensajes, setMensajes] = useState({});
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const [usuarioActual, setUsuarioActual] = useState('');
  const [cambios, setCambios] = useState({});
  const [toasts, setToasts] = useState([]);
  const prevTicketsRef = useRef([]);        // 🧠 snapshot anterior para diffs
  const audioRef = useRef(null);            // 🔊 sonido opcional
  const navigate = useNavigate();

  // ====== Toasts ======
  const showToast = (message, type = 'success', ttl = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // ping suave si existe /notify.mp3
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.35;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
    window.setTimeout(() => dismissToast(id), ttl);
  };
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ====== Auth + primera carga ======
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const payload = jwtDecode(token);
      if (payload.rol !== 'admin') { navigate('/'); return; }
      setUsuarioActual(payload.email || '');
    } catch { navigate('/login'); return; }
    cargarTickets(); // primera carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, estadoFiltro, prioridadFiltro]);

  // ====== Polling para notificaciones ======
  useEffect(() => {
    const id = setInterval(() => {
      cargarTickets(true); // true: modo silencioso pero con diff/notify
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro, prioridadFiltro, usuarioActual]);

  // ====== Fetch + diff ======
  const cargarTickets = async (desdeIntervalo = false) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/tickets?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ordenados = res.data.slice().sort((a, b) => {
        const aNuevo = a.estado === 'pendiente' && a.historial?.length === 1;
        const bNuevo = b.estado === 'pendiente' && b.historial?.length === 1;
        return (bNuevo ? 1 : 0) - (aNuevo ? 1 : 0);
      });

      // 🔔 comparar contra snapshot anterior SOLO si viene del intervalo o ya había snapshot
      if (desdeIntervalo || prevTicketsRef.current.length) {
        diffAndNotify(prevTicketsRef.current, ordenados);
      }

      prevTicketsRef.current = ordenados;
      setTickets(ordenados);
    } catch (err) {
      console.error('Error cargando tickets:', err.response?.data || err.message);
      setTickets([]);
      if (!desdeIntervalo) showToast('No se pudieron cargar los tickets.', 'error');
    }
  };

  // ====== Motor de diferencias para notificaciones ======
  const diffAndNotify = (prev, next) => {
    const prevMap = new Map(prev.map(t => [t._id, t]));
    const nextMap = new Map(next.map(t => [t._id, t]));

    // 1) Nuevos tickets
    for (const t of next) {
      if (!prevMap.has(t._id)) {
        showToast(`🆕 Nuevo ticket #${t.numero_ticket}: ${t.asunto || 'sin asunto'}`, 'info');
      }
    }

    // 2) Cambios por ticket
    for (const t of next) {
      const old = prevMap.get(t._id);
      if (!old) continue;

      // 2.a) Estado/Prioridad
      if (old.estado !== t.estado || old.prioridad !== t.prioridad) {
        const cambiosTxt = [
          old.estado !== t.estado ? `estado: ${old.estado} → ${t.estado}` : null,
          old.prioridad !== t.prioridad ? `prioridad: ${old.prioridad} → ${t.prioridad}` : null
        ].filter(Boolean).join(' | ');
        showToast(`✏️ Ticket #${t.numero_ticket} actualizado (${cambiosTxt})`, 'info');
      }

      // 2.b) Imagen en el ticket principal
      if (old.imagen !== t.imagen && t.imagen) {
        showToast(`🖼️ Ticket #${t.numero_ticket} recibió una imagen`, 'info');
      }

      // 2.c) Historial (comentarios/adjuntos nuevos)
      const oldLen = old.historial?.length || 0;
      const newLen = t.historial?.length || 0;
      if (newLen > oldLen) {
        const nuevos = t.historial.slice(oldLen); // entradas nuevas
        // ¿hay alguno de otro usuario?
        const hayDeOtro = nuevos.some(h => h.autor && h.autor !== usuarioActual);
        const hayImagen = nuevos.some(h => !!h.imagen);
        if (hayDeOtro) {
          showToast(`💬 Nuevo comentario en #${t.numero_ticket} de ${nuevos.find(h => h.autor && h.autor !== usuarioActual)?.autor}`, 'success');
        } else {
          showToast(`💬 Nuevo comentario en #${t.numero_ticket}`, 'success');
        }
        if (hayImagen) {
          showToast(`🖼️ Nueva imagen en comentarios de #${t.numero_ticket}`, 'info');
        }
      } else if (newLen && oldLen) {
        // incluso si no creció el length, puede cambiar el último (ediciones):
        const oldLast = old.historial[oldLen - 1];
        const newLast = t.historial[newLen - 1];
        if (oldLast?.fecha !== newLast?.fecha || oldLast?.comentario !== newLast?.comentario || oldLast?.imagen !== newLast?.imagen) {
          const otroAutor = newLast?.autor && newLast.autor !== usuarioActual;
          showToast(
            `${otroAutor ? '🔔' : '✏️'} ${otroAutor ? 'Actualización de otro usuario' : 'Actualización'} en #${t.numero_ticket}`,
            'info'
          );
        }
      }
    }
  };

  // ====== Acciones user ======
  const actualizarTicket = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoEstado, nuevaPrioridad } = cambio;

    if (!nuevoEstado && !nuevaPrioridad) {
      setMensajes(p => ({ ...p, [id]: '⚠️ No hay cambios de estado o prioridad' }));
      showToast('No hay cambios de estado o prioridad', 'info');
      return;
    }

    const payload = {};
    if (nuevoEstado) payload.estado = nuevoEstado;
    if (nuevaPrioridad) payload.prioridad = nuevaPrioridad;

    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/estado`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      setTickets(prev => prev.map(t => (t._id === id ? { ...t, ...payload } : t)));

      setCambios(prev => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id].nuevoEstado;
          delete next[id].nuevaPrioridad;
          if (!Object.keys(next[id]).length) delete next[id];
        }
        return next;
      });

      setMensajes(p => ({ ...p, [id]: '✅ Estado/prioridad actualizado correctamente' }));
      showToast('Estado / prioridad actualizado', 'success');
      await cargarTickets(true); // refrescá y deja que diff informe si corresponde
    } catch (err) {
      console.error('Actualizar estado/prioridad error:', err.response?.data || err.message);
      const mensajeError = err.response?.data?.message || '❌ Error al actualizar estado/prioridad';
      setMensajes(p => ({ ...p, [id]: mensajeError }));
      showToast('Error al actualizar estado/prioridad', 'error');
    }
  };

  const agregarComentarioDesdeDashboard = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoComentario, nuevoArchivo } = cambio;

    if (!nuevoComentario && !nuevoArchivo) {
      setMensajes(p => ({ ...p, [id]: '⚠️ Comentario vacío' }));
      showToast('Comentario vacío', 'info');
      return;
    }

    const formData = new FormData();
    if (nuevoComentario) formData.append('comentario', nuevoComentario);
    if (nuevoArchivo) formData.append('imagen', nuevoArchivo);

    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/comentario`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCambios(prev => {
        const next = { ...prev };
        const curr = next[id];
        if (curr?.previewUrl) URL.revokeObjectURL(curr.previewUrl);
        if (next[id]) {
          delete next[id].nuevoComentario;
          delete next[id].nuevoArchivo;
          delete next[id].previewUrl;
          if (!Object.keys(next[id]).length) delete next[id];
        }
        return next;
      });

      setMensajes(p => ({ ...p, [id]: '✅ Comentario guardado' }));
      showToast('Comentario agregado', 'success');
      await cargarTickets(true);
    } catch (err) {
      console.error('Comentario error:', err.response?.data || err.message);
      const mensajeError = err.response?.data?.message || '❌ Error al guardar comentario';
      setMensajes(p => ({ ...p, [id]: mensajeError }));
      showToast('Error al guardar comentario', 'error');
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
      await cargarTickets(true);
    } catch (err) {
      console.error('Error al marcar como leído:', err.response?.data || err.message);
    }
  };

  const toggleTicket = (id) => {
    setAbiertos(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) marcarLeido(id);
      return next;
    });
  };

  const tieneComentarioNuevoDeOtro = (ticket) => {
    const ultimo = ticket.historial?.[ticket.historial.length - 1];
    if (!ultimo) return false;
    if (ultimo.autor === usuarioActual) return false;
    const registro = ticket.leidoPor?.find(l => l.usuario === usuarioActual);
    if (!registro) return true;
    return new Date(ultimo.fecha) > new Date(registro.fecha);
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

  const conteos = useMemo(() => {
    const inicial = {
      abierto: 0,
      pendiente: 0,
      en_proceso: 0,
      resuelto: 0,
      cerrado: 0,
      reabierto: 0,
      cancelado: 0,
      total: 0,
    };
    return tickets.reduce((acc, t) => {
      const est = String(t.estado || '').toLowerCase();
      if (est && Object.prototype.hasOwnProperty.call(acc, est)) acc[est] += 1;
      acc.total += 1;
      return acc;
    }, inicial);
  }, [tickets]);

  const onCambio = (id, campo, valor) => {
    setCambios(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const handleImage = (ticketId, file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const named = new File(
      [file],
      file.name && file.name !== 'blob'
        ? file.name
        : `captura-${Date.now()}.${file.type?.split('/')[1] || 'png'}`,
      { type: file.type || 'image/png' }
    );
    setCambios(prev => {
      const prevItem = prev[ticketId];
      if (prevItem?.previewUrl) URL.revokeObjectURL(prevItem.previewUrl);
      const previewUrl = URL.createObjectURL(named);
      return { ...prev, [ticketId]: { ...prevItem, nuevoArchivo: named, previewUrl } };
    });
  };

  const handlePasteAsFile = (ticketId, e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const named = new File(
          [blob],
          `captura-${Date.now()}.${blob?.type?.split('/')[1] || 'png'}`,
          { type: blob?.type || 'image/png' }
        );
        handleImage(ticketId, named);
      }
    }
  };

  const buscador = (ticket) => {
    const q = busquedaTexto.trim().toLowerCase();
    if (!q) return true;
    return (
      ticket.numero_ticket?.toString().includes(q) ||
      ticket.asunto?.toLowerCase().includes(q) ||
      ticket.descripcion?.toLowerCase().includes(q) ||
      ticket.usuario_id?.email?.toLowerCase().includes(q)
    );
  };

  // ==== Chips de filtro rápido ====
  const estados = ['abierto','pendiente','en_proceso','resuelto','cerrado','reabierto','cancelado'];
  const prioridades = ['baja','media','alta'];

  const ChipFiltro = ({ active, label, onClick, className='' }) => (
    <button
      type="button"
      className={`chip chip-filter ${active ? 'chip-active' : ''} ${className}`}
      onClick={onClick}
      title={active ? 'Quitar filtro' : 'Aplicar filtro'}
    >
      {label}
    </button>
  );

  // ======= Acciones por ticket (textarea local-only) =======
  const TicketActions = ({ ticket, cambio }) => {
    const [comentarioLocal, setComentarioLocal] = React.useState('');
    const canUpdateEstadoPrioridad = !!(cambio?.nuevoEstado || cambio?.nuevaPrioridad);
    const canUpdateComentario = !!(comentarioLocal || cambio?.nuevoArchivo);
    const canUpdate = canUpdateEstadoPrioridad || canUpdateComentario;
    const comentarioLength = comentarioLocal.length;
    const comentarioMax = 1000;

    const limpiarImagen = () => {
      setCambios(prev => {
        const next = { ...prev };
        const curr = next[ticket._id];
        if (curr?.previewUrl) URL.revokeObjectURL(curr.previewUrl);
        if (next[ticket._id]) {
          delete next[ticket._id].nuevoArchivo;
          delete next[ticket._id].previewUrl;
          if (!Object.keys(next[ticket._id]).length) delete next[ticket._id];
        }
        return next;
      });
    };

    const doActualizar = async () => {
      if (canUpdateEstadoPrioridad) await actualizarTicket(ticket._id);
      if (canUpdateComentario) {
        onCambio(ticket._id, 'nuevoComentario', comentarioLocal);
        await agregarComentarioDesdeDashboard(ticket._id);
        setComentarioLocal('');
      }
    };

    return (
      <div className="actions-card">
        <div className="actions-header">
          <div>
            <div className="actions-title">Acciones rápidas</div>
            <div className="actions-subtitle">Actualizá estado, prioridad y agregá un comentario o imagen</div>
          </div>
        </div>

        <div className="actions-grid">
          <div className="form-item">
            <label className="form-label">Nuevo estado</label>
            <select
              className="form-select"
              value={cambio?.nuevoEstado || ''}
              onChange={e => onCambio(ticket._id, 'nuevoEstado', e.target.value)}
            >
              <option value="" disabled>Seleccionar</option>
              {estados.map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
            </select>
          </div>

          <div className="form-item">
            <label className="form-label">Nueva prioridad</label>
            <select
              className="form-select"
              value={cambio?.nuevaPrioridad || ''}
              onChange={e => onCambio(ticket._id, 'nuevaPrioridad', e.target.value)}
            >
              <option value="" disabled>Seleccionar</option>
              {prioridades.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-item form-item--wide">
            <label className="form-label">Comentario</label>
            <textarea
              className="form-textarea"
              placeholder="Escribí un comentario… (podés pegar una captura con Ctrl+V)"
              maxLength={comentarioMax}
              value={comentarioLocal}
              onChange={e => setComentarioLocal(e.target.value)}
              onPaste={e => handlePasteAsFile(ticket._id, e)}
              rows={3}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="hint-row">
              <span className="hint">Sugerencia: arrastrá una imagen o pegala con Ctrl+V</span>
              <span className="counter">{comentarioLength}/{comentarioMax}</span>
            </div>
          </div>

          <div className="form-item form-item--wide">
            <label className="form-label">Adjuntar imagen</label>
            <div
              className="dropzone pretty"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; handleImage(ticket._id, file); }}
              onPaste={e => handlePasteAsFile(ticket._id, e)}
            >
              <input
                id={`file-${ticket._id}`}
                type="file"
                accept="image/*"
                onChange={e => handleImage(ticket._id, e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <label htmlFor={`file-${ticket._id}`} className="btn btn-secondary">🖼️ Elegir imagen</label>

              {cambio?.nuevoArchivo && <span className="file-name"> {cambio.nuevoArchivo.name}</span>}

              {(cambio?.nuevoArchivo || cambio?.previewUrl) && (
                <button type="button" className="btn btn-ghost" onClick={limpiarImagen}>✖ Quitar</button>
              )}
            </div>

            {cambio?.previewUrl && (
              <div className="preview-wrap">
                <img className="preview-img" src={cambio.previewUrl} alt="Preview" />
              </div>
            )}
          </div>
        </div>

        <div className="actions-footer">
          <button className="btn" disabled={!canUpdate} onClick={doActualizar} title={!canUpdate ? 'Hacé un cambio para activar' : 'Actualizar'}>
            🔄 Actualizar
          </button>
          {mensajes[ticket._id] && <span className="status-msg">{mensajes[ticket._id]}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">

      {/* ===== RESUMEN clickeable ===== */}
      <div className="dashboard-resumen">
        {[
          ['abierto', conteos.abierto],
          ['pendiente', conteos.pendiente],
          ['en_proceso', conteos.en_proceso],
          ['resuelto', conteos.resuelto],
          ['reabierto', conteos.reabierto],
          ['cancelado', conteos.cancelado],
          ['cerrado', conteos.cerrado],
        ].map(([estado, qty]) => (
          <button
            key={estado}
            className={`resumen-card clickable ${estadoFiltro === estado ? 'is-active' : ''}`}
            style={{ borderLeft: `6px solid ${colorEstado[estado]}` }}
            onClick={() => setEstadoFiltro(prev => (prev === estado ? '' : estado))}
            title={estadoFiltro === estado ? 'Quitar filtro' : `Filtrar por ${estado}`}
          >
            <div className="resumen-title">{estado.replace('_',' ')}</div>
            <div className="resumen-value">{qty}</div>
          </button>
        ))}
        <div
          className="resumen-card total"
          onClick={() => { setEstadoFiltro(''); setPrioridadFiltro(''); showToast('Filtros limpiados', 'info'); }}
          title="Limpiar filtros"
        >
          <div className="resumen-title">Total</div>
          <div className="resumen-value">{conteos.total}</div>
        </div>
      </div>

      <img src="/logo.png" alt="Logo" className="dashboard-logo" />
      <h2>Panel principal (Admin)</h2>

      {/* Buscador */}
      <input
        type="text"
        className="dashboard-search"
        placeholder="Buscar por ticket, asunto, descripción o usuario"
        value={busquedaTexto}
        onChange={e => setBusquedaTexto(e.target.value)}
      />

      {/* Filtros + chips rápidos */}
      <div className="dashboard-filters">
        <select onChange={e => setEstadoFiltro(e.target.value)} value={estadoFiltro}>
          <option value="">Todos los estados</option>
          {['abierto','pendiente','en_proceso','resuelto','cerrado','reabierto','cancelado'].map(e => (
            <option key={e} value={e}>{e.replace('_',' ')}</option>
          ))}
        </select>
        <select onChange={e => setPrioridadFiltro(e.target.value)} value={prioridadFiltro}>
          <option value="">Todas las prioridades</option>
          {['baja','media','alta'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="fast-filters">
        <div className="fast-group">
          <span className="fast-label">Estados:</span>
          {['abierto','pendiente','en_proceso','resuelto','cerrado','reabierto','cancelado'].map(e => (
            <ChipFiltro
              key={e}
              label={e.replace('_',' ')}
              active={estadoFiltro === e}
              className={`state-${e}`}
              onClick={() => setEstadoFiltro(prev => (prev === e ? '' : e))}
            />
          ))}
        </div>
        <div className="fast-group">
          <span className="fast-label">Prioridad:</span>
          {['baja','media','alta'].map(p => (
            <ChipFiltro
              key={p}
              label={p}
              active={prioridadFiltro === p}
              className={`prio-${p}`}
              onClick={() => setPrioridadFiltro(prev => (prev === p ? '' : p))}
            />
          ))}
        </div>
        {(estadoFiltro || prioridadFiltro) && (
          <button className="btn btn-ghost btn-clear" onClick={() => { setEstadoFiltro(''); setPrioridadFiltro(''); showToast('Filtros limpiados', 'info'); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      {tickets
        .filter(buscador)
        .map(ticket => {
          const esNuevo = ticket.estado === 'pendiente' && ticket.historial?.length === 1;
          const abierto = !!abiertos[ticket._id];
          const comentarioNuevo = tieneComentarioNuevoDeOtro(ticket);
          const cambio = cambios[ticket._id] || {};

          return (
            <div key={ticket._id} className={`dashboard-ticket ${esNuevo ? 'highlight' : ''}`}>
              <div className="dashboard-ticket-header">
                <p><strong>Ticket #{ticket.numero_ticket}</strong></p>
                {comentarioNuevo && <span className="dashboard-new-comment">🆕 Nuevo comentario sin leer</span>}
                <button onClick={() => toggleTicket(ticket._id)}>
                  {abierto ? '🔽 Cerrar' : '▶️ Abrir'}
                </button>
              </div>

              {/* META */}
              <div className="ticket-meta">
                <div className="meta-item">
                  <strong>Estado:</strong>{' '}
                  <span className={`dashboard-status ${ticket.estado}`} style={{ backgroundColor: colorEstado[ticket.estado] || '#ddd' }}>
                    {ticket.estado}
                  </span>
                </div>
                <div className="meta-item">
                  <strong>Prioridad:</strong>{' '}
                  <span className={`chip prio-${ticket.prioridad}`}>{ticket.prioridad}</span>
                </div>
                <div className="meta-item"><strong>Usuario:</strong> {ticket.usuario_id?.email}</div>
                <div className="meta-item"><strong>Creado:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}</div>
              </div>

              {!abierto && (
                <>
                  {ticket.asunto && <p><strong>Asunto:</strong> {ticket.asunto}</p>}
                  <hr className="hr-soft" />
                </>
              )}

              {abierto && (
                <>
                  {ticket.asunto && <p><strong>Asunto:</strong> {ticket.asunto}</p>}
                  {ticket.descripcion && <p><strong>Descripción:</strong> {ticket.descripcion}</p>}
                  {esNuevo && <p style={{ color: '#e11d48' }}>🆕 Ticket nuevo sin procesar</p>}

                  {ticket.imagen && (
                    <div>
                      <p><strong>Imagen adjunta:</strong></p>
                      <a
                        href={`${import.meta.env.VITE_BACKEND_URL}/uploads/${ticket.imagen}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={`${import.meta.env.VITE_BACKEND_URL}/uploads/${ticket.imagen}`}
                          alt="Adjunto"
                          width="200"
                          style={{ border: '1px solid #ccc', marginTop: '10px', borderRadius: 8 }}
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://via.placeholder.com/200?text=Imagen+no+disponible'; }}
                        />
                      </a>
                    </div>
                  )}

                  {ticket.historial?.length > 0 && (
                    <ul className="dashboard-history">
                      {ticket.historial.map((h, i) => (
                        <li key={i}>
                          {new Date(h.fecha).toLocaleString()} — <strong>{h.estado}</strong>: {h.comentario} {h.autor && `(${h.autor})`}
                          {h.imagen && (
                            <div>
                              <a
                                href={`${import.meta.env.VITE_BACKEND_URL}/uploads/${h.imagen}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={`${import.meta.env.VITE_BACKEND_URL}/uploads/${h.imagen}`}
                                  alt="Adjunto"
                                  width="150"
                                  style={{ marginTop: '6px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                                />
                              </a>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <TicketActions ticket={ticket} cambio={cambio} />
                </>
              )}
            </div>
          );
        })}

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">{t.type === 'success' ? '✅' : t.type === 'error' ? '⛔' : 'ℹ️'}</div>
            <div className="toast-msg">{t.message}</div>
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Cerrar">✖</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
