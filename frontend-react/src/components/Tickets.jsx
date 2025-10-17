import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [comentarios, setComentarios] = useState({});
  const [usuarioActual, setUsuarioActual] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUsuarioActual(payload.correo || payload.rol || 'usuario');
    } catch {
      setUsuarioActual('usuario');
    }

    cargarTickets();
  }, [estadoFiltro, prioridadFiltro]);

  const tieneComentarioNuevoDeOtro = (ticket) => {
    const ultimo = ticket.historial?.[ticket.historial.length - 1];
    return ultimo && ultimo.autor && ultimo.autor !== usuarioActual;
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

  const agregarComentario = async (ticketId) => {
    const token = localStorage.getItem('token');
    const comentario = comentarios[ticketId];
    if (!comentario) return;

    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/tickets/${ticketId}/estado`, {
        comentario,
        estado: '',
        prioridad: ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setComentarios(prev => ({ ...prev, [ticketId]: '' }));
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
    <div>
      <h2>Mis Tickets</h2>

      {notificacion && <div style={{ background: '#ff0', padding: '10px' }}>{notificacion}</div>}

      <div style={{ marginBottom: '10px' }}>
        <select onChange={e => setEstadoFiltro(e.target.value)} value={estadoFiltro}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelto">Resuelto</option>
        </select>
        <select onChange={e => setPrioridadFiltro(e.target.value)} value={prioridadFiltro} style={{ marginLeft: '10px' }}>
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
        </select>
      </div>

      <ul>
        {Array.isArray(tickets) && tickets.length > 0 ? (
          tickets.map(ticket => (
            <li
              key={ticket._id}
              style={{
                marginBottom: '20px',
                borderBottom: '1px solid #ccc',
                paddingBottom: '10px',
                backgroundColor: tieneComentarioNuevoDeOtro(ticket) ? '#fff9c4' : '#fff'
              }}
            >
              <p><strong>Número de Ticket:</strong> {ticket.numero_ticket}</p>
              <p><strong>Estado:</strong> {ticket.estado}</p>
              <p><strong>Prioridad:</strong> {ticket.prioridad}</p>
              <p><strong>Asunto:</strong> {ticket.asunto}</p>
              <p><strong>Descripción:</strong> {ticket.descripcion}</p>
              <p><strong>Correo del usuario:</strong> {ticket.correo}</p>
              <p><strong>Fecha de creación:</strong> {new Date(ticket.fecha_creacion).toLocaleString()}</p>

              {tieneComentarioNuevoDeOtro(ticket) && (
                <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>🆕 Nuevo comentario sin leer</p>
              )}

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

              {ticket.historial && ticket.historial.length > 0 && (
                <div>
                  <p><strong>Seguimiento:</strong></p>
                  <ul>
                    {ticket.historial.map((h, i) => (
                      <li key={i}>
                        {new Date(h.fecha).toLocaleString()} - <strong>{h.estado}</strong>: {h.comentario} {h.autor && `(${h.autor})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Agregar comentario"
                  value={comentarios[ticket._id] || ''}
                  onChange={e =>
                    setComentarios(prev => ({ ...prev, [ticket._id]: e.target.value }))
                  }
                  style={{ width: '70%', marginRight: '10px' }}
                />
                <button onClick={() => agregarComentario(ticket._id)}>Comentar</button>
              </div>
            </li>
          ))
        ) : (
          <p>No hay tickets que coincidan con los filtros seleccionados.</p>
        )}
      </ul>
    </div>
  );
}

export default Tickets;