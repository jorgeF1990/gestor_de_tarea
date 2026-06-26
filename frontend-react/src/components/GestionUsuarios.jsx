import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { AuthContext } from '../context/AuthContext';
import { 
  Users, 
  Crown, 
  Wrench, 
  User, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Mail,
  Bell,
  BellOff,
  AlertCircle,
  Check,
  Loader2,
  Edit,
  Save,
  Power,
  PowerOff
} from 'lucide-react';
import './GestionUsuarios.css';

const ROLES = [
  { value: 'admin', label: 'Administrador', icon: Crown, color: 'rol-admin' },
  { value: 'soporte', label: 'Soporte Técnico', icon: Wrench, color: 'rol-soporte' },
  { value: 'usuario', label: 'Usuario', icon: User, color: 'rol-usuario' }
];

export default function GestionUsuarios() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    if (!user || user.rol !== 'admin') {
      navigate('/');
      return;
    }
    cargarUsuarios();
  }, [user]);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await API.get('/admin/usuarios', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuarios(res.data || []);
      setMensaje(null);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setMensaje({ 
        type: 'error', 
        text: error.response?.data?.error || 'Error al cargar usuarios' 
      });
      if (error.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const actualizarUsuario = async (usuarioId, datos) => {
    setSaving(prev => ({ ...prev, [usuarioId]: true }));
    try {
      const token = localStorage.getItem('token');
      await API.put(
        `/admin/usuarios/${usuarioId}`,
        datos,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await cargarUsuarios();
      setEditando(null);
      setMensaje({ type: 'success', text: 'Usuario actualizado correctamente' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (error) {
      setMensaje({ 
        type: 'error', 
        text: error.response?.data?.error || 'Error al actualizar usuario' 
      });
      setTimeout(() => setMensaje(null), 3000);
    } finally {
      setSaving(prev => ({ ...prev, [usuarioId]: false }));
    }
  };

  const toggleActivo = (usuario) => {
    if (usuario._id === user?.id && usuario.activo) {
      setMensaje({ type: 'error', text: 'No puedes desactivar tu propia cuenta' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }
    actualizarUsuario(usuario._id, { activo: !usuario.activo });
  };

  const cambiarRol = (usuarioId, nuevoRol) => {
    actualizarUsuario(usuarioId, { rol: nuevoRol });
  };

  const getRolInfo = (rol) => {
    return ROLES.find(r => r.value === rol) || ROLES[2];
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
            {usuarios.map(usuario => {
              const rolInfo = getRolInfo(usuario.rol);
              const RolIcon = rolInfo.icon;
              const esUsuarioActual = usuario._id === user?.id;

              return (
                <tr key={usuario._id} className={!usuario.activo ? 'usuario-inactivo' : ''}>
                  <td>
                    <div className="usuario-info">
                      <div className={`usuario-avatar ${rolInfo.color}`}>
                        <RolIcon size={18} />
                      </div>
                      <span className="usuario-nombre">
                        {usuario.nombre || usuario.email.split('@')[0]}
                        {esUsuarioActual && <span className="usuario-actual"> (tú)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="usuario-email">
                    <Mail size={14} className="email-icon" />
                    {usuario.email}
                  </td>
                  <td>
                    {editando === usuario._id ? (
                      <select
                        value={usuario.rol}
                        onChange={(e) => cambiarRol(usuario._id, e.target.value)}
                        disabled={saving[usuario._id] || esUsuarioActual}
                        className="rol-select"
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`rol-badge ${rolInfo.color}`}>
                        <RolIcon size={14} />
                        {rolInfo.label}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`btn-estado ${usuario.activo ? 'activo' : 'inactivo'}`}
                      onClick={() => toggleActivo(usuario)}
                      disabled={saving[usuario._id] || esUsuarioActual}
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
              );
            })}
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