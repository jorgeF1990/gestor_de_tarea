import React, { useState, useEffect } from 'react';
import API from '../api';
import { 
  Users, 
  Crown, 
  Wrench, 
  User, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  Mail,
  Bell,
  BellOff,
  AlertCircle,
  Check,
  X,
  Loader2,
  Edit,
  Save,
  Power,
  PowerOff
} from 'lucide-react';
import './GestionUsuarios.css';


export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [editando, setEditando] = useState(null);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await API.get(`${API}/admin/usuarios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuarios(res.data);
      setMensaje(null);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setMensaje({ type: 'error', text: error.response?.data?.error || 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const actualizarUsuario = async (usuarioId, datos) => {
    setSaving(prev => ({ ...prev, [usuarioId]: true }));
    try {
      const token = localStorage.getItem('token');
      await API.put(
        `${API}/admin/usuarios/${usuarioId}`,
        datos,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await cargarUsuarios();
      setEditando(null);
      setMensaje({ type: 'success', text: 'Usuario actualizado correctamente' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (error) {
      setMensaje({ type: 'error', text: error.response?.data?.error || 'Error al actualizar usuario' });
      setTimeout(() => setMensaje(null), 3000);
    } finally {
      setSaving(prev => ({ ...prev, [usuarioId]: false }));
    }
  };

  const toggleActivo = (usuario) => {
    actualizarUsuario(usuario._id, { activo: !usuario.activo });
  };

  const cambiarRol = (usuarioId, nuevoRol) => {
    actualizarUsuario(usuarioId, { rol: nuevoRol });
  };

  const getRolIcono = (rol) => {
    switch (rol) {
      case 'admin': return <Crown size={18} />;
      case 'soporte': return <Wrench size={18} />;
      default: return <User size={18} />;
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
      case 'soporte': return 'Soporte Técnico';
      default: return 'Usuario';
    }
  };

  const getEstadoIcono = (activo) => {
    return activo ? <CheckCircle size={16} className="estado-activo" /> : <XCircle size={16} className="estado-inactivo" />;
  };

  if (loading) {
    return (
      <div className="gestion-usuarios loading">
        <Loader2 size={32} className="spin" />
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="gestion-usuarios">
      <div className="gestion-header">
        <Users size={24} />
        <h2>Gestión de Usuarios</h2>
        <button className="btn-refresh" onClick={cargarUsuarios} title="Refrescar">
          <RefreshCw size={18} />
        </button>
      </div>

      {mensaje && (
        <div className={`gestion-mensaje ${mensaje.type}`}>
          {mensaje.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {mensaje.text}
        </div>
      )}

      <div className="usuarios-table-container">
        <table className="usuarios-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Notificaciones</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(usuario => (
              <tr key={usuario._id} className={!usuario.activo ? 'usuario-inactivo' : ''}>
                <td>
                  <div className="usuario-info">
                    <div className={`usuario-avatar ${getRolColor(usuario.rol)}`}>
                      {getRolIcono(usuario.rol)}
                    </div>
                    <span className="usuario-nombre">{usuario.nombre || usuario.email.split('@')[0]}</span>
                  </div>
                </td>
                <td className="usuario-email">{usuario.email}</td>
                <td>
                  {editando === usuario._id ? (
                    <select
                      value={usuario.rol}
                      onChange={(e) => cambiarRol(usuario._id, e.target.value)}
                      disabled={saving[usuario._id]}
                      className="rol-select"
                    >
                      <option value="admin">Administrador</option>
                      <option value="soporte">Soporte</option>
                      <option value="usuario">Usuario</option>
                    </select>
                  ) : (
                    <span className={`rol-badge ${getRolColor(usuario.rol)}`}>
                      {getRolIcono(usuario.rol)}
                      {getRolNombre(usuario.rol)}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className={`btn-estado ${usuario.activo ? 'activo' : 'inactivo'}`}
                    onClick={() => toggleActivo(usuario)}
                    disabled={saving[usuario._id]}
                    title={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
                  >
                    {usuario.activo ? <Power size={14} /> : <PowerOff size={14} />}
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td>
                  <div className="notificaciones-info">
                    {usuario.notificaciones?.recordatorios_vencimiento !== false ? (
                      <Bell size={14} className="notif-on" />
                    ) : (
                      <BellOff size={14} className="notif-off" />
                    )}
                    <span className="notif-text">
                      {usuario.notificaciones?.recordatorios_vencimiento !== false ? 'Activadas' : 'Silenciadas'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="acciones-usuario">
                    {editando === usuario._id ? (
                      <button
                        className="btn-save"
                        onClick={() => setEditando(null)}
                        disabled={saving[usuario._id]}
                      >
                        <Save size={16} /> Guardar
                      </button>
                    ) : (
                      <button
                        className="btn-edit"
                        onClick={() => setEditando(usuario._id)}
                        disabled={saving[usuario._id]}
                      >
                        <Edit size={16} /> Editar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {usuarios.length === 0 && (
        <div className="usuarios-empty">
          <Users size={48} />
          <p>No hay usuarios registrados</p>
        </div>
      )}
    </div>
  );
}