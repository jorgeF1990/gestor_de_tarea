const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587;
const SMTP_SECURE = SMTP_PORT === 465;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS;

const MAIL_CC  = process.env.MAIL_CC  || '';
const MAIL_BCC = process.env.MAIL_BCC || '';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
  tls: { minVersion: 'TLSv1.2' }
});

const TZ = 'America/Argentina/Buenos_Aires';

const fmtFecha = d =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: TZ }).format(d);

const fmtHora = d =>
  new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', timeZone: TZ }).format(d);

const fmtDateTimeShort = d =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(d);

const fmtDateShort = d =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: TZ }).format(d);

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const BACKEND_URL  = (process.env.BACKEND_URL  || process.env.APP_URL || '').replace(/\/$/, '');
const BRAND_NAME   = process.env.BRAND_NAME || 'TaskNest';

const makeImageUrl = (filename) => {
  if (!filename) return null;
  if (/^https?:\/\//i.test(filename)) return filename;
  if (BACKEND_URL) return `${BACKEND_URL}/uploads/${encodeURIComponent(filename)}`;
  if (FRONTEND_URL) return `${FRONTEND_URL}/uploads/${encodeURIComponent(filename)}`;
  return null;
};

function buildTicketLink(ticket) {
  const base = FRONTEND_URL || 'http://localhost:3000';
  const pattern = (process.env.FRONTEND_TICKET_PATH || '/tareas/:id').trim();
  const pathOut = pattern
    .replace(':id', encodeURIComponent(ticket._id))
    .replace(':numero', encodeURIComponent(ticket.numero_ticket));
  return `${base}${pathOut}`;
}

function buildLogoBlock() {
  const logoFileEnv = process.env.BRAND_LOGO_FILE;
  const backendPublicLogo = path.resolve('public', 'logo.svg');
  const logoUrlRaw = process.env.BRAND_LOGO_URL || '/logo.svg';

  const makeCidTag = () =>
    `<img src="cid:brandLogo" width="40" height="40" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;border-radius:8px;">`;

  if (logoFileEnv) {
    const abs = path.isAbsolute(logoFileEnv) ? logoFileEnv : path.resolve(logoFileEnv);
    if (fs.existsSync(abs)) {
      return { htmlTag: makeCidTag(), attachment: { filename: path.basename(abs), path: abs, cid: 'brandLogo' } };
    }
  }
  if (fs.existsSync(backendPublicLogo)) {
    return { htmlTag: makeCidTag(), attachment: { filename: 'logo.svg', path: backendPublicLogo, cid: 'brandLogo' } };
  }
  return { htmlTag: '', attachment: null };
}

function initials(email = '') {
  const base = (email.split('@')[0] || '').replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const i1 = parts[0]?.[0] || email[0] || 'U';
  const i2 = parts[1]?.[0] || '';
  return (i1 + i2).toUpperCase().slice(0, 2);
}

function getRoleColors(entry, ticket) {
  const autor = (entry.autor || '').toLowerCase();
  const cliente = (ticket.usuario_id?.email || ticket.creadoPor || '').toLowerCase();
  
  const esAsignado = ticket.asignados?.some(a => {
    const email = (a.email || '').toLowerCase();
    return email === autor;
  });
  
  if (autor === 'envios@portfolioinvestment.com.ar' || autor.includes('admin')) {
    return {
      bg: '#faf5ff', border: '#e9d5ff', avatarBg: '#7c3aed',
      badge: '#f3e8ff', badgeText: '#6b21a8', label: 'Admin',
      showBadge: true
    };
  }
  
  if (autor && cliente && autor === cliente) {
    return {
      bg: '#f8fafc', border: '#e2e8f0', avatarBg: '#64748b',
      badge: '#f1f5f9', badgeText: '#475569', label: '',
      showBadge: false
    };
  }
  
  if (autor && esAsignado) {
    return {
      bg: '#f8fafc', border: '#e2e8f0', avatarBg: '#475569',
      badge: '#f1f5f9', badgeText: '#475569', label: '',
      showBadge: false
    };
  }
  
  if (autor === 'sistema') {
    return {
      bg: '#faf5ff', border: '#e9d5ff', avatarBg: '#7c3aed',
      badge: '#f3e8ff', badgeText: '#6b21a8', label: 'Admin',
      showBadge: true
    };
  }
  
  return {
    bg: '#f8fafc', border: '#e2e8f0', avatarBg: '#64748b',
    badge: '#f1f5f9', badgeText: '#475569', label: '',
    showBadge: false
  };
}

function renderCommentCard(entry, ticket, isLast = false) {
  const when = entry.fecha ? fmtDateTimeShort(new Date(entry.fecha)) : 'Fecha desconocida';
  const autor = esc(entry.autor || 'Sistema');
  const comment = esc(entry.comentario || '').replace(/\n/g, '<br>');
  const imgUrl = makeImageUrl(entry.imagen);
  const estado = esc(entry.estado || '');
  const colors = getRoleColors(entry, ticket);
  const inicial = initials(entry.autor || 'S');

  return `
    <div style="margin-bottom:10px;padding:14px 16px;background:${colors.bg};border:1px solid ${colors.border};border-radius:10px;${isLast ? 'border-left:3px solid #6366f1;' : ''}">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="44" style="vertical-align:top;padding-right:14px;">
            <table cellpadding="0" cellspacing="0" border="0" width="44" height="44" style="width:44px;height:44px;">
              <tr>
                <td align="center" valign="middle" style="width:44px;height:44px;background:${colors.avatarBg};border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="display:inline-block;color:#ffffff;font-size:15px;font-weight:700;line-height:44px;text-align:center;width:44px;font-family:Arial,Helvetica,sans-serif;">${inicial}</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align:top;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="font-size:13px;font-weight:600;color:#1e293b;">${autor}</span>
              ${colors.showBadge ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${colors.badge};color:${colors.badgeText};">${colors.label}</span>` : ''}
              ${isLast ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#eef2ff;color:#4f46e5;">Nuevo</span>' : ''}
              ${estado ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;background:#f1f5f9;color:#64748b;">${estado}</span>` : ''}
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${when}</div>
            <div style="font-size:13px;line-height:1.6;color:#475569;">${comment || '<span style="color:#94a3b8;font-style:italic;">Sin contenido</span>'}</div>
            ${imgUrl ? `<div style="margin-top:8px;padding:8px 12px;background:#ffffff;border:1px solid ${colors.border};border-radius:8px;display:inline-block;"><a href="${imgUrl}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none;font-size:12px;font-weight:500;">Ver imagen adjunta</a></div>` : ''}
          </td>
        </tr>
      </table>
    </div>
  `;
}

function isSameComment(a, b) {
  if (!a || !b) return false;
  const sameText = (a.comentario || '').trim() === (b.comentario || '').trim();
  const sameAuthor = (a.autor || '').toLowerCase() === (b.autor || '').toLowerCase();
  const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
  const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
  const close = Math.abs(ta - tb) < 60 * 1000;
  return sameText && sameAuthor && close;
}

const estadoColores = {
  pendiente:  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  abierto:    { bg: '#dcfce7', text: '#065f46', border: '#22c55e' },
  en_proceso: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  resuelto:   { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
  cerrado:    { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' },
  reabierto:  { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  cancelado:  { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  archivado:  { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' },
  archivada:  { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' }
};

const prioridadColores = {
  baja:   { bg: '#f0fdf4', text: '#166534', badge: '#22c55e' },
  media:  { bg: '#fefce8', text: '#854d0e', badge: '#eab308' },
  alta:   { bg: '#fef2f2', text: '#991b1b', badge: '#ef4444' },
  urgente:{ bg: '#fef2f2', text: '#7f1d1d', badge: '#dc2626' }
};

function formatRecurrencia(ticket) {
  if (!ticket.es_recurrente || !ticket.recurrencia) return null;
  const rec = ticket.recurrencia;
  if (!rec.activa && !ticket.es_recurrente) return null;
  
  const tipoTexto = { diaria: 'dias', semanal: 'semanas', mensual: 'meses', anual: 'anos' };
  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  
  let descripcion = `Cada ${rec.intervalo || 1} ${tipoTexto[rec.tipo] || rec.tipo}`;
  if (rec.tipo === 'semanal' && rec.dias_semana?.length) {
    const dias = rec.dias_semana.map(d => nombresDias[d]).join(', ');
    descripcion += ` (${dias})`;
  }
  if (rec.tipo === 'mensual' && rec.dia_mes) descripcion += ` el dia ${rec.dia_mes}`;
  if (rec.solo_dias_habiles !== false) descripcion += ' · Solo dias habiles';
  if (rec.fecha_fin) descripcion += ` · Hasta ${fmtDateShort(new Date(rec.fecha_fin))}`;
  
  return { activa: rec.activa !== false, descripcion, tipo: rec.tipo };
}

function composeSubject(accion, ticket) {
  const numero = ticket.numero_ticket;
  const asunto = (ticket.asunto || '').trim();
  
  const tipos = {
    '30_dias': 'Recordatorio 30 dias',
    '21_dias': 'Recordatorio 21 dias',
    '14_dias': 'Recordatorio 14 dias',
    '7_dias': 'Recordatorio 7 dias',
    '3_dias': 'URGENTE - 3 dias',
    '1_dia': 'URGENTE - Vence manana',
    'hoy': 'URGENTE - Vence HOY',
    'proximo_recordatorio': 'Recordatorio de Vencimiento',
    'vencido_recordatorio': 'Tarea Vencida',
    'vencida_1': 'Tarea Vencida',
    'vencida_3': 'Tarea Vencida (3 dias)',
    'vencida_7': 'Tarea Vencida (1 semana)',
    'vencida_14': 'Tarea Vencida (2 semanas)',
    'vencida_30': 'Tarea Vencida (1 mes)',
    'crear': 'Nueva Tarea',
    'estado': 'Tarea Actualizada',
    'comentario': 'Nuevo Comentario',
    'asignacion_usuario': 'Has sido asignado a una tarea',
    'asignacion_creador': 'Usuario asignado a tu tarea',
    'asignacion_admin': 'Nueva asignacion en tarea',
    'desasignacion_usuario': 'Has sido desasignado de una tarea',
    'desasignacion_creador': 'Usuario desasignado de tu tarea',
    'desasignacion_admin': 'Desasignacion en tarea',
    'tarea_recurrente': 'Nueva tarea generada (Recurrencia)'
  };
  
  const prefijo = tipos[accion] || 'Actualizacion';
  return `${prefijo} · Tarea #${numero}${asunto ? ` · ${asunto}` : ''}`;
}

function composePreheader(accion, ticket, ultimo) {
  if (accion === 'comentario' && ultimo) {
    const autor = ultimo.autor || 'Alguien';
    const short = (ultimo.comentario || '').replace(/\s+/g,' ').slice(0, 80);
    return `${autor}: ${short}`;
  }
  if (accion === 'estado') return `Estado: ${ticket.estado} · Prioridad: ${ticket.prioridad}`;
  if (accion.includes('asignacion') || accion.includes('desasignacion')) return `Tarea #${ticket.numero_ticket}: ${ticket.asunto || ''}`;
  if (accion === 'tarea_recurrente') return `Nueva tarea generada automaticamente: ${ticket.asunto || ''}`;
  return `Tarea #${ticket.numero_ticket} · ${ticket.estado} · ${ticket.prioridad}`;
}

exports.enviarCorreoTicket = async (ticket, destinatarios, imagenPath = null, accion = 'crear') => {
  if (!ticket || !ticket.numero_ticket) {
    console.warn('enviarCorreoTicket: ticket invalido o sin numero_ticket');
    return;
  }

  const createdRaw = ticket.fecha_creacion || ticket.createdAt || Date.now();
  const createdAt = createdRaw instanceof Date ? createdRaw : new Date(createdRaw);
  const createdSafe = isNaN(createdAt) ? new Date() : createdAt;

  const fechaStr = fmtFecha(createdSafe);
  const horaStr  = fmtHora(createdSafe);

  const asuntoTicket = esc(ticket.asunto || 'Sin asunto');
  const descripcion  = esc(ticket.descripcion || '').replace(/\n/g, '<br>');
  const estado       = esc((ticket.estado || 'N/A').toString());
  const prioridad    = esc((ticket.prioridad || 'N/A').toString());
  const numero       = ticket.numero_ticket;
  const creador      = esc(ticket.usuario_id?.email || ticket.creadoPor || 'Desconocido');

  const enlaceTicket = buildTicketLink(ticket);

  const eColor = estadoColores[estado] || estadoColores.pendiente;
  const pColor = prioridadColores[prioridad] || prioridadColores.media;

  let fechaVencimientoHtml = '';
  let fechaVencimientoTexto = '';
  let esVencida = false;
  
  if (ticket.fecha_vencimiento) {
    const fechaVen = new Date(ticket.fecha_vencimiento);
    const fechaVenStr = fmtDateShort(fechaVen);
    const horaVenStr = fmtHora(fechaVen);
    esVencida = fechaVen < new Date();
    const diasInfo = ticket.diasHastaVencimiento || Math.ceil((fechaVen - new Date()) / (1000 * 60 * 60 * 24));
    
    fechaVencimientoHtml = `
      <tr>
        <td style="width:150px;color:#64748b;font-size:13px;padding:6px 0;">Fecha de vencimiento</td>
        <td style="padding:6px 0;${esVencida ? 'color:#dc2626;font-weight:600;' : 'color:#1e293b;'}">
          ${fechaVenStr} a las ${horaVenStr}
          ${esVencida ? '<span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;margin-left:8px;">VENCIDA</span>' : ''}
          ${diasInfo > 0 && !esVencida ? `<span style="display:inline-block;background:#fefce8;color:#a16207;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:500;margin-left:8px;">En ${diasInfo} dias</span>` : ''}
        </td>
      </tr>
    `;
    fechaVencimientoTexto = `${fechaVenStr} a las ${horaVenStr}`;
  }

  const recurrenciaInfo = formatRecurrencia(ticket);
  let recurrenciaHtml = '';
  if (recurrenciaInfo) {
    recurrenciaHtml = `
      <tr>
        <td style="width:150px;color:#64748b;font-size:13px;padding:6px 0;">Recurrencia</td>
        <td style="padding:6px 0;color:#1e293b;">
          <span style="display:inline-block;background:#eef2ff;color:#4f46e5;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:500;">
            ${recurrenciaInfo.activa ? 'Activa' : 'Inactiva'} · ${recurrenciaInfo.descripcion}
          </span>
        </td>
      </tr>
    `;
  }

  const titulosTipo = {
    '30_dias': 'Recordatorio de Vencimiento',
    '21_dias': 'Recordatorio de Vencimiento',
    '14_dias': 'Recordatorio de Vencimiento',
    '7_dias': 'Recordatorio Importante',
    '3_dias': 'Aviso Urgente de Vencimiento',
    '1_dia': 'La tarea vence manana',
    'hoy': 'La tarea vence hoy',
    'proximo_recordatorio': 'Recordatorio de Vencimiento',
    'vencido_recordatorio': 'Tarea Pendiente de Resolucion',
    'vencida_1': 'Tarea Vencida',
    'vencida_3': 'Tarea Vencida',
    'vencida_7': 'Tarea Vencida',
    'vencida_14': 'Tarea Vencida',
    'vencida_30': 'Tarea Vencida',
    'crear': 'Nueva Tarea Creada',
    'estado': 'Tarea Actualizada',
    'comentario': 'Nuevo Comentario',
    'asignacion_usuario': 'Has sido asignado a una tarea',
    'asignacion_creador': 'Usuario asignado a tu tarea',
    'asignacion_admin': 'Nueva asignacion',
    'desasignacion_usuario': 'Has sido desasignado',
    'desasignacion_creador': 'Usuario desasignado',
    'desasignacion_admin': 'Desasignacion',
    'tarea_recurrente': 'Tarea Generada Automaticamente'
  };
  
  const tituloNotificacion = titulosTipo[accion] || 'Actualizacion de Tarea';
  
  const labelAccion = accion.includes('dias') || accion === 'hoy' || accion.includes('vencida') ||
                      accion === 'proximo_recordatorio' || accion === 'vencido_recordatorio'
    ? 'Recordatorio'
    : accion === 'crear' ? 'Nueva Tarea'
    : accion === 'estado' ? 'Actualizacion'
    : accion === 'comentario' ? 'Comentario'
    : accion.includes('asignacion') ? 'Asignacion'
    : accion.includes('desasignacion') ? 'Desasignacion'
    : accion === 'tarea_recurrente' ? 'Recurrencia'
    : 'Actualizacion';

  const subject = composeSubject(accion, ticket);
  const preheaderText = composePreheader(accion, ticket, 
    Array.isArray(ticket.historial) ? ticket.historial[ticket.historial.length - 1] : null);

  const { htmlTag: logoTag, attachment: logoAttachment } = buildLogoBlock();

  const historialOrdenado = Array.isArray(ticket.historial)
    ? ticket.historial.slice().sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
    : [];
  const ultimo = historialOrdenado.length ? historialOrdenado[historialOrdenado.length - 1] : null;

  const ultimoHtml = (accion === 'comentario' && ultimo)
    ? renderCommentCard(ultimo, ticket, true)
    : '';

  const MAX_HISTORY = 5;
  const itemsHistorial = [];
  for (let i = historialOrdenado.length - 1; i >= 0; i--) {
    const entry = historialOrdenado[i];
    if (ultimoHtml && ultimo && isSameComment(entry, ultimo)) continue;
    itemsHistorial.push(renderCommentCard(entry, ticket, false));
    if (itemsHistorial.length >= MAX_HISTORY) break;
  }
  const historialHtml = itemsHistorial.length
    ? itemsHistorial.join('')
    : '';

  const textLines = [];
  textLines.push(`Tarea #${numero} - ${tituloNotificacion}`);
  textLines.push('');
  textLines.push(`Asunto: ${ticket.asunto || ''}`);
  textLines.push(`Creado: ${fechaStr} a las ${horaStr}`);
  if (ticket.fecha_vencimiento) textLines.push(`Vencimiento: ${fechaVencimientoTexto}`);
  if (recurrenciaInfo) textLines.push(`Recurrencia: ${recurrenciaInfo.descripcion}`);
  textLines.push(`Creado por: ${creador}`);
  textLines.push(`Estado: ${estado} · Prioridad: ${prioridad}`);
  textLines.push('');
  textLines.push('Descripcion:');
  textLines.push(ticket.descripcion || 'Sin descripcion');
  
  if (accion === 'comentario' && ultimo) {
    textLines.push('');
    textLines.push('Nuevo comentario:');
    textLines.push(`${fmtDateTimeShort(new Date(ultimo.fecha || Date.now()))} - ${ultimo.autor || 'Sistema'}:`);
    textLines.push((ultimo.comentario || '').trim());
  }
  
  if (ticket.descripcionRecordatorio) {
    textLines.push('');
    textLines.push(ticket.descripcionRecordatorio);
  }
  
  textLines.push('');
  textLines.push(`Ver tarea: ${enlaceTicket}`);
  textLines.push('');
  textLines.push('No responda a este correo. Ingrese al sistema para continuar con el seguimiento.');
  const text = textLines.join('\n');

  const preheader = esc(preheaderText || '');

  let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background:#ffffff;border-bottom:1px solid #e8ecf0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${logoTag ? `<td width="48" style="vertical-align:middle;">${logoTag}</td>` : ''}
                  <td style="vertical-align:middle;${logoTag ? 'padding-left:14px;' : ''}">
                    <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;">${BRAND_NAME}</div>
                    <div style="font-size:12px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-top:2px;">${labelAccion}</div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${eColor.bg};color:${eColor.text};border:1px solid ${eColor.border};">${estado}</span>
                    <span style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${pColor.bg};color:${pColor.text};margin-left:6px;border:1px solid ${pColor.badge};">${prioridad}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Titulo -->
          <tr>
            <td style="padding:20px 28px 0;">
              <div style="font-size:20px;font-weight:700;color:#0f172a;line-height:1.4;">${tituloNotificacion}</div>
              <div style="font-size:14px;color:#64748b;margin-top:4px;">Tarea <strong style="color:#1e293b;">#${numero}</strong> · ${asuntoTicket}</div>
            </td>
          </tr>

          <!-- Detalles -->
          <tr>
            <td style="padding:16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="width:150px;color:#64748b;font-size:13px;padding:6px 0;">Creado</td>
                  <td style="padding:6px 0;color:#1e293b;">${fechaStr} a las ${horaStr}</td>
                </tr>
                ${fechaVencimientoHtml}
                ${recurrenciaHtml}
                <tr>
                  <td style="width:150px;color:#64748b;font-size:13px;padding:6px 0;">Creado por</td>
                  <td style="padding:6px 0;color:#1e293b;">${creador}</td>
                </tr>
              </table>

              <!-- Descripcion -->
              <div style="margin-top:16px;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:8px;">Descripcion</div>
                <div style="font-size:14px;line-height:1.65;color:#334155;background:#f8fafc;border:1px solid #e8ecf0;border-radius:10px;padding:14px 16px;">
                  ${descripcion || '<span style="color:#94a3b8;">Sin descripcion</span>'}
                </div>
              </div>

              ${ticket.descripcionRecordatorio ? `
              <div style="margin-top:16px;padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
                <div style="font-size:13px;font-weight:600;color:#92400e;">Aviso Importante</div>
                <div style="font-size:13px;color:#78350f;margin-top:4px;line-height:1.5;">${ticket.descripcionRecordatorio}</div>
              </div>
              ` : ''}

              ${accion === 'comentario' && ultimoHtml ? `
              <div style="margin-top:20px;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:10px;">Nuevo Comentario</div>
                ${ultimoHtml}
              </div>
              ` : ''}

              ${Array.isArray(ticket.historial) && ticket.historial.length ? `
              <div style="margin-top:20px;">
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:10px;">Historial Reciente</div>
                ${historialHtml}
              </div>
              ` : ''}

              ${FRONTEND_URL ? `
              <div style="margin-top:20px;text-align:center;">
                <a href="${enlaceTicket}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
                  Ver tarea en el sistema
                </a>
              </div>
              ` : ''}

              <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;">
                <span style="font-size:12px;color:#94a3b8;">No desea recibir mas avisos sobre esta tarea?</span>
                <a href="${FRONTEND_URL}/tareas/${ticket._id}/silenciar" style="color:#4f46e5;text-decoration:none;font-size:12px;font-weight:500;margin-left:4px;">Silenciar notificaciones</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e8ecf0;background:#f8fafc;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
                Este es un mensaje automatico del Sistema de Gestion de Tareas de ${BRAND_NAME}.<br>
                Por favor, no responda a este correo.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const attachments = [];
  if (imagenPath) {
    const full = path.resolve(imagenPath);
    if (fs.existsSync(full)) attachments.push({ filename: path.basename(full), path: full });
  }
  if (Array.isArray(ticket.historial) && ticket.historial.length) {
    const names = new Set(ticket.historial.map(e => e.imagen).filter(Boolean));
    for (const name of names) {
      const candidate = path.resolve('uploads', name);
      if (fs.existsSync(candidate)) {
        attachments.push({ filename: name, path: candidate });
      }
    }
  }
  const { attachment: logoAtt } = buildLogoBlock();
  if (logoAtt && !attachments.find(a => a.cid === 'brandLogo')) {
    attachments.push(logoAtt);
  }

  const mailOptions = {
    from: `"${BRAND_NAME}" <${EMAIL_FROM}>`,
    to: Array.isArray(destinatarios) ? destinatarios.join(',') : destinatarios,
    cc: MAIL_CC || undefined,
    bcc: MAIL_BCC || undefined,
    subject,
    headers: {
      'X-Tarea-Id': String(numero),
      'List-Unsubscribe': `<mailto:${EMAIL_FROM}?subject=unsubscribe>`
    },
    replyTo: process.env.NO_REPLY || EMAIL_FROM,
    text,
    html,
    attachments: attachments.length ? attachments : undefined
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Correo enviado a: ${mailOptions.to} - Tipo: ${accion} - Tarea: #${numero}`);
  } catch (error) {
    console.error('Error al enviar el correo:', error?.message || error);
  }
};

async function enviarCorreo(to, subject, text, html = null) {
  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html: html || undefined
  };
  return transporter.sendMail(mailOptions);
}

module.exports.enviarCorreo = enviarCorreo;