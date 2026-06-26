// frontend-react/src/components/Tickets.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import './Tickets.css';
import SilenciarNotificaciones from '../components/SilenciarNotificaciones';
import CalendarView from './CalendarView';

import {
  Search,
  RefreshCw,
  Bell,
  BellRing,
  Clock,
  Calendar,
  CalendarDays,
  CalendarClock,
  Flag,
  User,
  MessageSquare,
  Image,
  Paperclip,
  Send,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  Ticket,
  Activity,
  Lock,
  Archive,
  ArchiveRestore,
  LayoutList
} from 'lucide-react';

const estadoOps = ['abierto', 'pendiente', 'en_proceso', 'resuelto', 'cerrado', 'reabierto', 'cancelado', 'archivado'];
const prioOps = ['baja', 'media', 'alta', 'urgente'];

const getActivityTs = (t) => {
  const created = t.createdAt || t.fecha_creacion;
  const updated = t.updatedAt || t.fecha_actualizacion;
  const lastHist = Array.isArray(t.historial) && t.historial.length
    ? t.historial[t.historial.length - 1]?.fecha
    : null;

  const times = [
    created ? new Date(created).getTime() : 0,
    updated ? new Date(updated).getTime() : 0,
    lastHist ? new Date(lastHist).getTime() : 0,
  ];

  return Math.max(...times.filter(Boolean)) || 0;
};

const lastISOFromTicket = (t) => {
  const last = t.historial?.[t.historial.length - 1];
  if (last?.fecha) return new Date(last.fecha).toISOString();
  if (t.fecha_actualizacion) return new Date(t.fecha_actualizacion).toISOString();
  return null;
};

const formatearFechaHora = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatearFechaCorta = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-AR');
};

