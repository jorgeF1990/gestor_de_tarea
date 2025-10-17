import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [mensajes, setMensajes] = useState({});
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const { rol } = jwtDecode(token);
      if (rol !== 'admin') return navigate('/');
    } catch {
      return navigate('/login');
    }

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

      const ordenados = res.data.sort((a, b) => {
        const aNuevo = a.estado === 'pendiente' && a.historial.length === 1;
        const bNuevo = b.estado === 'pendiente' && b.historial.length === 1;
        return bNuevo - aNuevo;
      });

      setTickets(ordenados);
    } catch {
      setTickets([]);
    }
  };

  const actualizarTicket = async (id, estado, prioridad, comentario) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/tickets/${id}/estado`, {
        estado,
        prioridad,
        comentario
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTickets(prev =>
        prev.map(t =>
          t._id === id ? { ...t, nuevoComentario: '' } : t
        )
      );

      setMensajes(prev => ({ ...prev, [id]: 'Ticket actualizado' }));
      cargarTickets();
    } catch {
      setMensajes(prev => ({ ...prev, [id]: 'Error al actualizar ticket' }));
    }
  };

  const colorEstado = {
    pendiente: '#d9534f',
    en_proceso: '#f0ad4e',
    resuelto: '#5cb85c'
  };

  const toggleTicket = (id) => {
    setAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <h2>Panel principal (Admin)</h2>

      <input
        type="text"
        placeholder="🔍 Buscar por ticket, asunto, descripción o usuario"
        value={busquedaTexto}
        onChange={e => setBusquedaTexto(e.target.value)}
        style={{ marginBottom: '10px', width: '50%', padding: '8px' }}
      />

      <div style={{ marginBottom: '20px' }}>
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

      {tickets
        .filter(ticket => {
          const coincideTexto =
            ticket.numero_ticket?.toString().includes(busquedaTexto) ||
            ticket.asunto?.toLowerCase().includes(busquedaTexto.toLowerCase()) ||
            ticket.descripcion?.toLowerCase().includes(busquedaTexto.toLowerCase()) ||
            ticket.correo?.toLowerCase().includes(busquedaTexto.toLowerCase());

          const ocultarResueltos = ticket.estado === 'resuelto' && estadoFiltro !== 'resuelto';

          return coincideTexto;
        })
        .map(ticket => {
          const esNuevo = ticket.estado === 'pendiente' && ticket.historial.length === 1;
          const abierto = abiertos[ticket._id];

          return (
            <div
              key={ticket._id}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '20px',
                backgroundColor: esNuevo ? '#fff8dc' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p><strong>Ticket #{ticket.numero_ticket}</strong></p>
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
                  - <strong>Prioridad:</strong> <em>{ticket.prioridad}</em>{' '}
                  <strong>Usuario:</strong> {ticket.correo}
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
                  <p><strong>Usuario:</strong> {ticket.correo}</p>
                  {esNuevo && <p style={{ color: 'red' }}>🆕 Ticket nuevo sin procesar</p>}

                  {ticket.imagen && (
                    <img
                      src={`${import.meta.env.VITE_BACKEND_URL}/uploads/${ticket.imagen}`}
                      alt="Adjunto"
                      width="200"
                      style={{ marginBottom: '10px' }}
                    />
                  )}

                  {ticket.historial?.length > 0 && (
                    <ul>
                      {ticket.historial.map((h, i) => (
                        <li key={i}>
                          {new Date(h.fecha).toLocaleString()} - <strong>{h.estado}</strong>: {h.comentario}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ marginTop: '10px' }}>
                    <select
                      onChange={e => setTickets(prev =>
                        prev.map(t => t._id === ticket._id ? { ...t, nuevoEstado: e.target.value } : t)
                      )}
                      defaultValue=""
                    >
                      <option value="" disabled>Nuevo estado</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="resuelto">Resuelto</option>
                    </select>

                    <select
                      onChange={e => setTickets(prev =>
                        prev.map(t => t._id === ticket._id ? { ...t, nuevaPrioridad: e.target.value } : t)
                      )}
                      defaultValue=""
                      style={{ marginLeft: '10px' }}
                    >
                      <option value="" disabled>Nueva prioridad</option>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Comentario"
                      value={ticket.nuevoComentario || ''}
                      onChange={e => setTickets(prev =>
                        prev.map(t => t._id === ticket._id ? { ...t, nuevoComentario: e.target.value } : t)
                      )}
                      style={{ marginLeft: '10px' }}
                    />

                    <button
                      onClick={() =>
                        actualizarTicket(ticket._id, ticket.nuevoEstado, ticket.nuevaPrioridad, ticket.nuevoComentario)
                      }
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
