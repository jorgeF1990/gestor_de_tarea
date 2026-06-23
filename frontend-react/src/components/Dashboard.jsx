import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import AsignarUsuarios from './AsignarUsuarios';
import GestionUsuarios from './GestionUsuarios';
import CalendarView from './CalendarView';
import RecurrenciaConfig from '../components/RecurrenciaConfig';

// Importar iconos profesionales de Lucide React
import {
  LayoutList, KanbanSquare, Archive, ArchiveRestore, RefreshCw, Bell,
  Clock, AlertCircle, Calendar, Flag, User, Users, MessageSquare, Image,
  ChevronDown, ChevronRight, CheckCircle, XCircle, PlayCircle, PauseCircle,
  RotateCcw, Lock, FolderOpen, Save, Upload, Edit, Search, Sun, Moon,
  Loader2, Inbox, Package, Layers, AlertTriangle, TrendingUp, X, Check, Info, CalendarDays
} from 'lucide-react';

const SEEN_KEY_ADMIN = 'dashboard_last_seen:v1';
const OPEN_KEY_ADMIN = 'dashboard_open_cards:v1';
const THEME_KEY = 'dashboard-theme';
const VIEW_MODE_KEY = 'dashboard_view_mode:v1';
const API = import.meta.env.VITE_BACKEND_URL || '';

// Helpers ============================================================
const getActivityTs = (t) => {
  const times = [
    t.fecha_creacion || t.createdAt ? new Date(t.fecha_creacion || t.createdAt).getTime() : 0,
    t.fecha_actualizacion || t.updatedAt ? new Date(t.fecha_actualizacion || t.updatedAt).getTime() : 0,
    t.historial?.length ? new Date(t.historial[t.historial.length - 1]?.fecha).getTime() : 0
  ].filter(Boolean);
  return times.length ? Math.max(...times) : 0;
};

const timeAgo = (dateLike) => {
  if (!dateLike) return '—';
  const diff = Date.now() - new Date(dateLike).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
};

const formatearFecha = (fecha, conHora = true) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-AR', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(conHora && { hour: '2-digit', minute: '2-digit' })
  });
};

const formatearFechaInput = (fecha) => {
  if (!fecha) return '';
  return new Date(fecha).toISOString().split('T')[0];
};