const formatearHora = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function Tickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fPrio, setFPrio] = useState('');

  const [sort, setSort] = useState({ by: 'actividad', dir: 'desc' });

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ comentario: '', archivo: null });

  const [theme, setTheme] = useState(() => localStorage.getItem('tickets-theme') || 'light');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('tickets-view-mode') || 'lista');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    localStorage.setItem('tickets-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tickets-view-mode', viewMode);
  }, [viewMode]);

  const [newsCount, setNewsCount] = useState(0);
  const [changesMap, setChangesMap] = useState({});
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const SEEN_KEY = 'tickets_seen_snapshot:v1';

  const getSeen = () => {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
  };
  const setSeen = (snap) => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(snap)); } catch { }
  };
  const buildSnap = (list) => {
    const snap = {};
    for (const t of list) {
      snap[t._id] = {
        lastISO: lastISOFromTicket(t),
        estado: t.estado || '',
        prioridad: t.prioridad || ''
      };
    }
    return snap;
  };

  const computeChanges = (prev, curr, t) => {
    const p = prev?.[t._id];
    const c = curr?.[t._id];
    const out = { nuevo: false, comentario: false, estado: false, prioridad: false };

    if (!p) {
      out.nuevo = true;
      if (t.historial?.length) out.comentario = true;
      return out;
    }
    if ((p.lastISO || '') !== (c.lastISO || '')) out.comentario = true;
    if (p.estado !== c.estado) out.estado = true;
    if (p.prioridad !== c.prioridad) out.prioridad = true;
    return out;
  };

  const showToast = (msg) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, msg }]);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.25;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    } catch { }
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const cargar = async (silent = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No hay token, redirigiendo a login...');
      navigate('/login');
      return;
    }

    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fEstado) params.append('estado', fEstado);
      if (fPrio) params.append('prioridad', fPrio);

      const response = await API.get(`/tickets?${params.toString()}`);

      const data = response;
      const ordered = (data || []).slice().sort((a, b) => getActivityTs(b) - getActivityTs(a));

      const prev = getSeen();
      const curr = buildSnap(ordered);
      const newChanges = {};
      let changesCount = 0;

      for (const t of ordered) {
        const diff = computeChanges(prev, curr, t);
        const anyChange = diff.nuevo || diff.comentario || diff.estado || diff.prioridad;
        if (anyChange) {
          newChanges[t._id] = diff;
          changesCount++;
        }
      }

      if (changesCount > 0 && silent) {
        setNewsCount(changesCount);
        showToast(`${changesCount} ticket(s) con novedades`);
      }

      setChangesMap(newChanges);
      setTickets(ordered);
    } catch (error) {
      console.error('Error cargando tickets:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      }
      setTickets([]);
      setChangesMap({});
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    cargar();
  }, [fEstado, fPrio]);

  useEffect(() => {
    const id = setInterval(() => cargar(true), 20000);
    return () => clearInterval(id);
  }, []);

  const confirmarVistos = () => {
    const snap = buildSnap(tickets);
    setSeen(snap);
    setNewsCount(0);
    setChangesMap({});
  };

  const markAsSeenLocal = (ticket) => {
    setChangesMap(prev => {
      if (!prev[ticket._id]) return prev;
      const n = { ...prev };
      delete n[ticket._id];
      return n;
    });
    setNewsCount(n => Math.max(0, n - 1));
    const prevSnap = getSeen();
    const nextSnap = {
      ...prevSnap,
      [ticket._id]: {
        lastISO: lastISOFromTicket(ticket),
        estado: ticket.estado || '',
        prioridad: ticket.prioridad || ''
      }
    };
    setSeen(nextSnap);
  };

  const filtered = useMemo(() => {
    const textoBusqueda = q.trim().toLowerCase();

    const userRol = (() => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.rol || 'usuario';
        }
      } catch {}
      return 'usuario';
    })();

    let arr;

    if (!textoBusqueda) {
      arr = [...tickets];
    } else {
      arr = tickets.filter(t => {
        const numeroTicket = (t.numero_ticket || '').toString().toLowerCase();
        const asunto = (t.asunto || '').toLowerCase();
        const descripcion = (t.descripcion || '').toLowerCase();
        const email = (t.usuario_id?.email || '').toLowerCase();

        return numeroTicket.includes(textoBusqueda) ||
               asunto.includes(textoBusqueda) ||
               descripcion.includes(textoBusqueda) ||
               email.includes(textoBusqueda);
      });
    }

    if (userRol !== 'admin' && userRol !== 'soporte') {
      arr = arr.filter(t => t.estado !== 'archivado');
    }

    if (sort.by !== 'actividad') {
      const dir = sort.dir === 'asc' ? 1 : -1;

      arr.sort((a, b) => {
        let va, vb;
        if (sort.by === 'fecha_vencimiento') {
          va = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getTime() : 0;
          vb = b.fecha_vencimiento ? new Date(b.fecha_vencimiento).getTime() : 0;
        } else if (sort.by === 'createdAt') {
          va = new Date(a.createdAt || a.fecha_creacion || 0).getTime();
          vb = new Date(b.createdAt || b.fecha_creacion || 0).getTime();
        } else if (sort.by === 'estado') {
          va = a.estado || '';
          vb = b.estado || '';
        } else if (sort.by === 'prioridad') {
          va = a.prioridad || '';
          vb = b.prioridad || '';
        } else {
          va = a.numero_ticket || 0;
          vb = b.numero_ticket || 0;
        }

        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }

    return arr;
  }, [tickets, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (by) => {
    setSort(s => s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' });
  };

  const markRead = async (id) => {
    try {
      await API.put(`/tickets/${id}/leido`, {});
    } catch (e) {
      console.error('Error marcando como leido:', e);
    }
  };

  const abrirDrawer = (t) => {
    markAsSeenLocal(t);
    markRead(t._id);
    setCurrent(t);
    setForm({ comentario: '', archivo: null });
    setOpen(true);
  };

  const cerrarDrawer = () => {
    setOpen(false);
    setCurrent(null);
    setForm({ comentario: '', archivo: null });
  };

  const guardarComentario = async () => {
    if (!current) return;
    if (!form.comentario && !form.archivo) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      if (form.comentario) fd.append('comentario', form.comentario);
      if (form.archivo) fd.append('imagen', form.archivo);

      await API.put(`/tickets/${current._id}/comentario`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await cargar();
      cerrarDrawer();
    } catch (e) {
      console.error('Error guardando comentario:', e);
      if (e.response?.status === 401 || e.response?.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setSaving(false);
    }
  };

  const isVencida = (ticket) => {
    if (!ticket.fecha_vencimiento) return false;
    if (ticket.estado === 'cerrado' || ticket.estado === 'resuelto') return false;
    return new Date(ticket.fecha_vencimiento) < new Date();
  };

  const handleArchivar = async (id, archivar = true) => {
    const nuevoEstado = archivar ? 'archivado' : 'pendiente';
    
    try {
      await API.put(`/tickets/${id}/estado`, { estado: nuevoEstado });
      await cargar();
      cerrarDrawer();
      showToast(archivar ? 'Tarea archivada correctamente' : 'Tarea restaurada correctamente');
    } catch (e) {
      console.error('Error al archivar/restaurar:', e);
      showToast('Error al procesar la tarea');
    }
  };

  if (!localStorage.getItem('token')) {
    return (
      <div className="tks-wrap">
        <div className="tks-card">
          <div className="empty">
            <Lock size={32} />
            <h3>No autenticado</h3>
            <p>Por favor, inicia sesión para ver tus tickets.</p>
            <button 
              className="tks-btn" 
              onClick={() => navigate('/login')}
            >
              Ir a login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tks-wrap">
      <div className="tks-card">
        <div className="tks-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>
              <Ticket size={20} style={{ display: 'inline', marginRight: 8 }} />
              Tareas
            </h2>
            <div className="tks-view-selector">
              <button
                className={`tks-view-btn ${viewMode === 'lista' ? 'active' : ''}`}
                onClick={() => setViewMode('lista')}
                title="Vista lista"
              >
                <LayoutList size={16} />
              </button>
              <button
                className={`tks-view-btn ${viewMode === 'calendario' ? 'active' : ''}`}
                onClick={() => setViewMode('calendario')}
                title="Vista calendario"
              >
                <CalendarDays size={16} />
              </button>
            </div>
          </div>

          <div className="tks-tools">
            <select
              className="tks-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              title="Tema"
              aria-label="Tema"
            >
              <option value="light">Tema claro</option>
              <option value="dark">Tema oscuro</option>
            </select>

            <div className="search-wrapper">
              <Search size={16} className="search-icon-input" />
              <input
                className="tks-search"
                placeholder="Buscar nº, asunto, descripcion o correo..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
              {q && (
                <span className="search-results-count">
                  {filtered.length} resultado(s)
                </span>
              )}
            </div>

            <select className="tks-select" value={fEstado} onChange={e => { setFEstado(e.target.value); setPage(1); }}>
              <option value="">Todos los estados</option>
              {estadoOps.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <select className="tks-select" value={fPrio} onChange={e => { setFPrio(e.target.value); setPage(1); }}>
              <option value="">Todas las prioridades</option>
              {prioOps.map(op => <option key={op} value={op}>{op}</option>)}
            </select>

            <button className="tks-btn ghost" onClick={() => cargar()}>
              {loading ? <Loader2 size={14} className="spin" /> : (
                <>
                  <RefreshCw size={14} /> Refrescar
                  {newsCount > 0 && <span className="tks-badge" style={{ marginLeft: 8 }} title="Novedades">{newsCount}</span>}
                </>
              )}
            </button>

            {newsCount > 0 && (
              <button className="tks-btn" onClick={confirmarVistos} title="Marcar novedades como vistas">
                <BellRing size={14} /> Marcar visto
              </button>
            )}
          </div>
        </div>

        {viewMode === 'lista' && (
          <div className="tks-legend">
            <span className="chip chip-new">Nuevo</span>
            <span className="chip chip-comment">Comentario</span>
            <span className="chip chip-state">Estado</span>
            <span className="chip chip-prio">Prioridad</span>
          </div>
        )}

        {loading && (
          <div className="empty"><Loader2 size={24} className="spin" /> Cargando…</div>
        )}

        {viewMode === 'calendario' && (
          <div className="tks-calendar-wrapper">
            <CalendarView tickets={filtered} />
          </div>
        )}

        {viewMode === 'lista' && (
          <>
            {!loading && filtered.length === 0 && (
              <div className="empty">
                {q ? (
                  <>No se encontraron resultados para "{q}"</>
                ) : (
                  <><Inbox size={32} /> No hay resultados con los filtros actuales.</>
                )}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <>
                <table className="tks-table">
                  <thead className="tks-thead">
                    <tr>
                      <th onClick={() => toggleSort('numero_ticket')} style={{ cursor: 'pointer' }}>#</th>
                      <th>Asunto</th>
                      <th onClick={() => toggleSort('estado')} style={{ cursor: 'pointer' }}>Estado</th>
                      <th onClick={() => toggleSort('prioridad')} style={{ cursor: 'pointer' }}>Prioridad</th>
                      <th onClick={() => toggleSort('fecha_vencimiento')} style={{ cursor: 'pointer' }}>Vence</th>
                      <th>Usuario</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map(t => {
                      const ch = changesMap[t._id] || {};
                      const rowIsNew = ch.nuevo || ch.comentario || ch.estado || ch.prioridad;
                      const vencida = isVencida(t);
                      return (
                        <tr
                          key={t._id}
                          className={`tks-row ${rowIsNew ? 'row-new' : ''}`}
                          onClick={() => abrirDrawer(t)}
                        >
                          <td style={{ width: 90 }}><strong>#{t.numero_ticket}</strong></td>
                          <td style={{ maxWidth: 300 }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span>{t.asunto || 'Sin asunto'}</span>
                              {ch.nuevo && <span className="chip chip-new">Nuevo</span>}
                              {ch.comentario && <span className="chip chip-comment">Comentario</span>}
                              {ch.estado && <span className="chip chip-state">Estado</span>}
                              {ch.prioridad && <span className="chip chip-prio">Prioridad</span>}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{(t.descripcion || '').slice(0, 90)}</div>
                          </td>
                          <td style={{ width: 140 }}><span className={`tks-status ${t.estado}`}>{t.estado}</span></td>
                          <td style={{ width: 110 }} className={`tks-prio ${t.prioridad}`}>{t.prioridad}</td>
                          <td style={{ width: 130 }}>
                            {t.fecha_vencimiento ? (
                              <div className="fecha-vencimiento-cell">
                                <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                                <span className={vencida ? 'fecha-vencida' : ''}>
                                  {formatearFechaCorta(t.fecha_vencimiento)}
                                </span>
                                <Clock size={10} style={{ display: 'inline', marginLeft: 6, marginRight: 2 }} />
                                <span className={vencida ? 'fecha-vencida' : ''}>
                                  {formatearHora(t.fecha_vencimiento)}
                                </span>
                              </div>
                            ) : (
                              <span className="sin-fecha">—</span>
                            )}
                          </td>
                          <td style={{ width: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={12} />
                              {t.usuario_id?.email || '—'}
                            </div>
                          </td>
                          <td style={{ width: 160 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={12} />
                              {new Date(t.createdAt || t.fecha_creacion).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="tks-pag">
                  <button className="tks-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span className="tks-badge">{page} / {pages}</span>
                  <button className="tks-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {open && <div className="backdrop" onClick={cerrarDrawer} />}
      {open && current && (
        <aside className="drawer" role="dialog" aria-modal="true">
          <div className="drawer-head">
            <div>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket size={18} /> Tarea #{current.numero_ticket}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                {current.asunto || 'Sin asunto'} • {current.usuario_id?.email || '—'}
              </div>
            </div>
            <button className="tks-btn ghost" onClick={cerrarDrawer}>
              <X size={16} /> Cerrar
            </button>
          </div>

          <div className="drawer-body">
            <div className="tks-card" style={{ padding: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Activity size={12} /> Estado actual
                  </div>
                  <div className={`tks-status ${current.estado}`} style={{ display: 'inline-block', padding: '4px 10px' }}>{current.estado}</div>
                </div>
                <div>
                  <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Flag size={12} /> Prioridad
                  </div>
                  <div className={`tks-prio ${current.prioridad}`}>{current.prioridad}</div>
                </div>
                <div>
                  <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Calendar size={12} /> Creado
                  </div>
                  <div>{new Date(current.createdAt || current.fecha_creacion).toLocaleString()}</div>
                </div>
                <div>
                  <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <CalendarClock size={12} /> Vencimiento
                  </div>
                  <div>
                    {current.fecha_vencimiento ? (
                      <span className={isVencida(current) ? 'fecha-vencida' : ''}>
                        {formatearFechaHora(current.fecha_vencimiento)}
                        {isVencida(current) && <span className="badge-vencido"> VENCIDA</span>}
                      </span>
                    ) : (
                      <span className="sin-fecha">No definida</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <User size={12} /> Usuario
                  </div>
                  <div>{current.usuario_id?.email || '—'}</div>
                </div>
                {current.es_recurrente && current.recurrencia && (
                  <div>
                    <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <RefreshCw size={12} /> Recurrencia
                    </div>
                    <div style={{
                      padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: 8, fontSize: 12, color: '#1e40af',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      <RefreshCw size={12} />
                      {current.recurrencia.activa
                        ? <>Cada {current.recurrencia.intervalo} {current.recurrencia.tipo}{current.recurrencia.solo_dias_habiles ? ' (dias habiles)' : ''}</>
                        : 'Inactiva'}
                    </div>
                  </div>
                )}
              </div>

              {current.imagen && (
                <div style={{ marginTop: 12 }}>
                  <span className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Image size={14} /> Imagen adjunta
                  </span>
                  <div style={{ marginTop: 6 }}>
                    <a href={current.imagen} target="_blank" rel="noreferrer">
                      <img src={current.imagen || '/logo.svg'} alt="Adjunto" width="200" style={{ border: '1px solid var(--border)', borderRadius: 12 }} />
                    </a>
                  </div>
                </div>
              )}

              <SilenciarNotificaciones
                ticketId={current._id}
                onEstadoCambiado={() => {
                  showToast('Preferencias de notificaciones actualizadas');
                  cargar(true);
                }}
              />
            </div>

            <div className="tks-card" style={{ padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={14} /> Agregar comentario
              </div>
              <div style={{ marginTop: 0 }}>
                <label className="hint">Comentario</label>
                <textarea
                  className="textarea"
                  placeholder="Escribi un comentario (podes adjuntar imagen abajo)…"
                  value={form.comentario}
                  onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))}
                />
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Paperclip size={12} /> Adjuntar imagen
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="input"
                  onChange={(e) => setForm(f => ({ ...f, archivo: e.target.files?.[0] || null }))}
                />
                {form.archivo && <span className="hint">Seleccionado: {form.archivo.name}</span>}
              </div>
            </div>

            <div className="tks-card" style={{ padding: '12px' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> Actividad
              </div>
              {current.historial?.length ? (
                <ul className="timeline">
                  {current.historial.slice().reverse().map((h, idx) => (
                    <li key={idx}>
                      <time style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={10} /> {new Date(h.fecha).toLocaleString()} • <User size={10} /> {h.autor || 'sistema'}
                      </time>
                      <div><strong>{h.estado}</strong>: {h.comentario}</div>
                      {h.imagen && (
                        <div style={{ marginTop: 6 }}>
                          <a href={h.imagen} target="_blank" rel="noreferrer">
                            <img src={h.imagen || '/logo.svg'} alt="Adjunto" width="150" style={{ border: '1px solid var(--border)', borderRadius: 8 }} />
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Sin actividad</div>
              )}
            </div>
          </div>

          <div className="drawer-foot">
            <div className="drawer-actions-left">
              {current.estado !== 'archivado' ? (
                <button 
                  className="tks-btn danger" 
                  onClick={() => handleArchivar(current._id, true)}
                >
                  <Archive size={14} /> Archivar
                </button>
              ) : (
                <button 
                  className="tks-btn" 
                  onClick={() => handleArchivar(current._id, false)}
                >
                  <ArchiveRestore size={14} /> Restaurar
                </button>
              )}
            </div>
            <div className="drawer-actions-right">
              <button className="tks-btn ghost" onClick={cerrarDrawer}>
                <X size={14} /> Cancelar
              </button>
              <button className="tks-btn" onClick={guardarComentario} disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {saving ? 'Guardando...' : 'Guardar comentario'}
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast info">
            <Bell size={16} className="toast-icon" />
            <div className="toast-msg">{t.msg}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
