import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Tickets.css';

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [comentarios, setComentarios] = useState({});
  const [usuarioActual, setUsuarioActual] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUsuarioActual(payload.email || 'usuario');
    } catch {
      setUsuarioActual('usuario');
    }
    cargarTickets();
  }, [estadoFiltro, prioridadFiltro]);

  const tieneComentarioNuevoDeOtro = (ticket) => {
    const ultimo = ticket.historial?.[ticket.historial.length - 1];
    if (!ultimo) return false;
    if (ultimo.autor === usuarioActual) return false;
    const registroLectura = ticket.leidoPor?.find(l => l.usuario === usuarioActual);
    if (!registroLectura) return true;
    return new Date(ultimo.fecha) > new Date(registroLectura.fecha);
  };

  const toggleTicket = async (id) => {
    const nuevoEstado = !abiertos[id];
    setAbiertos(prev => ({ ...prev, [id]: nuevoEstado }));
    if (nuevoEstado) {
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
    }
  };

  const cargarTickets = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ordenados = res.data.sort((a, b) => {
        const aNuevo = tieneComentarioNuevoDeOtro(a);
        const bNuevo = tieneComentarioNuevoDeOtro(b);
        if (aNuevo && !bNuevo) return -1;
        if (!aNuevo && bNuevo) return 1;
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      });
      setTickets(ordenados);
    } catch (err) {
      console.error('Error al cargar tickets:', err.message);
      setTickets([]);
    }
  };

  // función
  const agregarComentario = async (ticketId) => {
    const token = localStorage.getItem('token');
    const data = comentarios[ticketId];
    if (!data?.texto && !data?.archivo) return;

    const formData = new FormData();
    if (data.texto) formData.append('comentario', data.texto);
    if (data.archivo) formData.append('imagen', data.archivo);

    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/tickets/${ticketId}/comentario`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            //'Content-Type': 'multipart/form-data'
          }
        }
      );
      setComentarios(prev => ({ ...prev, [ticketId]: { texto: '', archivo: null } }));
      cargarTickets();
    } catch (err) {
      console.error('Error al agregar comentario:', err.message);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const nuevos = Math.floor(Math.random() * 3);
      if (nuevos > 0) {
        setNotificacion(`¡Hay ${nuevos} nuevos tickets!`);
        setTimeout(() => setNotificacion(''), 5000);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="tickets-container">
      <img src="/logo.png" alt="Logo" className="tickets-logo" />
      <h1 className="text-2xl font-bold text-black">Portfolio Investment</h1>
      <h2>Mis Tickets</h2>
      <p>Gestioná y realizá seguimiento de tus solicitudes de soporte.</p>
      <div className="ticket-filters">
        <select onChange={e => setEstadoFiltro(e.target.value)} value={estadoFiltro}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
        </select>
        <select onChange={e => setPrioridadFiltro(e.target.value)} value={prioridadFiltro}>
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </select>
      </div>
      <ul>
        {Array.isArray(tickets) && tickets.length > 0 ? (
          tickets.map(ticket => {
            const abierto = abiertos[ticket._id];
            const comentarioNuevo = tieneComentarioNuevoDeOtro(ticket);
            return (
              <li
                key={ticket._id}
                className={`ticket-item ${comentarioNuevo ? 'highlight' : ''}`}
              >
                <div className="ticket-header">
                  <p><strong>Ticket #{ticket.numero_ticket}</strong></p>
                  <button onClick={() => toggleTicket(ticket._id)}>
                    {abierto ? '🔽 Cerrar' : '▶️ Abrir'}
                  </button>
                </div>

                {!abierto && (
                  <>
                    <p>
                      <strong>Estado:</strong>{' '}
                      <span className={`ticket-status status-${ticket.estado}`}>{ticket.estado}</span>{' '}
                      / <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>
                      / <strong>Usuario:</strong> {ticket.usuario_id?.email}</p>
                    / <strong>asunto:</strong> {ticket.asunto}
                    / <strong>Descripción:</strong> {ticket.descripcion}
                    <p><strong>Fecha de creación:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}</p>

                  </>
                )}

                {comentarioNuevo && (
                  <p className="ticket-nuevo-comentario">New unread comment</p>
                )}

                {abierto && (
                  <>
                    <p><strong>Estado:</strong> <span className={`ticket-status status-${ticket.estado}`}>{ticket.estado}</span></p>
                    <p><strong>Prioridad:</strong> {ticket.prioridad}</p>
                    <p><strong>Asunto:</strong> {ticket.asunto}</p>
                    <p><strong>Descripción:</strong> {ticket.descripcion}</p>
                    <p><strong>Correo del usuario:</strong> {ticket.usuario_id?.email}</p>
                    <p><strong>Fecha de creación:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}</p>

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
                      <div className="ticket-followup">
                        <p><strong>Seguimiento:</strong></p>
                        <ul>
                          {ticket.historial.map((h, i) => (
                            <li
                              key={i}
                              className={h.autor && h.autor !== usuarioActual ? 'highlight' : ''}
                              style={{ marginBottom: '1rem' }}
                            >
                              <p>
                                <strong>{new Date(h.fecha).toLocaleString()}</strong> — <em>{h.estado}</em><br />
                                {h.comentario} {h.autor && <span>({h.autor})</span>}
                              </p>

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
                                      width="200"
                                      style={{
                                        marginTop: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                      }}
                                    />
                                  </a>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="ticket-btn-wrapper">
                      <input
                        type="text"
                        placeholder="Agregar comentario"
                        value={comentarios[ticket._id]?.texto || ''}
                        onChange={e =>
                          setComentarios(prev => ({
                            ...prev,
                            [ticket._id]: { ...prev[ticket._id], texto: e.target.value }
                          }))
                        }
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e =>
                          setComentarios(prev => ({
                            ...prev,
                            [ticket._id]: { ...prev[ticket._id], archivo: e.target.files[0] }
                          }))
                        }
                      />
                      <button onClick={() => agregarComentario(ticket._id)} className="ticket-btn">Comentar</button>
                    </div>
                  </>
                )}
              </li>
            );
          })
        ) : (
          <p>No hay tickets que coincidan con los filtros seleccionados.</p>
        )}
      </ul>
    </div>
  );
}

export default Tickets;
