import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api';
import './TareaDetail.css';

// Importar iconos profesionales de Lucide React (mismos que el Dashboard)
import {
  Calendar,
  Clock,
  User,
  Mail,
  AlertCircle,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Lock,
  FolderOpen,
  Archive,
  BellOff,
  BellRing,
  Share2,
  Copy,
  ArrowLeft,
  Check,
  Loader2,
  Inbox,
  Package,
  AlertTriangle,
  TrendingUp,
  Flag,
  MessageSquare,
  Image,
  ChevronRight,
  ChevronDown,
  Save,
  Edit,
  Upload,
  X,
  Info,
  Link2,
  ExternalLink,
  CalendarDays,
  CalendarClock,
  Clock3,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Star,
  Heart,
  Bookmark,
  BookOpen,
  FileText,
  FileCheck,
  FileX,
  Folder,
  FolderArchive,
  Send,
  Reply,
  MoreVertical,
  MoreHorizontal,
  Settings,
  HelpCircle,
  LogOut,
  RefreshCw
} from 'lucide-react';

const BRAND_NAME = 'TareaSync';
const LOGO_URL = '/logo.svg';

export default function TareaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tarea, setTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mensajeSilencio, setMensajeSilencio] = useState(null);
  const [silenciando, setSilenciando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mostrarShare, setMostrarShare] = useState(false);

  useEffect(() => {
    cargarTarea();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('silenciado') === 'exito') {
      setMensajeSilencio('✅ Notificaciones silenciadas correctamente por 30 días');
      setTimeout(() => setMensajeSilencio(null), 5000);
    }
  }, [id]);

  const cargarTarea = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Debes iniciar sesión para ver esta tarea.');
        setLoading(false);
        return;
      }
      
      const res = await API.get(`${API}/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTarea(res.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar tarea:', err);
      
      if (err.response?.status === 401) {
        setError('Tu sesión expiró. Por favor, inicia sesión nuevamente.');
      } else if (err.response?.status === 403) {
        setError('No tienes permiso para ver esta tarea.');
      } else if (err.response?.status === 404) {
        setError('La tarea no existe o fue eliminada.');
      } else {
        setError('Error al cargar la tarea. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const silenciarNotificaciones = async () => {
    setSilenciando(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { state: { from: `/tareas/${id}/silenciar` } });
        return;
      }
      
      await API.post(
        `${API}/tickets/${id}/silenciar`,
        { dias: 30 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMensajeSilencio('✅ Notificaciones silenciadas por 30 días');
      setTimeout(() => setMensajeSilencio(null), 5000);
      
      cargarTarea();
    } catch (err) {
      console.error('Error al silenciar:', err);
      setMensajeSilencio('❌ Error al silenciar notificaciones');
      setTimeout(() => setMensajeSilencio(null), 5000);
    } finally {
      setSilenciando(false);
    }
  };

  const copiarEnlace = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartir = () => {
    if (navigator.share) {
      navigator.share({
        title: `Tarea #${tarea?.numero_ticket} - ${BRAND_NAME}`,
        text: tarea?.asunto,
        url: window.location.href,
      });
    } else {
      setMostrarShare(true);
      setTimeout(() => setMostrarShare(false), 3000);
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoIcono = (estado) => {
    const iconos = {
      abierto: FolderOpen,
      pendiente: PauseCircle,
      en_proceso: PlayCircle,
      resuelto: CheckCircle,
      cerrado: Lock,
      reabierto: RotateCcw,
      cancelado: XCircle,
      archivado: Archive
    };
    const Icono = iconos[estado] || FolderOpen;
    return <Icono size={16} />;
  };

  const getEstadoColor = (estado) => {
    const colores = {
      abierto: '#22c55e',
      pendiente: '#e11d48',
      en_proceso: '#f59e0b',
      resuelto: '#10b981',
      cerrado: '#64748b',
      reabierto: '#fb923c',
      cancelado: '#ef4444',
      archivado: '#6b7280'
    };
    return colores[estado] || '#64748b';
  };

  const getPrioridadIcono = (prioridad) => {
    const iconos = {
      baja: Flag,
      media: TrendingUp,
      alta: AlertTriangle,
      urgente: AlertCircle
    };
    const Icono = iconos[prioridad] || Flag;
    return <Icono size={14} />;
  };

  const getPrioridadClase = (prioridad) => {
    const clases = {
      baja: 'priority-low',
      media: 'priority-medium',
      alta: 'priority-high',
      urgente: 'priority-urgent'
    };
    return clases[prioridad] || 'priority-medium';
  };

  if (loading) {
    return (
      <div className="tarea-detail-container">
        <div className="loading-card">
          <Loader2 size={48} className="spin" />
          <p>Cargando tarea...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tarea-detail-container">
        <div className="error-card">
          <div className="brand-header">
            <img src={LOGO_URL} alt={BRAND_NAME} className="brand-logo-error" />
            <h3>{BRAND_NAME}</h3>
          </div>
          <AlertCircle size={48} className="error-icon" />
          <h2>{error.includes('sesión') ? 'Sesión requerida' : 'Error'}</h2>
          <p>{error}</p>
          <div className="error-actions">
            <Link to="/login" className="btn-primary">
              <LogOut size={16} /> Iniciar sesión
            </Link>
            <Link to="/" className="btn-secondary">
              <ArrowLeft size={16} /> Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!tarea) {
    return (
      <div className="tarea-detail-container">
        <div className="error-card">
          <div className="brand-header">
            <img src={LOGO_URL} alt={BRAND_NAME} className="brand-logo-error" />
            <h3>{BRAND_NAME}</h3>
          </div>
          <Inbox size={48} className="error-icon" />
          <h2>Tarea no encontrada</h2>
          <p>La tarea que buscas no existe o fue eliminada.</p>
          <Link to="/tickets" className="btn-primary">
            <FileText size={16} /> Ver mis tareas
          </Link>
        </div>
      </div>
    );
  }

  const esVencida = tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date();
  const estaSilenciada = tarea.silenciar_notificaciones_hasta && new Date(tarea.silenciar_notificaciones_hasta) > new Date();
  const EstadoIcon = getEstadoIcono(tarea.estado);
  const PrioridadIcon = getPrioridadIcono(tarea.prioridad);

  return (
    <div className="tarea-detail-container">
      <div className="tarea-detail-card">
        {/* Header con logo y branding */}
        <div className="tarea-header">
          <div className="brand-header">
            <img src={LOGO_URL} alt={BRAND_NAME} className="brand-logo" />
            <div className="brand-info">
              <h2>{BRAND_NAME}</h2>
              <p>Sistema de Gestión de Tareas</p>
            </div>
          </div>
          <div className="tarea-title-section">
            <div className="tarea-id">
              <span className="id-label">Tarea</span>
              <span className="id-number">#{tarea.numero_ticket}</span>
            </div>
            <div className="tarea-badges">
              <span className={`badge estado ${tarea.estado}`} style={{ color: getEstadoColor(tarea.estado) }}>
                {EstadoIcon} {tarea.estado}
              </span>
              <span className={`badge prioridad ${getPrioridadClase(tarea.prioridad)}`}>
                {PrioridadIcon} {tarea.prioridad}
              </span>
              {esVencida && (
                <span className="badge vencida">
                  <AlertCircle size={12} /> VENCIDA
                </span>
              )}
              {estaSilenciada && (
                <span className="badge silenciada">
                  <BellOff size={12} /> Silenciada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo de la tarea */}
        <div className="tarea-body">
          <div className="tarea-info">
            <div className="info-card">
              <div className="info-card-header">
                <FileText size={16} /> Información de la tarea
              </div>
              <div className="info-card-body">
                <div className="info-row">
                  <div className="info-label">Asunto</div>
                  <div className="info-value">{tarea.asunto}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Descripción</div>
                  <div className="info-value description">{tarea.descripcion || 'Sin descripción'}</div>
                </div>
              </div>
            </div>

            <div className="info-card">
              <div className="info-card-header">
                <CalendarDays size={16} /> Fechas y seguimiento
              </div>
              <div className="info-card-body grid-2">
                <div className="info-row">
                  <div className="info-label">
                    <User size={12} /> Usuario
                  </div>
                  <div className="info-value">{tarea.usuario_id?.email || '—'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">
                    <Calendar size={12} /> Creado
                  </div>
                  <div className="info-value">{formatearFecha(tarea.fecha_creacion)}</div>
                </div>
                {tarea.fecha_vencimiento && (
                  <div className="info-row">
                    <div className="info-label">
                      <CalendarClock size={12} /> Vencimiento
                    </div>
                    <div className={`info-value ${esVencida ? 'vencido' : ''}`}>
                      {formatearFecha(tarea.fecha_vencimiento)}
                      {esVencida && <span className="vencido-badge">VENCIDA</span>}
                    </div>
                  </div>
                )}
                {tarea.fecha_cierre && (
                  <div className="info-row">
                    <div className="info-label">
                      <CheckCircle size={12} /> Cerrado
                    </div>
                    <div className="info-value">{formatearFecha(tarea.fecha_cierre)}</div>
                  </div>
                )}
                {tarea.es_recurrente && tarea.recurrencia && (
                  <div className="info-row">
                    <div className="info-label">
                      <RefreshCw size={12} /> Recurrencia
                    </div>
                    <div className="info-value">
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 20, fontSize: 11,
                        fontWeight: 500, background: '#dbeafe', color: '#1d4ed8'
                      }}>
                        <RefreshCw size={10} />
                        {tarea.recurrencia.activa ? 'Activa' : 'Inactiva'}
                        {' — '}Cada {tarea.recurrencia.intervalo} {tarea.recurrencia.tipo}
                        {tarea.recurrencia.solo_dias_habiles && ' (días hábiles)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Historial de comentarios */}
            {tarea.historial && tarea.historial.length > 0 && (
              <div className="info-card">
                <div className="info-card-header">
                  <MessageSquare size={16} /> Historial de actividad ({tarea.historial.length})
                </div>
                <div className="info-card-body historial">
                  {tarea.historial.slice().reverse().map((h, idx) => (
                    <div key={idx} className="historial-item">
                      <div className="historial-header">
                        <Clock3 size={12} />
                        <span className="historial-fecha">{new Date(h.fecha).toLocaleString()}</span>
                        <span className="historial-autor">— {h.autor || 'sistema'}</span>
                      </div>
                      <div className="historial-estado">
                        <strong>Estado:</strong> {h.estado}
                      </div>
                      <div className="historial-comentario">{h.comentario}</div>
                      {h.imagen && (
                        <div className="historial-imagen">
                          <a href={h.imagen} target="_blank" rel="noreferrer">
                            <Image size={14} /> Ver imagen adjunta
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="tarea-actions-section">
            <div className="actions-header">
              <Settings size={16} /> Acciones
            </div>
            <div className="actions-buttons">
              <Link to="/tickets" className="action-btn secondary">
                <ArrowLeft size={16} />
                Volver a mis tareas
              </Link>
              
              <button onClick={copiarEnlace} className="action-btn outline" title="Copiar enlace">
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? 'Enlace copiado' : 'Copiar enlace'}
              </button>
              
              <button onClick={compartir} className="action-btn outline" title="Compartir">
                <Share2 size={16} />
                Compartir
              </button>
              
              {!estaSilenciada && tarea.estado !== 'cerrado' && tarea.estado !== 'resuelto' && tarea.estado !== 'archivado' && (
                <button 
                  onClick={silenciarNotificaciones} 
                  className="action-btn danger"
                  disabled={silenciando}
                >
                  {silenciando ? <Loader2 size={16} className="spin" /> : <BellOff size={16} />}
                  {silenciando ? 'Procesando...' : 'Silenciar notificaciones (30 días)'}
                </button>
              )}

              {estaSilenciada && (
                <div className="silenciada-info">
                  <BellOff size={16} />
                  Notificaciones silenciadas hasta {new Date(tarea.silenciar_notificaciones_hasta).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Mensajes */}
          {mensajeSilencio && (
            <div className={`toast-message ${mensajeSilencio.includes('✅') ? 'success' : 'error'}`}>
              {mensajeSilencio.includes('✅') ? <CheckCircle size={18} /> : <XCircle size={18} />}
              {mensajeSilencio}
            </div>
          )}
          
          {mostrarShare && (
            <div className="toast-message info">
              <Info size={18} />
              Comparte el enlace manualmente: {window.location.href}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tarea-footer">
          <p>
            {BRAND_NAME} - Sistema de Gestión de Tareas
            <br />
            <small>Este es un mensaje automático. Por favor no responder a este correo.</small>
          </p>
        </div>
      </div>
    </div>
  );
}