const formatearHoraInput = (fecha) => {
  if (!fecha) return '23:59';
  const d = new Date(fecha);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// Columnas Kanban
const KANBAN_COLUMNS = [
  { id: 'pendiente', title: 'Pendientes', icon: PauseCircle, iconColor: '#e11d48', color: '#e11d48' },
  { id: 'abierto', title: 'Abiertos', icon: FolderOpen, iconColor: '#22c55e', color: '#22c55e' },
  { id: 'en_proceso', title: 'En Proceso', icon: PlayCircle, iconColor: '#f59e0b', color: '#f59e0b' },
  { id: 'reabierto', title: 'Reabiertos', icon: RotateCcw, iconColor: '#fb923c', color: '#fb923c' },
  { id: 'resuelto', title: 'Resueltos', icon: CheckCircle, iconColor: '#10b981', color: '#10b981' },
  { id: 'cerrado', title: 'Cerrados', icon: Lock, iconColor: '#64748b', color: '#64748b' },
  { id: 'cancelado', title: 'Cancelados', icon: XCircle, iconColor: '#ef4444', color: '#ef4444' }
];

const colorEstado = {
  abierto: '#22c55e', pendiente: '#e11d48', en_proceso: '#f59e0b',
  resuelto: '#10b981', cerrado: '#64748b', reabierto: '#fb923c',
  cancelado: '#ef4444', archivada: '#6b7280'
};

function Dashboard() {
  // Estados ============================================================
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensajes, setMensajes] = useState({});
  const [abiertos, setAbiertos] = useState({});
  const [flashIds, setFlashIds] = useState({});
  const [cambios, setCambios] = useState({});
  const [saving, setSaving] = useState({});
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_KEY) || 'lista');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem('dashboard-page-size') || 10);
    return [5, 10, 15, 20, 30, 50].includes(saved) ? saved : 10;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState('');
  const [newsCount, setNewsCount] = useState(0);
  const [changesMap, setChangesMap] = useState({});
  const [updates, setUpdates] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const showToast = useCallback((msg, type = 'info', ttl = 3200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, msg, type }]);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.28;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    } catch { }
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl);
  }, []);

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'dark' ? 'light' : 'dark'), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('dashboard-page-size', pageSize);
    setPage(1);
  }, [pageSize]);

  // Autenticación y carga inicial =======================================================
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const payload = jwtDecode(token);
      if (payload.rol !== 'admin') { navigate('/'); return; }
      setUsuarioActual(payload.email || '');
    } catch { navigate('/login'); return; }
    try {
      const raw = localStorage.getItem(OPEN_KEY_ADMIN);
      if (raw) setAbiertos(JSON.parse(raw) || {});
    } catch { }
    cargarTickets();
  }, [navigate]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => cargarTickets({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY_ADMIN, JSON.stringify(abiertos)); } catch { }
  }, [abiertos]);

  // CRUD Tickets =======================================================
  const cargarTickets = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (estadoFiltro) params.append('estado', estadoFiltro);
    if (prioridadFiltro) params.append('prioridad', prioridadFiltro);
    try {
      const res = await axios.get(`${API}/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ordenados = (res.data || []).slice().sort((a, b) => getActivityTs(b) - getActivityTs(a));
      setTickets(ordenados);
      setAbiertos(prev => {
        const next = {};
        const ids = new Set(ordenados.map(t => t._id));
        Object.entries(prev).forEach(([id, v]) => { if (ids.has(id)) next[id] = v; });
        return next;
      });
      calcularNovedades(ordenados);
    } catch (err) {
      console.error(err);
      setTickets([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const actualizarTicket = async (id, datos) => {
    const token = localStorage.getItem('token');
    let cambio = cambios[id] || {};
    if (datos) cambio = { ...cambio, ...datos };

    const { 
      nuevoEstado, 
      nuevaPrioridad, 
      nuevaFecha, 
      nuevaHora, 
      recurrenciaConfig 
    } = cambio;
    
    const ticketActual = tickets.find(t => t._id === id);
    let fechaCompleta = null;

    if (nuevaFecha || nuevaHora) {
      let fechaBase = ticketActual?.fecha_vencimiento ? new Date(ticketActual.fecha_vencimiento) : new Date();
      let fechaBaseStr = formatearFechaInput(fechaBase);
      const fechaFinal = nuevaFecha || fechaBaseStr;
      let horaFinal = nuevaHora;
      if (!horaFinal && ticketActual?.fecha_vencimiento) {
        horaFinal = formatearHoraInput(ticketActual.fecha_vencimiento);
      } else if (!horaFinal) {
        horaFinal = '23:59';
      }
      fechaCompleta = new Date(`${fechaFinal}T${horaFinal}:00`);
    }

    const hayRecurrencia = recurrenciaConfig?.es_recurrente !== undefined;
    const hayEstado = !!nuevoEstado || !!nuevaPrioridad || !!fechaCompleta;
    
    if (!hayEstado && !hayRecurrencia) return { ok: false };

    const payload = {};
    if (nuevoEstado) payload.estado = nuevoEstado;
    if (nuevaPrioridad) payload.prioridad = nuevaPrioridad;
    if (fechaCompleta) payload.fecha_vencimiento = fechaCompleta;

    // ========== AGREGAR DATOS DE RECURRENCIA AL PAYLOAD ==========
    if (recurrenciaConfig) {
      payload.es_recurrente = recurrenciaConfig.es_recurrente;
      
      if (recurrenciaConfig.es_recurrente && recurrenciaConfig.recurrencia) {
        const rec = recurrenciaConfig.recurrencia;
        payload.recurrencia_tipo = rec.tipo;
        payload.recurrencia_intervalo = rec.intervalo || 1;
        payload.solo_dias_habiles = rec.solo_dias_habiles !== false;
        
        if (rec.tipo === 'semanal' && rec.dias_semana) {
          payload.dias_semana = JSON.stringify(rec.dias_semana);
        }
        
        if (rec.tipo === 'mensual' && rec.dia_mes) {
          payload.dia_mes = rec.dia_mes;
        }
        
        if (rec.fecha_fin) {
          payload.fecha_fin_recurrencia = rec.fecha_fin;
        }
      }
    }

    try {
      const res = await axios.put(`${API}/tickets/${id}/estado`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      // Actualizar estado local
      setTickets(prev => prev.map(t => {
        if (t._id === id) {
          const updated = { ...t, ...payload, fecha_actualizacion: new Date().toISOString() };
          if (fechaCompleta) updated.fecha_vencimiento = fechaCompleta;
          
          // Actualizar recurrencia en el objeto local
          if (recurrenciaConfig) {
            updated.es_recurrente = recurrenciaConfig.es_recurrente;
            if (recurrenciaConfig.recurrencia) {
              updated.recurrencia = {
                ...t.recurrencia,
                ...recurrenciaConfig.recurrencia,
                activa: recurrenciaConfig.es_recurrente
              };
            } else {
              updated.recurrencia = { ...t.recurrencia, activa: false };
            }
          }
          
          return updated;
        }
        return t;
      }));

      // Limpiar cambios del formulario
      setCambios(prev => {
        const n = { ...prev };
        if (n[id]) {
          delete n[id].nuevoEstado;
          delete n[id].nuevaPrioridad;
          delete n[id].nuevaFecha;
          delete n[id].nuevaHora;
          delete n[id].recurrenciaConfig;
        }
        return n;
      });

      showToast('Ticket actualizado correctamente', 'success');
      await cargarTickets({ silent: true });
      return { ok: true };
    } catch (err) {
      console.error('Error al actualizar ticket:', err);
      showToast('Error al actualizar: ' + (err.response?.data?.mensaje || err.message), 'error');
      return { ok: false };
    }
  };

  const agregarComentario = async (id) => {
    const token = localStorage.getItem('token');
    const cambio = cambios[id] || {};
    const { nuevoComentario, nuevoArchivo } = cambio;
    if (!nuevoComentario && !nuevoArchivo) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ Comentario vacío' }));
      return { ok: false };
    }
    const formData = new FormData();
    if (nuevoComentario) formData.append('comentario', nuevoComentario);
    if (nuevoArchivo) formData.append('imagen', nuevoArchivo);
    try {
      await axios.put(`${API}/tickets/${id}/comentario`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCambios(prev => {
        const n = { ...prev };
        if (n[id]) {
          delete n[id].nuevoComentario;
          delete n[id].nuevoArchivo;
        }
        return n;
      });
      setMensajes(prev => ({ ...prev, [id]: '✅ Comentario guardado' }));
      showToast('Comentario agregado', 'success');
      await cargarTickets({ silent: true });
      return { ok: true };
    } catch (err) {
      setMensajes(prev => ({ ...prev, [id]: '❌ Error' }));
      showToast('Error al comentar', 'error');
      return { ok: false };
    }
  };

  const onCambio = (id, campo, valor) => {
    setCambios(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const onCambioRecurrencia = (id, recurrenciaConfig) => {
    setCambios(prev => ({ 
      ...prev, 
      [id]: { 
        ...prev[id], 
        recurrenciaConfig,
        // Si activa recurrencia, asegurar que tenga tipo
        recurrencia_tipo: recurrenciaConfig.es_recurrente ? 
          (recurrenciaConfig.recurrencia?.tipo || 'diaria') : undefined
      } 
    }));
  };

  const guardarCambios = async (id) => {
    if (saving[id]) return;
    const cambio = cambios[id] || {};
    const hayEstado = !!cambio.nuevoEstado || !!cambio.nuevaPrioridad || !!cambio.nuevaFecha || !!cambio.nuevaHora;
    const hayComentario = !!cambio.nuevoComentario || !!cambio.nuevoArchivo;
    const hayRecurrencia = cambio.recurrenciaConfig !== undefined;
    
    if (!hayEstado && !hayComentario && !hayRecurrencia) {
      setMensajes(prev => ({ ...prev, [id]: '⚠️ No hay cambios para guardar' }));
      return;
    }
    
    setSaving(prev => ({ ...prev, [id]: true }));
    setMensajes(prev => ({ ...prev, [id]: '' }));
    
    // Primero guardar estado/recurrencia
    if (hayEstado || hayRecurrencia) {
      await actualizarTicket(id);
    }
    
    // Luego guardar comentario
    if (hayComentario) {
      await agregarComentario(id);
    }
    
    setSaving(prev => ({ ...prev, [id]: false }));
  };

  const archivarTicket = async (id, archivar = true) => {
    const nuevoEstado = archivar ? 'archivada' : 'pendiente';
    const result = await actualizarTicket(id, { nuevoEstado });
    if (result.ok) {
      showToast(archivar ? 'Tarea archivada' : 'Tarea restaurada', 'success');
      setOpenAndFocus(id, false);
    }
  };

  // Drag & Drop =======================================================
  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticket._id);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = async (e, nuevoEstado) => {
    e.preventDefault();
    if (!draggedTicket || draggedTicket.estado === nuevoEstado) return;
    const result = await actualizarTicket(draggedTicket._id, { nuevoEstado });
    if (result.ok) showToast(`Movido a ${nuevoEstado}`, 'success');
    setDraggedTicket(null);
  };

  // UI Helpers =======================================================
  const setOpenAndFocus = (id, open = true) => {
    setAbiertos(prev => ({ ...prev, [id]: open }));
    if (open) {
      setTimeout(() => {
        const el = document.getElementById(`ticket-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setFlashIds(prev => ({ ...prev, [id]: true }));
          setTimeout(() => setFlashIds(prev => {
            const n = { ...prev };
            delete n[id];
            return n;
          }), 1300);
        }
      }, 100);
    }
  };

  const toggleTicket = (id) => setOpenAndFocus(id, !abiertos[id]);
  const isVencida = (ticket) => {
    if (!ticket?.fecha_vencimiento) return false;
    if (['cerrado', 'resuelto', 'archivada'].includes(ticket.estado)) return false;
    return new Date(ticket.fecha_vencimiento) < new Date();
  };

  // Novedades =======================================================
  const getSeen = () => {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY_ADMIN) || '{}'); } catch { return {}; }
  };
  const setSeen = (snap) => {
    try { localStorage.setItem(SEEN_KEY_ADMIN, JSON.stringify(snap)); } catch { }
  };

  const buildSnap = (list) => {
    const snap = {};
    for (const t of list) {
      const last = t.historial?.[t.historial.length - 1];
      snap[t._id] = {
        estado: t.estado || '',
        prioridad: t.prioridad || '',
        lastISO: last?.fecha ? new Date(last.fecha).toISOString() : null,
        lastAutor: last?.autor || null
      };
    }
    return snap;
  };

  const calcularNovedades = (list) => {
    const seen = getSeen();
    const curr = buildSnap(list);
    const cambios = [];
    for (const t of list) {
      const prev = seen[t._id];
      const now = curr[t._id];
      const lastAutor = now.lastAutor;
      if (!prev) {
        const ch = [];
        if (now.lastISO && lastAutor && lastAutor !== usuarioActual) ch.push('comentario');
        if (lastAutor && lastAutor !== usuarioActual) {
          if (now.estado) ch.push('estado');
          if (now.prioridad) ch.push('prioridad');
        }
        if (t.estado === 'pendiente' && (t.historial?.length || 0) === 1 && lastAutor && lastAutor !== usuarioActual) {
          ch.push('nuevo');
        }
        if (ch.length) cambios.push({ id: t._id, numero: t.numero_ticket, asunto: t.asunto, changes: ch });
        continue;
      }
      const ch = [];
      if ((prev.lastISO || '') !== (now.lastISO || '') && lastAutor && lastAutor !== usuarioActual) ch.push('comentario');
      if (prev.estado !== now.estado && lastAutor && lastAutor !== usuarioActual) ch.push('estado');
      if (prev.prioridad !== now.prioridad && lastAutor && lastAutor !== usuarioActual) ch.push('prioridad');
      if (ch.length) cambios.push({ id: t._id, numero: t.numero_ticket, asunto: t.asunto, changes: ch });
    }
    setUpdates(cambios);
    setNewsCount(cambios.length);
  };

  const marcarTodoVisto = () => {
    const snap = buildSnap(tickets);
    setSeen(snap);
    setUpdates([]);
    setNewsCount(0);
    setPanelOpen(false);
    showToast('Novedades marcadas', 'info');
  };

  const marcarUnoVisto = (id) => {
    const seen = getSeen();
    const curr = buildSnap(tickets);
    if (!curr[id]) return;
    const next = { ...seen, [id]: curr[id] };
    setSeen(next);
    setUpdates(prev => prev.filter(u => u.id !== id));
    setNewsCount(prev => Math.max(0, prev - 1));
  };

  // Filtrado =======================================================
  const filteredTickets = useMemo(() => {
    let base = tickets;
    if (viewMode === 'archivadas') base = tickets.filter(t => t.estado === 'archivada');
    else base = tickets.filter(t => t.estado !== 'archivada');

    const texto = busquedaTexto.trim().toLowerCase();
    let result = [...base];

    if (texto) {
      result = result.filter(t =>
        (t.numero_ticket || '').toString().toLowerCase().includes(texto) ||
        (t.asunto || '').toLowerCase().includes(texto) ||
        (t.descripcion || '').toLowerCase().includes(texto) ||
        (t.usuario_id?.email || '').toLowerCase().includes(texto)
      );
    }

    if (fechaDesde) {
      const desde = new Date(fechaDesde);
      desde.setHours(0, 0, 0, 0);
      result = result.filter(t => t.fecha_vencimiento && new Date(t.fecha_vencimiento) >= desde);
    }

    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      result = result.filter(t => t.fecha_vencimiento && new Date(t.fecha_vencimiento) <= hasta);
    }

    return result;
  }, [tickets, busquedaTexto, fechaDesde, fechaHasta, viewMode]);

  const kanbanData = useMemo(() => {
    const grouped = {};
    KANBAN_COLUMNS.forEach(col => { grouped[col.id] = []; });
    filteredTickets.forEach(t => {
      const estado = t.estado?.toLowerCase();
      if (grouped[estado]) grouped[estado].push(t);
    });
    return grouped;
  }, [filteredTickets]);

  const pages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pageData = filteredTickets.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(pages); }, [pages, page]);

  const conteos = useMemo(() => {
    const inicial = { abierto: 0, pendiente: 0, en_proceso: 0, resuelto: 0, cerrado: 0, reabierto: 0, cancelado: 0, archivada: 0, total: 0 };
    return tickets.reduce((acc, t) => {
      const est = String(t.estado || '').toLowerCase();
      if (acc.hasOwnProperty(est)) acc[est]++;
      acc.total++;
      return acc;
    }, inicial);
  }, [tickets]);

  const limpiarFiltros = () => {
    setBusquedaTexto('');
    setEstadoFiltro('');
    setPrioridadFiltro('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
    showToast('Filtros limpiados', 'info');
  };

  // Render Kanban Card =======================================================
  const renderKanbanCard = (ticket) => {
    const vencida = isVencida(ticket);
    const tieneNovedad = changesMap[ticket._id] && Object.values(changesMap[ticket._id]).some(v => v);
    const PrioridadIcon = ticket.prioridad === 'alta' ? AlertTriangle : ticket.prioridad === 'media' ? TrendingUp : Flag;
    return (
      <div key={ticket._id} id={`ticket-${ticket._id}`}
        className={`kanban-card ${vencida ? 'card-vencido' : ''} ${tieneNovedad ? 'card-novedad' : ''}`}
        draggable onDragStart={(e) => handleDragStart(e, ticket)}
        onClick={() => setOpenAndFocus(ticket._id, true)}>
        <div className="kanban-card-header">
          <span className="kanban-card-num">#{ticket.numero_ticket}</span>
          <div className={`priority-badge priority-${ticket.prioridad}`}>
            <PrioridadIcon size={10} /> {ticket.prioridad}
          </div>
        </div>
        <div className="kanban-card-title">{ticket.asunto}</div>
        <div className="kanban-card-footer">
          <span><User size={10} /> {ticket.usuario_id?.email?.split('@')[0]}</span>
          {ticket.fecha_vencimiento && (
            <span className={vencida ? 'date-vencido' : ''}>
              <Calendar size={10} /> {formatearFecha(ticket.fecha_vencimiento, false)}
            </span>
          )}
        </div>
        <div className="kanban-expand-hint"><ChevronRight size={12} /></div>
      </div>
    );
  };

  // Render Ticket Detail =======================================================
  const renderTicketDetail = (ticket) => {
    const cambio = cambios[ticket._id] || {};
    const vencida = isVencida(ticket);
    const EstadoIcon = KANBAN_COLUMNS.find(c => c.id === ticket.estado)?.icon || FolderOpen;
    const PrioridadIcon = ticket.prioridad === 'alta' ? AlertTriangle : ticket.prioridad === 'media' ? TrendingUp : Flag;
    const fechaValue = ticket.fecha_vencimiento ? formatearFechaInput(ticket.fecha_vencimiento) : '';
    const horaValue = ticket.fecha_vencimiento ? formatearHoraInput(ticket.fecha_vencimiento) : '23:59';

    // Preparar configuración inicial de recurrencia desde el ticket
    const recurrenciaInicial = ticket.es_recurrente && ticket.recurrencia ? {
      es_recurrente: ticket.es_recurrente,
      recurrencia: {
        tipo: ticket.recurrencia.tipo || 'diaria',
        intervalo: ticket.recurrencia.intervalo || 1,
        solo_dias_habiles: ticket.recurrencia.solo_dias_habiles !== false,
        dias_semana: ticket.recurrencia.dias_semana || [1, 2, 3, 4, 5],
        dia_mes: ticket.recurrencia.dia_mes || 1,
        fecha_fin: ticket.recurrencia.fecha_fin || null
      }
    } : { es_recurrente: false, recurrencia: null };

    return (
      <div key={ticket._id} id={`ticket-${ticket._id}`}
        className={`dashboard-ticket ${vencida ? 'ticket-vencido' : ''} kanban-expanded ${flashIds[ticket._id] ? 'flash' : ''}`}>
        <div className="dashboard-ticket-header">
          <div className="ticket-info">
            <EstadoIcon size={16} style={{ color: colorEstado[ticket.estado] }} />
            <strong>Tarea #{ticket.numero_ticket}</strong>
            <span className="chip-mini"><Clock size={12} /> {timeAgo(getActivityTs(ticket))}</span>
            {vencida && <span className="badge-vencido-header"><AlertCircle size={12} /> VENCIDA</span>}
            {ticket.estado === 'archivada' && <span className="badge-archivada"><Archive size={12} /> Archivada</span>}
          </div>
          <div className="ticket-actions-buttons">
            {ticket.estado !== 'archivada' && (
              <button className="btn-icon" onClick={() => archivarTicket(ticket._id, true)} title="Archivar">
                <Archive size={16} />
              </button>
            )}
            {ticket.estado === 'archivada' && (
              <button className="btn-icon" onClick={() => archivarTicket(ticket._id, false)} title="Restaurar">
                <ArchiveRestore size={16} />
              </button>
            )}
            <button className="btn-icon" onClick={() => toggleTicket(ticket._id)} title="Cerrar">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="ticket-detail">
          <h4>{ticket.asunto}</h4>
          <p>{ticket.descripcion}</p>

          <div className="ticket-meta-grid">
            <div className="meta-item"><span className="meta-label">Estado</span><span className={`dashboard-status ${ticket.estado}`}>{ticket.estado}</span></div>
            <div className="meta-item"><span className="meta-label">Prioridad</span><span className={`priority-badge priority-${ticket.prioridad}`}><PrioridadIcon size={12} /> {ticket.prioridad}</span></div>
            <div className="meta-item"><span className="meta-label">Usuario</span><span><User size={12} /> {ticket.usuario_id?.email}</span></div>
            <div className="meta-item"><span className="meta-label">Creado</span><span><Calendar size={12} /> {formatearFecha(ticket.fecha_creacion)}</span></div>
            <div className="meta-item"><span className="meta-label">Vencimiento</span><span className={vencida ? 'vencido' : ''}><AlertCircle size={12} /> {ticket.fecha_vencimiento ? formatearFecha(ticket.fecha_vencimiento) : 'No definida'}{vencida && <span className="badge-vencido">VENCIDA</span>}</span></div>
          </div>

          {ticket.imagen && (
            <div className="ticket-image">
              <p><Image size={14} /> Imagen adjunta:</p>
              <a href={ticket.imagen} target="_blank" rel="noopener noreferrer">
                <img src={ticket.imagen || '/placeholder.png'} alt="Adjunto" />
              </a>
            </div>
          )}

          <AsignarUsuarios ticketId={ticket._id} onAsignacionCambio={() => cargarTickets({ silent: true })} />

          {ticket.historial?.length > 0 && (
            <div className="ticket-history">
              <h5><MessageSquare size={14} /> Historial</h5>
              <ul>
                {ticket.historial.map((h, i) => (
                  <li key={i}><Clock size={10} /> {formatearFecha(h.fecha)} - <strong>{h.estado}</strong>: {h.comentario}{h.autor && <span className="historial-autor">({h.autor})</span>}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="actions-card">
            <div className="actions-header"><Edit size={16} /><span className="actions-title">Actualizar tarea</span></div>
            <div className="actions-grid">
              <div className="form-item">
                <label>Nuevo estado</label>
                <select value={cambio.nuevoEstado || ''} onChange={e => onCambio(ticket._id, 'nuevoEstado', e.target.value)}>
                  <option value="">Seleccionar…</option>
                  <option value="abierto">Abierto</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                  <option value="reabierto">Reabierto</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="form-item">
                <label>Nueva prioridad</label>
                <select value={cambio.nuevaPrioridad || ''} onChange={e => onCambio(ticket._id, 'nuevaPrioridad', e.target.value)}>
                  <option value="">Seleccionar…</option>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              {/* ========== RECURRENCIA CONFIG (IGUAL QUE EN HOME) ========== */}
              <div className="form-item form-item--wide" style={{ gridColumn: '1 / -1' }}>
                <RecurrenciaConfig 
                  config={cambio.recurrenciaConfig || recurrenciaInicial}
                  onChange={(newConfig) => onCambioRecurrencia(ticket._id, newConfig)}
                />
              </div>

              <div className="form-item">
                <label><Calendar size={12} /> Nueva fecha</label>
                <input type="date" value={cambio.nuevaFecha || fechaValue} onChange={e => onCambio(ticket._id, 'nuevaFecha', e.target.value)} />
              </div>
              <div className="form-item">
                <label><Clock size={12} /> Nueva hora</label>
                <input type="time" value={cambio.nuevaHora || horaValue} onChange={e => onCambio(ticket._id, 'nuevaHora', e.target.value)} step="60" />
              </div>
              <div className="form-item form-item--wide">
                <label><MessageSquare size={12} /> Comentario</label>
                <textarea placeholder="Escribí un comentario… (podés pegar una captura)" value={cambio.nuevoComentario || ''} onChange={e => onCambio(ticket._id, 'nuevoComentario', e.target.value)} rows={3} />
              </div>
              <div className="form-item form-item--wide">
                <label><Image size={12} /> Adjuntar imagen</label>
                <div className="dropzone-pretty">
                  <input id={`file-${ticket._id}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onCambio(ticket._id, 'nuevoArchivo', e.target.files?.[0])} />
                  <label htmlFor={`file-${ticket._id}`} className="btn-secondary"><Upload size={14} /> Elegir imagen</label>
                  {cambio.nuevoArchivo && <span className="file-name">{cambio.nuevoArchivo.name}</span>}
                  {cambio.nuevoArchivo && <button className="btn-ghost" onClick={() => onCambio(ticket._id, 'nuevoArchivo', null)}><X size={14} /> Quitar</button>}
                </div>
              </div>
            </div>
            <div className="actions-footer">
              <button onClick={() => guardarCambios(ticket._id)} disabled={!!saving[ticket._id]}>
                <Save size={14} /> {saving[ticket._id] ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {mensajes[ticket._id] && <span className="status-msg">{mensajes[ticket._id]}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render List Card =======================================================
  const renderListCard = (ticket) => {
    const estaAbierto = abiertos[ticket._id];
    if (estaAbierto) return renderTicketDetail(ticket);
    const vencida = isVencida(ticket);
    const tieneNovedad = changesMap[ticket._id] && Object.values(changesMap[ticket._id]).some(v => v);
    return (
      <div key={ticket._id} id={`ticket-${ticket._id}`}
        className={`dashboard-ticket ${tieneNovedad ? 'row-novedad' : ''}`}
        onClick={() => setOpenAndFocus(ticket._id, true)} style={{ cursor: 'pointer' }}>
        <div className="dashboard-ticket-header">
          <div className="ticket-info">
            <strong>Tarea #{ticket.numero_ticket}</strong>
            <span className={`dashboard-status ${ticket.estado}`}>{ticket.estado}</span>
            {ticket.fecha_vencimiento && (
              <span className={vencida ? 'fecha-vencida' : ''}>
                <Calendar size={10} /> {formatearFecha(ticket.fecha_vencimiento, false)} <Clock size={8} /> {formatearHoraInput(ticket.fecha_vencimiento)}
              </span>
            )}
          </div>
          <ChevronRight size={16} />
        </div>
        <div className="ticket-preview"><span>{ticket.asunto}</span></div>
      </div>
    );
  };

  // Render principal =======================================================
  return (
    <div className="dashboard-container">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Logo" className="dashboard-logo" />
          <div className="brand-meta"><h1>Panel de Tareas</h1><p className="muted">Administración • Portfolio Investment</p></div>
        </div>
        <div className="topbar-actions">
          <div className="view-selector">
            <button className={`view-btn ${viewMode === 'lista' ? 'active' : ''}`} onClick={() => setViewMode('lista')}><LayoutList size={16} /> Lista</button>
            <button className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}><KanbanSquare size={16} /> Kanban</button>
            <button className={`view-btn ${viewMode === 'archivadas' ? 'active' : ''}`} onClick={() => setViewMode('archivadas')}><Archive size={16} /> Archivadas</button>
            <button className={`view-btn ${viewMode === 'calendario' ? 'active' : ''}`} onClick={() => setViewMode('calendario')}><CalendarDays size={16} /> Calendario</button>
            <button className={`view-btn ${viewMode === 'usuarios' ? 'active' : ''}`} onClick={() => setViewMode('usuarios')}><Users size={16} /> Usuarios</button>
          </div>
          <div className="topbar-group">
            <label className="auto-refresh-label"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /><RefreshCw size={12} /> Auto</label>
            <button className="btn-icon" onClick={() => cargarTickets()} title="Refrescar"><RefreshCw size={16} /></button>
            <button className="btn-icon" onClick={toggleTheme} title="Cambiar tema">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
          <div className="bell-wrap">
            <button className="bell-btn" onClick={() => setPanelOpen(p => !p)} data-has-updates={updates.length > 0}>
              <Bell size={18} />
              {updates.length > 0 && <span className="bell-badge">{updates.length}</span>}
            </button>
            {panelOpen && (
              <div className="bell-panel">
                <div className="bell-panel__head"><strong>Novedades {newsCount > 0 && `(${newsCount})`}</strong><button className="btn-secondary btn-sm" onClick={marcarTodoVisto}>Marcar todo</button></div>
                {updates.length === 0 ? <div className="bell-empty">Sin novedades</div> : (
                  <ul className="bell-list">
                    {updates.map(u => (
                      <li key={u.id} className="bell-item" onClick={() => { setPanelOpen(false); setOpenAndFocus(u.id, true); }}>
                        <div className="bell-title">#{u.numero} {u.asunto}</div>
                        <div className="bell-tags">
                          {u.changes.includes('nuevo') && <span className="tag tag-purple">Nuevo</span>}
                          {u.changes.includes('comentario') && <span className="tag tag-green">Comentario</span>}
                          {u.changes.includes('estado') && <span className="tag tag-blue">Estado</span>}
                          {u.changes.includes('prioridad') && <span className="tag tag-amber">Prioridad</span>}
                        </div>
                        <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); marcarUnoVisto(u.id); }}>Marcar visto</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* KPIs */}
      {viewMode !== 'archivadas' && (
        <div className="dashboard-resumen">
          <div className="resumen-card" style={{ borderLeftColor: colorEstado.abierto }}><FolderOpen size={16} /><div className="resumen-title">Abiertos</div><div className="resumen-value">{conteos.abierto}</div></div>
          <div className="resumen-card" style={{ borderLeftColor: colorEstado.pendiente }}><PauseCircle size={16} /><div className="resumen-title">Pendientes</div><div className="resumen-value">{conteos.pendiente}</div></div>
          <div className="resumen-card" style={{ borderLeftColor: colorEstado.en_proceso }}><PlayCircle size={16} /><div className="resumen-title">En proceso</div><div className="resumen-value">{conteos.en_proceso}</div></div>
          <div className="resumen-card" style={{ borderLeftColor: colorEstado.resuelto }}><CheckCircle size={16} /><div className="resumen-title">Resueltos</div><div className="resumen-value">{conteos.resuelto}</div></div>
          <div className="resumen-card" style={{ borderLeftColor: colorEstado.cerrado }}><Lock size={16} /><div className="resumen-title">Cerrados</div><div className="resumen-value">{conteos.cerrado}</div></div>
          <div className="resumen-card total"><Layers size={16} /><div className="resumen-title">Total</div><div className="resumen-value">{conteos.total - conteos.archivada}</div></div>
        </div>
      )}

      <h2>
        {viewMode === 'kanban' && <KanbanSquare size={20} />}{viewMode === 'archivadas' && <Archive size={20} />}
        {viewMode === 'lista' && <LayoutList size={20} />}{viewMode === 'calendario' && <CalendarDays size={20} />}
        {viewMode === 'usuarios' && <Users size={20} />}
        {viewMode === 'kanban' && ' Tablero Kanban'}{viewMode === 'archivadas' && ' Bandeja de Tareas Archivadas'}
        {viewMode === 'lista' && ' Listado de Tareas'}{viewMode === 'calendario' && ' Calendario de Vencimientos'}
        {viewMode === 'usuarios' && ' Gestión de Usuarios'}
      </h2>

      {/* Filtros solo en lista */}
      {viewMode === 'lista' && (
        <>
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input type="text" className="dashboard-search" placeholder="Buscar por número, asunto, descripción o usuario..." value={busquedaTexto} onChange={e => { setBusquedaTexto(e.target.value); setPage(1); }} />
            {busquedaTexto && <span className="search-results-count">{filteredTickets.length} resultado(s)</span>}
          </div>
          <div className="dashboard-filters">
            <select value={estadoFiltro} onChange={e => { setEstadoFiltro(e.target.value); setPage(1); }}>
              <option value="">Todos los estados</option>
              <option value="abierto">Abierto</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
              <option value="reabierto">Reabierto</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select value={prioridadFiltro} onChange={e => { setPrioridadFiltro(e.target.value); setPage(1); }}>
              <option value="">Todas las prioridades</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
            <div className="date-filter-wrapper"><Calendar size={14} className="filter-icon" /><input type="date" className="filter-date" placeholder="Desde" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} /></div>
            <div className="date-filter-wrapper"><Calendar size={14} className="filter-icon" /><input type="date" className="filter-date" placeholder="Hasta" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} /></div>
            {(fechaDesde || fechaHasta || busquedaTexto || estadoFiltro || prioridadFiltro) && (
              <button className="btn-clear-fechas" onClick={limpiarFiltros}><X size={12} /> Limpiar filtros</button>
            )}
            <div className="page-size-selector"><span className="muted">Por página</span><select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          </div>
        </>
      )}

      {/* Kanban */}
      {viewMode === 'kanban' && (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map(column => {
            const ColumnIcon = column.icon;
            return (
              <div key={column.id} className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id)}>
                <div className="kanban-column-header" style={{ borderTopColor: column.color }}>
                  <ColumnIcon size={18} color={column.iconColor} />
                  <span className="kanban-column-title">{column.title}</span>
                  <span className="kanban-column-count">{kanbanData[column.id]?.length || 0}</span>
                </div>
                <div className="kanban-column-body">
                  {kanbanData[column.id]?.map(ticket => abiertos[ticket._id] ? renderTicketDetail(ticket) : renderKanbanCard(ticket))}
                  {(!kanbanData[column.id] || kanbanData[column.id].length === 0) && <div className="kanban-empty">Sin tareas</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {viewMode === 'lista' && (
        <>
          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando…</div>}
          {!loading && pageData.length === 0 && (
            <div className="empty"><Inbox size={24} /> {busquedaTexto ? `No se encontraron resultados para "${busquedaTexto}"` : 'No hay resultados con los filtros actuales.'}</div>
          )}
          {!loading && pageData.length > 0 && pageData.map(ticket => renderListCard(ticket))}
          {!loading && filteredTickets.length > pageSize && (
            <div className="pagination">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <span className="page-info">Página {page} de {pages}</span>
              <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}

      {/* Archivadas */}
      {viewMode === 'archivadas' && (
        <>
          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando…</div>}
          {!loading && filteredTickets.length === 0 && (
            <div className="empty"><Package size={24} /> No hay tareas archivadas<button className="btn-secondary" onClick={() => setViewMode('lista')} style={{ marginTop: 16 }}><LayoutList size={14} /> Volver al listado</button></div>
          )}
          {!loading && filteredTickets.length > 0 && (
            <>
              <div className="archivadas-actions"><button className="btn-secondary" onClick={() => setViewMode('lista')}><LayoutList size={14} /> Volver al listado</button><span className="muted"><Archive size={14} /> {filteredTickets.length} tarea(s) archivada(s)</span></div>
              {pageData.map(ticket => renderListCard(ticket))}
              {filteredTickets.length > pageSize && (
                <div className="pagination">
                  <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                  <span className="page-info">Página {page} de {pages}</span>
                  <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Calendario */}
      {viewMode === 'calendario' && <CalendarView tickets={filteredTickets} />}

      {/* Gestión de Usuarios */}
      {viewMode === 'usuarios' && <GestionUsuarios />}

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle size={18} />}
            {t.type === 'error' && <XCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
            <span className="toast-msg">{t.msg}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;