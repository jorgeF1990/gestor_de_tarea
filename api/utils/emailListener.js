/* eslint-disable no-console */
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('@nodemailer/mailparser');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sanitize = require('sanitize-filename');
const { v4: uuidv4 } = require('uuid');

const Ticket = require('../models/ticket.model');
// TIP opcional: si tenés un sistema de notificaciones centralizado, importalo acá
// const notify = require('../services/notify'); // ej. WebSocket/Redis/SNS/etc.

const EMAIL_USER = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS; // ideal: OAuth2 (pendiente)
const IMAP_HOST  = process.env.IMAP_HOST  || 'imap.gmail.com';
const IMAP_PORT  = Number(process.env.IMAP_PORT || 993);
const UPLOADS    = path.join(__dirname, '..', 'uploads');
const STATE_FILE = path.join(__dirname, '.imap-state.json');
const LABEL_PROCESSED = process.env.IMAP_PROCESSED_LABEL || 'processed-by-bot';
const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB || 8);
const MAX_COMMENT_CHARS = Number(process.env.MAX_COMMENT_CHARS || 15000);

// Helpers
const toMB = (bytes) => bytes / (1024 * 1024);

async function ensureFolders() {
  await fsp.mkdir(UPLOADS, { recursive: true });
}

async function readState() {
  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastUid: 0 };
  }
}
async function writeState(state) {
  await fsp.writeFile(STATE_FILE, JSON.stringify(state), 'utf8');
}

// Quita el bloque de respuesta citada más común (heurística simple)
function stripQuoted(text = '') {
  const markers = [
    /^On .* wrote:$/mi,
    /^El .* escribió:$/mi,
    /^De: .*$/mi,
    /^---- Original Message ----$/mi,
    /^From: .*$/mi
  ];
  for (const m of markers) {
    const idx = text.search(m);
    if (idx > 0) return text.slice(0, idx).trim();
  }
  return text.trim();
}

