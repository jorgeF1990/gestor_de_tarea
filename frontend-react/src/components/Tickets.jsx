import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './Tickets.css';

const API = import.meta.env.VITE_BACKEND_URL;
const headers = (token) => ({ Authorization: `Bearer ${token}` });

const estadoOps = ['abierto','pendiente','en_proceso','resuelto','cerrado','reabierto','cancelado'];
const prioOps = ['baja','media','alta'];

/** Última actividad (ms) de un ticket */
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

/** ISO del último movimiento relevante (comentario/actualización) */
const lastISOFromTicket = (t) => {
  const last = t.historial?.[t.historial.length - 1];
  if (last?.fecha) return new Date(last.fecha).toISOString();
  if (t.fecha_actualizacion) return new Date(t.fecha_actualizacion).toISOString();
  return null;
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fPrio, setFPrio] = useState('');

  // sort -> por defecto: "actividad" desc
  const [sort, setSort] = useState({ by: 'actividad', dir: 'desc' });

  // paginado
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // drawer
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  // comentario (solo comentar, sin cambiar estado/prioridad)
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ comentario:'', archivo:null });

  // tema (CLARO por defecto)
  const [theme, setTheme] = useState(() => localStorage.getItem('tickets-theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    localStorage.setItem('tickets-theme', theme);
  }, [theme]);

  const token = localStorage.getItem('token');

  /* ======================
     Novedades (polling + diff por ticket)
     ====================== */
  const [newsCount, setNewsCount] = useState(0);
  const [changesMap, setChangesMap] = useState({}); // { id: {nuevo, comentario, estado, prioridad} }
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const SEEN_KEY = 'tickets_seen_snapshot:v1';

  const getSeen = () => {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
  };
  const setSeen = (snap) => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(snap)); } catch {}
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
    const out = { nuevo:false, comentario:false, estado:false, prioridad:false };

    if (!p) {
      // Ticket nuevo para este usuario (sin snapshot previo)
      out.nuevo = true;
      // Si tiene historial, consideramos también comentario reciente
      if (t.historial?.length) out.comentario = true;
      return out;
    }
    if ((p.lastISO || '') !== (c.lastISO || '')) out.comentario = true;
    if (p.estado !== c.estado) out.estado = true;
    if (p.prioridad !== c.prioridad) out.prioridad = true;

    return out;
  };

  const showToast = (msg) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setToasts(prev => [...prev, { id, msg }]);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notify.mp3');
        audioRef.current.volume = 0.25;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(()=>{});
    } catch {}
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const cargar = async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fEstado) params.append('estado', fEstado);
      if (fPrio) params.append('prioridad', fPrio);

      const { data } = await axios.get(`${API}/tickets?${params.toString()}`, {
        headers: headers(token),
      });

      const ordered = (data || []).slice().sort((a,b) => getActivityTs(b) - getActivityTs(a));

      // Diff por ticket
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

      // Si es polling silencioso y hay cambios, mostramos toast y badge
      if (changesCount > 0 && silent) {
        setNewsCount(changesCount);
        showToast(`🔔 ${changesCount} ticket(s) con novedades`);
      }

      setChangesMap(newChanges);
      setTickets(ordered);
    } catch {
      setTickets([]);
      setChangesMap({});
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // carga inicial + filtros
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [fEstado, fPrio]);

  // polling cada 20s (silencioso)
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

  /* ======================
     Búsqueda / orden / paginado
     ====================== */
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let arr = tickets.filter(t => {
      if (!text) return true;
      return (
        (t.numero_ticket || '').toString().includes(text) ||
        (t.asunto || '').toLowerCase().includes(text) ||
        (t.descripcion || '').toLowerCase().includes(text) ||
        (t.usuario_id?.email || '').toLowerCase().includes(text)
      );
    });

    arr.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;

      const va =
        sort.by === 'actividad' ? getActivityTs(a) :
        sort.by === 'createdAt' ? new Date(a.createdAt || a.fecha_creacion || 0).getTime() :
        sort.by === 'estado' ? (a.estado || '') :
        sort.by === 'prioridad' ? (a.prioridad || '') :
        (a.numero_ticket || 0);

      const vb =
        sort.by === 'actividad' ? getActivityTs(b) :
        sort.by === 'createdAt' ? new Date(b.createdAt || b.fecha_creacion || 0).getTime() :
        sort.by === 'estado' ? (b.estado || '') :
        sort.by === 'prioridad' ? (b.prioridad || '') :
        (b.numero_ticket || 0);

      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });

    return arr;
  }, [tickets, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page-1)*pageSize, page*pageSize);

  const toggleSort = (by) => {
    setSort(s => s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' });
  };

  /* ======================
     Drawer / acciones (solo comentar)
     ====================== */
  const abrirDrawer = (t) => {
    setCurrent(t);
    setForm({ comentario: '', archivo: null });
    setOpen(true);
  };
  const cerrarDrawer = () => {
    setOpen(false);
    setCurrent(null);
    setForm({ comentario:'', archivo:null });
  };

  const guardarComentario = async () => {
    if (!current) return;
    if (!form.comentario && !form.archivo) return;

    setSaving(true);
    try {
      const fd = new FormData();
      if (form.comentario) fd.append('comentario', form.comentario);
      if (form.archivo) fd.append('imagen', form.archivo);
      await axios.put(`${API}/tickets/${current._id}/comentario`, fd, { headers: headers(token) });

      await cargar();
      cerrarDrawer();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id) => {
    try {
      await axios.put(`${API}/tickets/${id}/leido`, {}, { headers: headers(token) });
      await cargar(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="tks-wrap">
      <div className="tks-card">
        <div className="tks-head">
          <h2 style={{margin:0}}>Tickets</h2>

          <div className="tks-tools">
            {/* Toggle de tema */}
            <select
              className="tks-select"
              value={theme}
              onChange={(e)=>setTheme(e.target.value)}
              title="Tema"
              aria-label="Tema"
            >
              <option value="light">Tema claro</option>
              <option value="dark">Tema oscuro</option>
            </select>

            <input
              className="tks-search"
              placeholder="Buscar nº, asunto, descripción o correo"
              value={q}
              onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
            />
            <select className="tks-select" value={fEstado} onChange={e=>{setFEstado(e.target.value); setPage(1);}}>
              <option value="">Todos los estados</option>
              {estadoOps.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <select className="tks-select" value={fPrio} onChange={e=>{setFPrio(e.target.value); setPage(1);}}>
              <option value="">Todas las prioridades</option>
              {prioOps.map(op => <option key={op} value={op}>{op}</option>)}
            </select>

            <button className="tks-btn ghost" onClick={()=>cargar()}>
              {loading ? <span className="loader" /> : (
                <>
                  Refrescar
                  {newsCount > 0 && <span className="tks-badge" style={{marginLeft:8}} title="Novedades">{newsCount}</span>}
                </>
              )}
            </button>

            {newsCount > 0 && (
              <button className="tks-btn" onClick={confirmarVistos} title="Marcar novedades como vistas">
                Marcar visto
              </button>
            )}
          </div>
        </div>

        {/* Leyenda de chips */}
        <div className="tks-legend">
          <span className="chip chip-new">Nuevo</span>
          <span className="chip chip-comment">Comentario</span>
          <span className="chip chip-state">Estado</span>
          <span className="chip chip-prio">Prioridad</span>
        </div>

        {loading && (
          <div className="empty"><span className="loader" /> Cargando…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty">No hay resultados con los filtros actuales.</div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            <table className="tks-table">
              <thead className="tks-thead">
                <tr>
                  <th onClick={()=>toggleSort('numero_ticket')} style={{cursor:'pointer'}}>#</th>
                  <th>Asunto</th>
                  <th onClick={()=>toggleSort('estado')} style={{cursor:'pointer'}}>Estado</th>
                  <th onClick={()=>toggleSort('prioridad')} style={{cursor:'pointer'}}>Prioridad</th>
                  <th>Usuario</th>
                  {/* El orden inicial es por “actividad” */}
                  <th onClick={()=>toggleSort('createdAt')} style={{cursor:'pointer'}}>Creado</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(t => {
                  const ch = changesMap[t._id] || {};
                  const rowIsNew = ch.nuevo || ch.comentario || ch.estado || ch.prioridad;
                  return (
                    <tr
                      key={t._id}
                      className={`tks-row ${rowIsNew ? 'row-new' : ''}`}
                      onClick={() => { abrirDrawer(t); markRead(t._id); }}
                    >
                      <td style={{width:90}}><strong>#{t.numero_ticket}</strong></td>
                      <td>
                        <div style={{fontWeight:700, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                          <span>{t.asunto || 'Sin asunto'}</span>
                          {/* Chips de cambios */}
                          {ch.nuevo && <span className="chip chip-new">Nuevo</span>}
                          {ch.comentario && <span className="chip chip-comment">Comentario</span>}
                          {ch.estado && <span className="chip chip-state">Estado</span>}
                          {ch.prioridad && <span className="chip chip-prio">Prioridad</span>}
                        </div>
                        <div style={{color:'var(--muted)', fontSize:12}}>{(t.descripcion || '').slice(0,90)}</div>
                      </td>
                      <td style={{width:140}}><span className={`tks-status ${t.estado}`}>{t.estado}</span></td>
                      <td style={{width:110}} className={`tks-prio ${t.prioridad}`}>{t.prioridad}</td>
                      <td style={{width:220}}>{t.usuario_id?.email || '—'}</td>
                      <td style={{width:160}}>{new Date(t.createdAt || t.fecha_creacion).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="tks-pag">
              <button className="tks-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button>
              <span className="tks-badge">{page} / {pages}</span>
              <button className="tks-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
            </div>
          </>
        )}
      </div>

      {/* Drawer detalle: solo comentario/adjunto (sin estado/prioridad) */}
      {open && <div className="backdrop" onClick={cerrarDrawer} />}
      {open && current && (
        <aside className="drawer" role="dialog" aria-modal="true">
          <div className="drawer-head">
            <div>
              <div style={{fontWeight:800}}>Ticket #{current.numero_ticket}</div>
              <div style={{color:'var(--muted)', fontSize:12}}>
                {current.asunto || 'Sin asunto'} • {current.usuario_id?.email || '—'}
              </div>
            </div>
            <button className="tks-btn ghost" onClick={cerrarDrawer}>Cerrar ✖</button>
          </div>

          <div className="drawer-body">
            {/* Info básica */}
            <div className="tks-card" style={{padding:'10px', marginBottom:'10px'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                <div><span className="hint">Estado actual</span><div className={`tks-status ${current.estado}`} style={{display:'inline-block', marginTop:6}}>{current.estado}</div></div>
                <div><span className="hint">Prioridad</span><div className={`tks-prio ${current.prioridad}`} style={{marginTop:6}}>{current.prioridad}</div></div>
                <div><span className="hint">Creado</span><div style={{marginTop:6}}>{new Date(current.createdAt || current.fecha_creacion).toLocaleString()}</div></div>
                <div><span className="hint">Usuario</span><div style={{marginTop:6}}>{current.usuario_id?.email || '—'}</div></div>
              </div>

              {current.imagen && (
                <div style={{marginTop:10}}>
                  <span className="hint">Imagen del ticket</span>
                  <div style={{marginTop:6}}>
                    <a href={`${API}/uploads/${current.imagen}`} target="_blank" rel="noreferrer">
                      <img src={`${API}/uploads/${current.imagen}`} alt="Adjunto" width="220" style={{border:'1px solid var(--border)', borderRadius:12}} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Comentario + adjunto */}
            <div className="tks-card" style={{padding:'10px', marginBottom:'10px'}}>
              <div style={{fontWeight:700, marginBottom:8}}>Agregar comentario</div>
              <div style={{marginTop:0}}>
                <label className="hint">Comentario</label>
                <textarea
                  className="textarea"
                  placeholder="Escribí un comentario (podés adjuntar imagen abajo)…"
                  value={form.comentario}
                  onChange={e=>setForm(f=>({...f, comentario:e.target.value}))}
                />
              </div>
              <div style={{marginTop:10, display:'grid', gap:8}}>
                <label className="hint">Adjuntar imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input"
                  onChange={(e)=>setForm(f=>({...f, archivo:e.target.files?.[0] || null}))}
                />
                {form.archivo && <span className="hint">Seleccionado: {form.archivo.name}</span>}
              </div>
            </div>

            {/* Timeline */}
            <div className="tks-card" style={{padding:'10px'}}>
              <div style={{fontWeight:800, marginBottom:8}}>Actividad</div>
              {current.historial?.length ? (
                <ul className="timeline">
                  {current.historial.slice().reverse().map((h, idx) => (
                    <li key={idx}>
                      <time>{new Date(h.fecha).toLocaleString()} • {h.autor || 'sistema'}</time>
                      <div><strong>{h.estado}</strong>: {h.comentario}</div>
                      {h.imagen && (
                        <div style={{marginTop:6}}>
                          <a href={`${API}/uploads/${h.imagen}`} target="_blank" rel="noreferrer">
                            <img src={`${API}/uploads/${h.imagen}`} alt="Adjunto" width="180" style={{border:'1px solid var(--border)', borderRadius:10}} />
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
            <button className="tks-btn ghost" onClick={cerrarDrawer}>Cancelar</button>
            <button className="tks-btn" onClick={guardarComentario} disabled={saving}>
              {saving ? <span className="loader" /> : 'Guardar comentario'}
            </button>
          </div>
        </aside>
      )}

      {/* Toasts de novedades */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast info">
            <div className="toast-icon">🔔</div>
            <div className="toast-msg">{t.msg}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✖</button>
          </div>
        ))}
      </div>
    </div>
  );
}
