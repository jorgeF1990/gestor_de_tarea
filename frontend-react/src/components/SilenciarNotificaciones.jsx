import React, { useState, useEffect } from 'react';
import API from '../api';
import { Bell, BellOff, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import './SilenciarNotificaciones.css';

const SilenciarNotificaciones = ({ ticketId, onEstadoCambiado }) => {
  const [estado, setEstado] = useState({ habilitadas: true, silenciadoHasta: null });
  const [loading, setLoading] = useState(false);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const opcionesDias = [
    { dias: 7, label: '1 semana' },
    { dias: 14, label: '2 semanas' },
    { dias: 30, label: '1 mes' },
    { dias: 90, label: '3 meses' },
    { dias: 365, label: '1 año' }
  ];

  const cargarEstado = async () => {
    if (!ticketId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await API.get(`/tickets/${ticketId}/notificaciones/estado`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstado(res.data);
    } catch (error) {
      console.error('Error al cargar estado:', error);
    }
  };

  useEffect(() => {
    if (ticketId) {
      cargarEstado();
    }
  }, [ticketId]);

  const silenciar = async (dias) => {
    setLoading(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      await API.post(
        `/tickets/${ticketId}/silenciar`,
        { dias },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await cargarEstado();
      setMostrarOpciones(false);
      setMensaje({ type: 'success', text: `Notificaciones silenciadas por ${dias} días` });
      if (onEstadoCambiado) onEstadoCambiado();
      setTimeout(() => setMensaje(null), 5000);
    } catch (error) {
      setMensaje({ type: 'error', text: error.response?.data?.error || 'Error al silenciar' });
    } finally {
      setLoading(false);
    }
  };

  const reanudar = async () => {
    setLoading(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      await API.post(
        `/tickets/${ticketId}/reanudar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await cargarEstado();
      setMensaje({ type: 'success', text: 'Notificaciones reanudadas' });
      if (onEstadoCambiado) onEstadoCambiado();
      setTimeout(() => setMensaje(null), 5000);
    } catch (error) {
      setMensaje({ type: 'error', text: error.response?.data?.error || 'Error al reanudar' });
    } finally {
      setLoading(false);
    }
  };

  const estaSilenciado = () => {
    if (!estado.silenciadoHasta) return false;
    return new Date(estado.silenciadoHasta) > new Date();
  };

  const silenciadoHasta = estado.silenciadoHasta 
    ? new Date(estado.silenciadoHasta).toLocaleDateString()
    : null;

  if (estaSilenciado()) {
    return (
      <div className="silenciar-notificaciones silenciado">
        <div className="silenciar-icon">
          <BellOff size={20} />
        </div>
        <div className="silenciar-info">
          <div className="silenciar-titulo">Notificaciones silenciadas</div>
          <div className="silenciar-subtitulo">Hasta {silenciadoHasta}</div>
        </div>
        <button className="btn-reanudar" onClick={reanudar} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <Bell size={16} />}
          {loading ? 'Procesando...' : 'Reanudar'}
        </button>
      </div>
    );
  }

  return (
    <div className="silenciar-notificaciones">
      {mensaje && (
        <div className={`silenciar-mensaje ${mensaje.type}`}>
          {mensaje.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {mensaje.text}
        </div>
      )}
      
      {!mostrarOpciones ? (
        <button className="btn-silenciar" onClick={() => setMostrarOpciones(true)} disabled={loading}>
          <BellOff size={16} />
          Silenciar notificaciones
        </button>
      ) : (
        <div className="silenciar-opciones">
          <div className="silenciar-opciones-titulo">
            <BellOff size={16} />
            Silenciar por:
          </div>
          <div className="silenciar-opciones-botones">
            {opcionesDias.map(op => (
              <button key={op.dias} className="btn-opcion" onClick={() => silenciar(op.dias)} disabled={loading}>
                <Clock size={14} />
                {op.label}
              </button>
            ))}
          </div>
          <button className="btn-cancelar" onClick={() => setMostrarOpciones(false)} disabled={loading}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default SilenciarNotificaciones;