import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [mensajes, setMensajes] = useState({});              // mensajes por ticket
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [abiertos, setAbiertos] = useState({});              // control de desplegado
  const [usuarioActual, setUsuarioAtual] = useState('');
  const [cambios, setCambios] = useState({});                // cambios temporales por ticket
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const payload = jwtDecode(token);
      if (payload.rol !== 'admin') {
        navigate('/');
        return;
      }
      setUsuarioAtual(payload.email || '');
    } catch (err) {
      navigate('/login');
      return;
    }
    // cargar tickets al montar y cuando cambian filtros
    cargarTickets();
  }, [navigate, estadoFiltro, prioridadFiltro]);

  const cargarTickets = async () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // ordenar: los nuevos (pendiente + historial = 1) primero
      const ordenados = res.data.slice().sort((a, b) => {
        const aNuevo = a.estado === 'pendiente' && a.historial?.length === 1;
        const bNuevo = b.estado === 'pendiente' && b.historial?.length === 1;
        return (bNuevo ? 1 : 0) - (aNuevo ? 1 : 0);
      });
      setTickets(ordenados);
    } catch (err) {
      setTickets([]);
    }
  };

  const actualizarTicket = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoEstado, nuevaPrioridad } = cambio;

    console.log('Actualizar ticket', id, 'con', nuevoEstado, nuevaPrioridad);

    if (!nuevoEstado && !nuevaPrioridad) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ No hay cambios de estado o prioridad' }));
      return;
    }

    // Construir payload solo con campos presentes (evita enviar "" o undefined)
    const payload = {};
    if (nuevoEstado) payload.estado = nuevoEstado;
    if (nuevaPrioridad) payload.prioridad = nuevaPrioridad;

    try {
      // Intentar enviar JSON (Content-Type: application/json)
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/estado`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Actualización optimista del estado local (si tienes un estado 'tickets')
      setTickets(prev => prev.map(t => t._id === id ? { ...t, ...payload } : t));

      // limpiar los campos de cambios para ese ticket
      setCambios(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setMensajes(prev => ({ ...prev, [id]: '✅ Estado/prioridad actualizado correctamente' }));
      // Opcional: recargar listados si necesitas datos frescos desde backend
      await cargarTickets();
    } catch (err) {
      const mensajeError = err.response?.data?.message || '❌ Error al actualizar estado/prioridad';
      setMensajes(prev => ({ ...prev, [id]: mensajeError }));
    }
  };

  const agregarComentarioDesdeDashboard = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoComentario, nuevoArchivo } = cambio;

    if (!nuevoComentario && !nuevoArchivo) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ Comentario vacío' }));
      return;
    }

    const formData = new FormData();
    if (nuevoComentario) formData.append('comentario', nuevoComentario);
    if (nuevoArchivo) formData.append('imagen', nuevoArchivo);

    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/comentario`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      setCambios(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMensajes(prev => ({ ...prev, [id]: '✅ Comentario guardado' }));
      await cargarTickets();
    } catch (err) {
      const mensajeError = err.response?.data?.message || '❌ Error al guardar comentario';
      setMensajes(prev => ({ ...prev, [id]: mensajeError }));
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
      await cargarTickets();
    } catch (err) {
      console.error('Error al marcar como leído:', err.message);
    }
  };

  const toggleTicket = (id) => {
    setAbiertos(prev => {
      const nuevo = { ...prev, [id]: !prev[id] };
      return nuevo;
    });
    if (!abiertos[id]) {
      marcarLeido(id);
    }
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
  abierto: '#28a744',       
  pendiente: '#ffc107',     
  en_proceso: '#17a2b8',    
  resuelto: '#6f42c1',      
  cerrado: '#6c757d',       
  reabierto: '#fd7e14',     
  cancelado: '#dc3545'      
};

  // handler para cambiar inputs de “cambios” por ticket
  const onCambio = (id, campo, valor) => {
    setCambios(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [campo]: valor
      }
    }));
  };

  return (
    <div className="dashboard-container">
      <img src="/logo.png" alt="Logo" className="dashboard-logo" />

      <h2>Panel principal (Admin)</h2>

      <input
        type="text"
        className="dashboard-search"
        placeholder="Buscar por ticket, asunto, descripción o usuario"
        value={busquedaTexto}
        onChange={e => setBusquedaTexto(e.target.value)}
      />

      <div className="dashboard-filters">
        <select onChange={e => setEstadoFiltro(e.target.value)} value={estadoFiltro}>
          <option value="">Todos los estados</option>
          <option value="abierto">Abierto</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
          <option value="reabierto">Reabierto</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select
          onChange={e => setPrioridadFiltro(e.target.value)}
          value={prioridadFiltro}
          style={{ marginLeft: '10px' }}
        >
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </select>
      </div>

      {tickets
        .filter(ticket => {
          const coincideTexto =
            ticket.numero_ticket?.toString().includes(busquedaTexto) ||
            ticket.asunto?.toLowerCase().includes(busquedaTexto.toLowerCase()) ||
            ticket.descripcion?.toLowerCase().includes(busquedaTexto.toLowerCase()) ||
            ticket.usuario_id?.email?.toLowerCase().includes(busquedaTexto.toLowerCase());

          return coincideTexto;
        })
        .map(ticket => {
          const esNuevo = ticket.estado === 'pendiente' && ticket.historial?.length === 1;
          const abierto = abiertos[ticket._id];
          const comentarioNuevo = tieneComentarioNuevoDeOtro(ticket);
          const cambio = cambios[ticket._id] || {};

          return (
            <div
              key={ticket._id}
              className={`dashboard-ticket ${esNuevo ? 'highlight' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p><strong>Ticket #{ticket.numero_ticket}</strong></p>
                {comentarioNuevo && <span style={{ color: 'red' }}>🆕 Nuevo comentario sin leer</span>}
                <button onClick={() => toggleTicket(ticket._id)}>
                  {abierto ? '🔽 Cerrar' : '▶️ Abrir'}
                </button>
              </div>

              {!abierto && (
                <p>
                  <strong>Estado actual:</strong>{' '}
                  <span style={{
                    backgroundColor: colorEstado[ticket.estado] || '#ddd',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {ticket.estado}
                  </span>{' '}
                  / <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>{' '}
                  / <strong>Usuario:</strong> {ticket.usuario_id?.email}{' '}
                  / <strong>Fecha de creación:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}
                </p>
              )}

              {abierto && (
                <>
                  <p><strong>Asunto:</strong> {ticket.asunto}</p>
                  <p><strong>Descripción:</strong> {ticket.descripcion}</p>
                  <p>
                    <strong>Estado actual:</strong>{' '}
                    <span style={{
                      backgroundColor: colorEstado[ticket.estado] || '#ddd',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '5px'
                    }}>
                      {ticket.estado}
                    </span>{' '}
                    - <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>
                  </p>
                  <p><strong>Correo del usuario:</strong> {ticket.usuario_id?.email}</p>
                  <p><strong>Fecha de creación:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}</p>

                  {esNuevo && <p style={{ color: 'red' }}>🆕 Ticket nuevo sin procesar</p>}

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
                          style={{ border: '1px solid #ccc', marginTop: '10px' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/200?text=Imagen+no+disponible';
                          }}
                        />
                      </a>
                    </div>
                  )}

                  {ticket.historial?.length > 0 && (
                    <ul>
                      {ticket.historial.map((h, i) => (
                        <li key={i}>
                          {new Date(h.fecha).toLocaleString()} - <strong>{h.estado}</strong>: {h.comentario} {h.autor && `(${h.autor})`}
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
                                  style={{ marginTop: '5px', border: '1px solid #ccc' }}
                                />
                              </a>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ marginTop: '10px' }}>
                    <select
                      value={cambio.nuevoEstado || ''}
                      onChange={e => onCambio(ticket._id, 'nuevoEstado', e.target.value)}
                    >
                      <option value="" disabled>Nuevo estado</option>
                      <option value="abierto">Abierto</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="resuelto">Resuelto</option>
                      <option value="cerrado">Cerrado</option>
                      <option value="reabierto">Reabierto</option>
                      <option value="cancelado">Cancelado</option>
                    </select>

                    <select
                      value={cambio.nuevaPrioridad || ''}
                      onChange={e => onCambio(ticket._id, 'nuevaPrioridad', e.target.value)}
                      style={{ marginLeft: '10px' }}
                    >
                      <option value="" disabled>Nueva prioridad</option>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Comentario (puedes pegar una captura con Ctrl+V)"
                      value={cambio.nuevoComentario || ''}
                      onChange={e => onCambio(ticket._id, 'nuevoComentario', e.target.value)}
                      onPaste={e => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const file = items[i].getAsFile();
                            onCambio(ticket._id, 'nuevoArchivo', file);
                          }
                        }
                      }}
                      style={{ marginLeft: '10px' }}
                    />

                    <button
                      onClick={() => {
                        if (cambio.nuevoEstado || cambio.nuevaPrioridad) {
                          actualizarTicket(ticket._id);
                        }
                        if (cambio.nuevoComentario || cambio.nuevoArchivo) {
                          agregarComentarioDesdeDashboard(ticket._id);
                        }
                      }}
                      style={{ marginLeft: '10px' }}
                    >
                      Actualizar
                    </button>
                  </div>

                  {mensajes[ticket._id] && <p>{mensajes[ticket._id]}</p>}
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}

export default Dashboard;

