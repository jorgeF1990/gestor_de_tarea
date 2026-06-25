import React, { useState, useEffect } from 'react';
import API from '../api';
import { 
  UserPlus, 
  UserMinus, 
  User, 
  X, 
  Check, 
  Users, 
  Plus, 
  Loader2,
  Crown,
  Wrench
} from 'lucide-react';
import './AsignarUsuarios.css';


export default function AsignarUsuarios({ 
  ticketId,
  selectedUsers = [],
  onUsersChange,
  onAsignacionCambio,
  soloLectura = false
}) {
  const [asignados, setAsignados] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  
  const isEditMode = !!ticketId;
  const isCreateMode = !ticketId && onUsersChange !== undefined;
  const isViewMode = soloLectura;

  const cargarAsignados = async () => {
    if (!isEditMode) return;
    try {
      const res = await API.get(`/tickets/${ticketId}/asignados`);
      setAsignados(res.data || []);
    } catch (error) {
      console.error('Error al cargar asignados:', error);
      setAsignados([]);
    }
  };

  const cargarUsuariosDisponibles = async () => {
    try {
      const res = await API.get('/tickets/usuarios/disponibles');
      setUsuariosDisponibles(res.data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setUsuariosDisponibles([]);
    }
  };

  useEffect(() => {
    if (isEditMode && ticketId) {
      setCargando(true);
      Promise.all([cargarAsignados(), cargarUsuariosDisponibles()]).finally(() => {
        setCargando(false);
      });
    } else if (isCreateMode) {
      cargarUsuariosDisponibles().finally(() => setCargando(false));
    } else {
      setCargando(false);
    }
  }, [ticketId]);

  const getUsuariosActuales = () => {
    if (isEditMode) return asignados;
    if (isCreateMode) return selectedUsers || [];
    return [];
  };

  const usuariosActuales = getUsuariosActuales();
  const usuariosNoAsignados = usuariosDisponibles.filter(
    u => !usuariosActuales.some(a => a._id === u._id)
  );

  const asignarUsuario = async (usuarioId, userEmail, userData) => {
    setLoading(true);
    
    if (isEditMode) {
      try {
        await API.post(`/tickets/${ticketId}/asignar`, { usuarioId });
        await cargarAsignados();
        await cargarUsuariosDisponibles();
        setMostrarSelector(false);
        setMensaje({ type: 'success', text: `Usuario ${userEmail} asignado correctamente` });
        setTimeout(() => setMensaje(null), 3000);
        if (onAsignacionCambio) onAsignacionCambio();
      } catch (error) {
        setMensaje({ type: 'error', text: `${error.response?.data?.error || 'Error al asignar'}` });
        setTimeout(() => setMensaje(null), 3000);
      } finally {
        setLoading(false);
      }
    } else if (isCreateMode) {
      const usuario = usuariosDisponibles.find(u => u._id === usuarioId);
      if (usuario && !usuariosActuales.some(a => a._id === usuarioId)) {
        onUsersChange([...usuariosActuales, usuario]);
      }
      setMostrarSelector(false);
      setLoading(false);
    }
  };

  const desasignarUsuario = async (usuarioId, userEmail) => {
    setLoading(true);
    
    if (isEditMode) {
      try {
        await API.delete(`/tickets/${ticketId}/asignar/${usuarioId}`);
        await cargarAsignados();
        await cargarUsuariosDisponibles();
        setMensaje({ type: 'success', text: `Usuario ${userEmail} desasignado` });
        setTimeout(() => setMensaje(null), 3000);
        if (onAsignacionCambio) onAsignacionCambio();
      } catch (error) {
        setMensaje({ type: 'error', text: `${error.response?.data?.error || 'Error al desasignar'}` });
        setTimeout(() => setMensaje(null), 3000);
      } finally {
        setLoading(false);
      }
    } else if (isCreateMode) {
      onUsersChange(usuariosActuales.filter(u => u._id !== usuarioId));
      setLoading(false);
    }
  };

  const getRolIcono = (rol) => {
    switch (rol) {
      case 'admin': return <Crown size={14} />;
      case 'soporte': return <Wrench size={14} />;
      default: return <User size={14} />;
    }
  };

  const getRolColor = (rol) => {
    switch (rol) {
      case 'admin': return 'rol-admin';
      case 'soporte': return 'rol-soporte';
      default: return 'rol-usuario';
    }
  };

  const getRolNombre = (rol) => {
    switch (rol) {
      case 'admin': return 'Administrador';
      case 'soporte': return 'Soporte';
      default: return 'Usuario';
    }
  };

  if (cargando) {
    return (
      <div className="asignar-usuarios loading">
        <Loader2 size={16} className="spin" />
        <span>Cargando asignaciones...</span>
      </div>
    );
  }

  if (isViewMode) {
    return (
      <div className="asignar-usuarios readonly">
        <div className="asignar-header">
          <Users size={16} />
          <span>Usuarios asignados ({usuariosActuales.length})</span>
        </div>
        <div className="asignados-list">
          {usuariosActuales.length === 0 ? (
            <div className="asignados-empty">
              <User size={14} />
              <span>No hay usuarios asignados</span>
            </div>
          ) : (
            usuariosActuales.map(user => (
              <div key={user._id} className="asignado-item readonly">
                <div className="asignado-info">
                  <div className={`asignado-avatar ${getRolColor(user.rol)}`}>
                    {getRolIcono(user.rol)}
                  </div>
                  <div className="asignado-details">
                    <div className="asignado-nombre">{user.nombre || user.email.split('@')[0]}</div>
                    <div className="asignado-email">{user.email}</div>
                  </div>
                  <span className={`asignado-rol ${getRolColor(user.rol)}`}>
                    {getRolNombre(user.rol)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="asignar-usuarios">
      <div className="asignar-header">
        <Users size={16} />
        <span>Equipo asignado ({usuariosActuales.length})</span>
      </div>

      {mensaje && (
        <div className={`asignar-mensaje ${mensaje.type}`}>
          {mensaje.type === 'success' ? <Check size={14} /> : <X size={14} />}
          {mensaje.text}
        </div>
      )}

      <div className="asignados-list">
        {usuariosActuales.length === 0 ? (
          <div className="asignados-empty">
            <User size={14} />
            <span>No hay usuarios asignados</span>
          </div>
        ) : (
          usuariosActuales.map(user => (
            <div key={user._id} className="asignado-item">
              <div className="asignado-info">
                <div className={`asignado-avatar ${getRolColor(user.rol)}`}>
                  {getRolIcono(user.rol)}
                </div>
                <div className="asignado-details">
                  <div className="asignado-nombre">{user.nombre || user.email.split('@')[0]}</div>
                  <div className="asignado-email">{user.email}</div>
                </div>
                <span className={`asignado-rol ${getRolColor(user.rol)}`}>
                  {getRolNombre(user.rol)}
                </span>
              </div>
              <button
                className="btn-desasignar"
                onClick={() => desasignarUsuario(user._id, user.email)}
                disabled={loading}
                title="Desasignar"
              >
                <UserMinus size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {!mostrarSelector ? (
        <button
          className="btn-asignar"
          onClick={() => setMostrarSelector(true)}
          disabled={loading}
        >
          <UserPlus size={14} />
          {isEditMode ? 'Asignar usuario' : 'Agregar usuarios'}
        </button>
      ) : (
        <div className="asignar-selector">
          <div className="selector-header">
            <span><UserPlus size={14} /> Seleccionar usuario</span>
            <button onClick={() => setMostrarSelector(false)} disabled={loading}>
              <X size={14} />
            </button>
          </div>
          <div className="selector-list">
            {usuariosNoAsignados.length === 0 ? (
              <div className="selector-empty">No hay usuarios disponibles</div>
            ) : (
              usuariosNoAsignados.map(user => (
                <div
                  key={user._id}
                  className="selector-item"
                  onClick={() => asignarUsuario(user._id, user.email, user)}
                >
                  <div className={`selector-avatar ${getRolColor(user.rol)}`}>
                    {getRolIcono(user.rol)}
                  </div>
                  <div className="selector-info">
                    <div className="selector-nombre">{user.nombre || user.email.split('@')[0]}</div>
                    <div className="selector-email">{user.email}</div>
                  </div>
                  <span className={`selector-rol ${getRolColor(user.rol)}`}>
                    {getRolNombre(user.rol)}
                  </span>
                  <Plus size={14} className="selector-plus" />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