function extractTicketIdFromSubject(subject = '') {
  const s = subject.replace(/^(re|fwd|rv|aw|fw):\s*/i, '');
  const m = s.match(/Ticket\s*#(\d+)/i);
  return m ? m[1] : null;
}

async function saveAttachment(att) {
  // Solo imágenes (image/*) y tamaño <= MAX_IMAGE_SIZE_MB
  const ct = (att.contentType || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  if (att.size && toMB(att.size) > MAX_IMAGE_SIZE_MB) return null;

  const base = sanitize(att.filename || `img_${uuidv4()}`);
  const filename = base || `img_${uuidv4()}`;
  const finalPath = path.join(UPLOADS, filename);

  // evita overwrite
  let target = finalPath;
  let i = 1;
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  while (fs.existsSync(target)) {
    target = path.join(UPLOADS, `${name}_${i}${ext}`);
    i++;
  }
  await fsp.writeFile(target, att.content);
  return path.basename(target);
}

async function notifyTicketUpdate({ ticket, actorEmail, evento }) {
  // Evita notificar al autor original del ticket o al mismo actor
  const destinatarios = [];
  // Si tenés asignación de agente:
  const assigned = ticket.asignadoA?.email || ticket.asignadoA || null;
  const cliente  = ticket.usuario_id?.email || ticket.cliente?.email || null;

  // Regla: si escribe el cliente -> notificar al agente; si escribe el agente -> notificar al cliente.
  if (cliente && actorEmail && actorEmail.toLowerCase() !== cliente.toLowerCase()) {
    destinatarios.push(cliente);
  }
  if (assigned && actorEmail && actorEmail.toLowerCase() !== assigned.toLowerCase()) {
    destinatarios.push(assigned);
  }

  // (Opcional) Si no hay assigned, notificar a un grupo de soporte por defecto
  // if (!assigned && process.env.SUPPORT_EMAIL) destinatarios.push(process.env.SUPPORT_EMAIL);

  // Eliminá duplicados
  const uniq = Array.from(new Set(destinatarios.map((e) => e.toLowerCase())));

  // Enviá al sistema de notificaciones (campana en tu front)
  // await notify.publish('ticket:new-comment', { ticketId: ticket._id, numero: ticket.numero_ticket, evento, destinatarios: uniq });

  // Alternativa sencilla: webhook interno
  if (process.env.NOTIFY_WEBHOOK_URL && uniq.length) {
    try {
      await fetch(process.env.NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NOTIFY_TOKEN || ''}` },
        body: JSON.stringify({
          type: 'ticket:new-comment',
          payload: { ticketId: ticket._id.toString(), numero: ticket.numero_ticket, evento, destinatarios: uniq }
        })
      });
    } catch (e) {
      console.error('Webhook notify error:', e.message);
    }
  }
}

async function processUid(client, uid) {
  // Descarga y parseo MIME
  const { source } = await client.download(uid);
  const parsed = await simpleParser(source);

  const subject = parsed.subject || '';
  const from = parsed.from?.value?.[0]?.address || 'desconocido';

  // Correlación: X-Ticket-Id > asunto
  const headerTicketId = parsed.headers.get('x-ticket-id');
  const numero = headerTicketId || extractTicketIdFromSubject(subject);
  if (!numero) return;

  const ticket = await Ticket.findOne({ numero_ticket: numero });
  if (!ticket) return;

  // Texto: preferí text, si no html->texto
  let comentario = parsed.text?.trim() ||
                   parsed.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
                   '';
  comentario = stripQuoted(comentario).slice(0, MAX_COMMENT_CHARS);

  // Adjuntos: guardá la primera imagen válida
  let imagen = null;
  if (Array.isArray(parsed.attachments)) {
    for (const att of parsed.attachments) {
      const saved = await saveAttachment(att);
      if (saved) { imagen = saved; break; }
    }
  }

  // Idempotencia básica: si el último historial coincide (texto+autor) no lo dupliques
  const last = ticket.historial?.[ticket.historial.length - 1];
  if (last && last.comentario === comentario && (last.autor || '').toLowerCase() === from.toLowerCase()) {
    // ya procesado
  } else {
    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado, // no cambiamos estado desde email
      comentario,
      autor: from,
      imagen
    });
    // marca "no leído" para los otros (campana)
    // suponiendo que ticket.leidoPor = [{usuario, fecha}]
    // acá removemos / no sumamos lectura para los destinatarios distintos de from
    // (tu backend ya maneja esto al abrir el ticket)
    await ticket.save();
    await notifyTicketUpdate({ ticket, actorEmail: from, evento: 'email-comment' });
  }

  // Marca como leído y agrega label
  try { await client.messageFlagsAdd(uid, ['\\Seen']); } catch {}
  try { if (LABEL_PROCESSED) await client.messageLabelsAdd(uid, [LABEL_PROCESSED]); } catch {}
}

async function run() {
  await ensureFolders();
  const state = await readState();

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    logger: false
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    console.log('📥 INBOX abierto. Escuchando…');

    // 1) Procesar no leídos al inicio (desde lastUid si existe)
    const searchCriteria = state.lastUid ? { seen: false, uid: `${state.lastUid + 1}:*` } : { seen: false };
    for await (const uid of client.search(searchCriteria)) {
      await processUid(client, uid);
      state.lastUid = Math.max(state.lastUid || 0, uid);
      await writeState(state);
    }

    // 2) IDLE: procesar nuevos
    for await (const msg of client.idle()) {
      if (msg.exists) {
        // Buscar últimos no leídos desde lastUid
        for await (const uid of client.search({ seen: false, uid: `${state.lastUid + 1}:*` })) {
          await processUid(client, uid);
          state.lastUid = Math.max(state.lastUid || 0, uid);
          await writeState(state);
        }
      }
    }
  } catch (err) {
    console.error('✗ IMAP error:', err.message);
  } finally {
    try { await client.logout(); } catch {}
  }
}

run();
