// mailers/ticketMailer.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/* =========================
   SMTP ROBUSTO
   ========================= */
const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587;
const SMTP_SECURE = SMTP_PORT === 465; // 465=SSL; 587=STARTTLS
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  pool: true,
  maxConnections: 5,
  maxMessages: 50,
  auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
  tls: { minVersion: 'TLSv1.2' }
});

/* =========================
   HELPERS
   ========================= */
const TZ = 'America/Argentina/Buenos_Aires';

const fmtFecha = d =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: TZ }).format(d);

const fmtHora = d =>
  new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', timeZone: TZ }).format(d);

const fmtDateTimeShort = d =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(d);

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* URLs públicas */
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const BACKEND_URL  = (process.env.BACKEND_URL  || process.env.APP_URL || '').replace(/\/$/, '');
const BRAND_NAME   = process.env.BRAND_NAME || 'Portfolio Investment';

/**
 * Construye URL pública de imágenes (historial/adjuntos)
 */
const makeImageUrl = (filename) => {
  if (!filename) return null;
  if (/^https?:\/\//i.test(filename)) return filename;
  if (BACKEND_URL) return `${BACKEND_URL}/uploads/${encodeURIComponent(filename)}`;
  if (FRONTEND_URL) return `${FRONTEND_URL}/uploads/${encodeURIComponent(filename)}`;
  return null;
};

/**
 * Enlace al ticket configurable
 * FRONTEND_TICKET_PATH: /tickets/:id  o  /tickets/numero/:numero
 */
function buildTicketLink(ticket) {
  const base = FRONTEND_URL || 'http://localhost:3000';
  const pattern = (process.env.FRONTEND_TICKET_PATH || '/tickets/:id').trim();
  const pathOut = pattern
    .replace(':id', encodeURIComponent(ticket._id))
    .replace(':numero', encodeURIComponent(ticket.numero_ticket));
  return `${base}${pathOut}`;
}

/**
 * Resuelve el LOGO priorizando:
 *  1) BRAND_LOGO_FILE (ruta local explícita)
 *  2) backend/public/logo.png (ruta local por defecto en backend)
 *  3) BRAND_LOGO_URL absoluta
 *  4) BACKEND_URL + /logo.png  (si servís static de backend/public)
 *  5) FRONTEND_URL + /logo.png (fallback)
 *
 * Devuelve { htmlTag, attachment } listo para usar en el mail.
 */
function buildLogoBlock() {
  const logoFileEnv = process.env.BRAND_LOGO_FILE; // ruta local absoluta o relativa
  const backendPublicLogo = path.resolve('public', 'logo.png'); // <- tu backend/public/logo.png
  const logoUrlRaw = process.env.BRAND_LOGO_URL || '/logo.png'; // si es absoluta, se usa; si es relativa, se combina

  // 1) BRAND_LOGO_FILE → CID
  if (logoFileEnv) {
    const abs = path.isAbsolute(logoFileEnv) ? logoFileEnv : path.resolve(logoFileEnv);
    if (fs.existsSync(abs)) {
      return {
        htmlTag: `<img src="cid:brandLogo" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;">`,
        attachment: { filename: path.basename(abs), path: abs, cid: 'brandLogo' }
      };
    }
  }

  // 2) backend/public/logo.png → CID
  if (fs.existsSync(backendPublicLogo)) {
    return {
      htmlTag: `<img src="cid:brandLogo" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;">`,
      attachment: { filename: 'logo.png', path: backendPublicLogo, cid: 'brandLogo' }
    };
  }

  // 3) BRAND_LOGO_URL absoluta → <img src="https://...">
  if (/^https?:\/\//i.test(logoUrlRaw)) {
    return {
      htmlTag: `<img src="${logoUrlRaw}" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;">`,
      attachment: null
    };
  }

  // 4) BACKEND_URL + /logo.png
  if (BACKEND_URL) {
    const url = `${BACKEND_URL}/logo.png`;
    return {
      htmlTag: `<img src="${url}" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;">`,
      attachment: null
    };
  }

  // 5) FRONTEND_URL + /logo.png
  if (FRONTEND_URL) {
    const url = `${FRONTEND_URL}/logo.png`;
    return {
      htmlTag: `<img src="${url}" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:6px;">`,
      attachment: null
    };
  }

  // Sin logo
  return { htmlTag: '', attachment: null };
}

/* ====== RENDER COMENTARIOS (timeline cards) ====== */
function resolveAuthorRole(entry = {}, ticket = {}) {
  const autor = (entry.autor || '').toLowerCase();
  const cliente = (ticket.usuario_id?.email || ticket.creadoPor || '').toLowerCase();
  const agente  = (ticket.asignadoA?.email || ticket.asignadoA || '').toLowerCase();

  if (autor && cliente && autor === cliente) return 'cliente';
  if (autor && agente && autor === agente) return 'agente';
  return 'otro';
}

function initials(email = '') {
  const base = (email.split('@')[0] || '').replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const i1 = parts[0]?.[0] || email[0] || 'U';
  const i2 = parts[1]?.[0] || '';
  return (i1 + i2).toUpperCase().slice(0, 2);
}

function renderCommentCard(entry, ticket, isLast = false) {
  const when = entry.fecha ? fmtDateTimeShort(new Date(entry.fecha)) : 'Fecha desconocida';
  const estado = esc(entry.estado || '');
  const autor = esc(entry.autor || 'Desconocido');
  const comment = esc(entry.comentario || '').replace(/\n/g, '<br>');
  const imgUrl = makeImageUrl(entry.imagen);
  const role = resolveAuthorRole(entry, ticket);

  const roleBadge = role === 'cliente'
    ? 'background:#e0f2fe;color:#075985;'
    : role === 'agente'
    ? 'background:#dcfce7;color:#065f46;'
    : 'background:#f1f5f9;color:#0f172a;';

  const border = role === 'cliente'
    ? 'border-left:4px solid #38bdf8;'
    : role === 'agente'
    ? 'border-left:4px solid #34d399;'
    : 'border-left:4px solid #cbd5e1;';

  const lastRibbon = isLast
    ? `<div style="font-size:11px;color:#0f172a;background:#fef3c7;border:1px solid #fde68a;padding:2px 6px;border-radius:999px;display:inline-block;margin-left:8px;">Último</div>`
    : '';

  return `
    <div style="margin-bottom:10px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;${border}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="width:28px;height:28px;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;">
          ${initials(entry.autor || '')}
        </div>
        <div style="font-size:12px;color:#475569;">
          <strong style="color:#0f172a">${autor}</strong> · ${when} ${lastRibbon}
        </div>
        <div style="margin-left:auto;">
          <span style="display:inline-block;padding:4px 8px;border-radius:999px;font-size:11px;${roleBadge}">
            ${role === 'cliente' ? 'Cliente' : role === 'agente' ? 'Agente' : 'Otro'}
          </span>
          ${estado ? `<span style="display:inline-block;padding:4px 8px;border-radius:999px;font-size:11px;background:#eef2ff;color:#3730a3;margin-left:6px;">${estado}</span>` : ''}
        </div>
      </div>
      <div style="font-size:14px;line-height:1.55;color:#0f172a;">${comment || '<em style="color:#64748b">Sin contenido</em>'}</div>
      ${imgUrl ? `
        <div style="margin-top:8px;">
          <a href="${imgUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">Ver imagen adjunta</a>
        </div>
      ` : ''}
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

/* =========================
   EMAIL PRINCIPAL
   ========================= */
exports.enviarCorreoTicket = async (ticket, destinatarios, imagenPath = null, accion = 'crear') => {
  if (!ticket || !ticket.numero_ticket) {
    console.warn('enviarCorreoTicket: ticket inválido o sin numero_ticket');
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

  const subjectPrefix =
    accion === 'crear' ? 'Nuevo' :
    accion === 'estado' ? 'Actualizado' :
    'Comentario';
  const subject = `${subjectPrefix} – Ticket #${numero} – ${ticket.asunto || ''}`.trim();

  const labelAccion =
    accion === 'crear' ? 'Nuevo ticket' :
    accion === 'estado' ? 'Ticket actualizado' :
    'Nuevo comentario';

  const { htmlTag: logoTag, attachment: logoAttachment } = buildLogoBlock();

  // Orden y bloques de comentarios
  const historialOrdenado = Array.isArray(ticket.historial)
    ? ticket.historial.slice().sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
    : [];
  const ultimo = historialOrdenado.length ? historialOrdenado[historialOrdenado.length - 1] : null;

  const ultimoHtml = (accion === 'comentario' && ultimo)
    ? renderCommentCard(ultimo, ticket, true)
    : '';

  const MAX_HISTORY = 8;
  const itemsHistorial = [];
  for (let i = historialOrdenado.length - 1; i >= 0; i--) {
    const entry = historialOrdenado[i];
    if (ultimoHtml && ultimo && isSameComment(entry, ultimo)) continue;
    itemsHistorial.push(renderCommentCard(entry, ticket, false));
    if (itemsHistorial.length >= MAX_HISTORY) break;
  }
  const historialHtml = itemsHistorial.length
    ? itemsHistorial.join('')
    : `<div style="font-size:13px;color:#64748b;"><em>Sin actividad adicional</em></div>`;
  const showMoreHtml = (historialOrdenado.length - (ultimoHtml ? 1 : 0) > MAX_HISTORY)
    ? `<div style="margin-top:6px;color:#64748b;font-size:12px;">… Hay más actividad. Consulte el ticket para ver el historial completo.</div>`
    : '';

  // Texto plano
  const textLines = [];
  textLines.push(`${subjectPrefix} de ticket`);
  textLines.push(`Ticket #${numero}`);
  textLines.push('');
  if (accion === 'crear') {
    textLines.push(`Asunto: ${ticket.asunto || ''}`);
    textLines.push(`Fecha: ${fechaStr}`);
    textLines.push(`Hora: ${horaStr}`);
    textLines.push(`Creado por: ${ticket.usuario_id?.email || ''}`);
    textLines.push(`Estado: ${ticket.estado || 'N/A'}`);
    textLines.push(`Prioridad: ${ticket.prioridad || 'N/A'}`);
    textLines.push('');
    textLines.push('Descripción:');
    textLines.push(ticket.descripcion || '');
  } else if (accion === 'estado') {
    textLines.push(`Estado actual: ${ticket.estado || 'N/A'}`);
    textLines.push(`Prioridad actual: ${ticket.prioridad || 'N/A'}`);
    textLines.push(`Fecha/Hora: ${fmtDateTimeShort(new Date())}`);
  } else if (accion === 'comentario') {
    if (ultimo) {
      textLines.push(`${fmtDateTimeShort(new Date(ultimo.fecha || Date.now()))} - ${ultimo.estado || ''}:`);
      textLines.push((ultimo.comentario || '').trim());
      if (ultimo.autor) textLines.push(`(${ultimo.autor})`);
    } else {
      textLines.push(`Ticket #${numero} actualizado con un nuevo comentario.`);
    }
  }
  textLines.push('');
  textLines.push(`No responda a este correo. Siga el ticket aquí: ${enlaceTicket}`);
  const text = textLines.join('\n');

  // HTML
  let html = `
  <div style="font-family: Inter, Segoe UI, Roboto, Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <!-- Izquierda: logo + marca + acción + ticket -->
              <td valign="middle" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    ${logoTag ? `<td valign="middle" style="padding:0; padding-right:12px;">${logoTag}</td>` : ``}
                    <td valign="middle" style="padding:0;">
                      <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1;">
                        ${BRAND_NAME}
                      </div>
                      <div style="font-size:12px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin-top:2px;">
                        ${labelAccion}
                      </div>
                      <div style="font-size:20px;font-weight:800;margin-top:4px;color:#0f172a;">
                        Ticket #${numero}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
              <!-- Derecha: chips -->
              <td valign="middle" align="right" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding-left:6px;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;font-size:12px;background:#eef2ff;color:#3730a3;font-weight:700;">
                        ${estado}
                      </span>
                    </td>
                    <td style="padding-left:6px;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;font-size:12px;background:#fef3c7;color:#92400e;font-weight:700;">
                        ${prioridad}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0 8px;">
            <tr><td style="width:140px;color:#64748b;font-size:13px;">Asunto</td><td style="font-weight:600;">${asuntoTicket}</td></tr>
            <tr><td style="width:140px;color:#64748b;font-size:13px;">Fecha</td><td>${fmtFecha(createdSafe)}</td></tr>
            <tr><td style="width:140px;color:#64748b;font-size:13px;">Hora</td><td>${fmtHora(createdSafe)}</td></tr>
            <tr><td style="width:140px;color:#64748b;font-size:13px;">Creado por</td><td>${creador}</td></tr>
          </table>

          ${accion === 'crear' ? `
            <div style="margin-top:14px;">
              <div style="color:#64748b;font-size:13px;margin-bottom:6px;">Descripción</div>
              <div style="font-size:14px;line-height:1.55;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                ${descripcion || '<em style="color:#64748b">Sin descripción</em>'}
              </div>
            </div>
          ` : ''}

          ${accion === 'comentario' && ultimoHtml ? `
            <div style="margin-top:16px;">
              <div style="color:#64748b;font-size:13px;margin-bottom:6px;">Último comentario</div>
              ${ultimoHtml}
            </div>
          ` : ''}

          ${Array.isArray(ticket.historial) && ticket.historial.length ? `
            <div style="margin-top:16px;">
              <div style="color:#64748b;font-size:13px;margin-bottom:6px;">Historial reciente</div>
              ${historialHtml}
              ${showMoreHtml}
            </div>
          ` : ''}

          ${FRONTEND_URL ? `
            <div style="margin-top:18px;">
              <a href="${enlaceTicket}" target="_blank" rel="noopener noreferrer"
                 style="display:inline-block;padding:12px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">
                Ver ticket
              </a>
            </div>
          ` : ''}

        </td>
      </tr>

      <tr>
        <td style="padding:14px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;background:#f9fafb;">
          ⚠️ No responda a este correo. Para continuar con el seguimiento, ingrese al sistema y acceda al ticket #${numero}.
        </td>
      </tr>
    </table>
  </div>
  `;

  // Adjuntos (si existen en disco)
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
  // Adjuntar logo CID si corresponde
  if (logoAttachment) attachments.push(logoAttachment);

  const mailOptions = {
    from: `"${BRAND_NAME} – Sistema de Tickets" <${EMAIL_FROM}>`,
    to: Array.isArray(destinatarios) ? destinatarios.join(',') : destinatarios,
    subject,
    headers: { 'X-Ticket-Id': String(numero) },
    replyTo: process.env.NO_REPLY || EMAIL_FROM,
    text,
    html,
    attachments: attachments.length ? attachments : undefined
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Correo enviado a: ${mailOptions.to}`);
  } catch (error) {
    console.error('Error al enviar el correo:', error?.message || error);
  }
};

/* Útil p/otros mails simples (reset pass, etc.) */
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
