const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sanitize = require('sanitize-filename');
const { v4: uuidv4 } = require('uuid');

const Ticket = require('../models/ticket.model');

const EMAIL_USER = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS;
const IMAP_HOST  = process.env.IMAP_HOST  || 'imap.gmail.com';
const IMAP_PORT  = Number(process.env.IMAP_PORT || 993);
const UPLOADS    = path.join(__dirname, '..', 'uploads');
const STATE_FILE = path.join(__dirname, '.imap-state.json');
const LABEL_PROCESSED = process.env.IMAP_PROCESSED_LABEL || 'processed-by-bot';
const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB || 8);
const MAX_COMMENT_CHARS = Number(process.env.MAX_COMMENT_CHARS || 15000);

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

function stripQuoted(text = '') {
  const markers = [
    /^On .* wrote:$/mi,
    /^El .* escribio:$/mi,
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
  const ct = (att.contentType || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  if (att.size && toMB(att.size) > MAX_IMAGE_SIZE_MB) return null;

  const base = sanitize(att.filename || `img_${uuidv4()}`);
  const filename = base || `img_${uuidv4()}`;
  const finalPath = path.join(UPLOADS, filename);

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
  const destinatarios = [];
  const assigned = ticket.asignadoA?.email || ticket.asignadoA || null;
  const cliente  = ticket.usuario_id?.email || ticket.cliente?.email || null;

  if (cliente && actorEmail && actorEmail.toLowerCase() !== cliente.toLowerCase()) {
    destinatarios.push(cliente);
  }
  if (assigned && actorEmail && actorEmail.toLowerCase() !== assigned.toLowerCase()) {
    destinatarios.push(assigned);
  }

  const uniq = Array.from(new Set(destinatarios.map((e) => e.toLowerCase())));

  if (process.env.NOTIFY_WEBHOOK_URL && uniq.length) {
    try {
      await fetch(process.env.NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NOTIFY_TOKEN || ''}`
        },
        body: JSON.stringify({
          type: 'ticket:new-comment',
          payload: {
            ticketId: ticket._id.toString(),
            numero: ticket.numero_ticket,
            evento,
            destinatarios: uniq
          }
        })
      });
    } catch (e) {
      console.error('Webhook notify error:', e.message);
    }
  }
}

async function processUid(client, uid) {
  const { source } = await client.download(uid);
  const parsed = await simpleParser(source);

  const subject = parsed.subject || '';
  const from = parsed.from?.value?.[0]?.address || 'desconocido';

  const headerTicketId = parsed.headers.get('x-ticket-id');
  const numero = headerTicketId || extractTicketIdFromSubject(subject);
  if (!numero) return;

  const ticket = await Ticket.findOne({ numero_ticket: numero });
  if (!ticket) return;

  let comentario = parsed.text?.trim() ||
                   parsed.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
                   '';
  comentario = stripQuoted(comentario).slice(0, MAX_COMMENT_CHARS);

  let imagen = null;
  if (Array.isArray(parsed.attachments)) {
    for (const att of parsed.attachments) {
      const saved = await saveAttachment(att);
      if (saved) { imagen = saved; break; }
    }
  }

  const last = ticket.historial?.[ticket.historial.length - 1];
  if (!(last && last.comentario === comentario && (last.autor || '').toLowerCase() === from.toLowerCase())) {
    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado,
      comentario,
      autor: from,
      imagen
    });
    await ticket.save();
    await notifyTicketUpdate({ ticket, actorEmail: from, evento: 'email-comment' });
  }

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
    console.log('INBOX abierto. Escuchando...');

    const searchCriteria = state.lastUid ? { seen: false, uid: `${state.lastUid + 1}:*` } : { seen: false };
    for await (const uid of client.search(searchCriteria)) {
      await processUid(client, uid);
      state.lastUid = Math.max(state.lastUid || 0, uid);
      await writeState(state);
    }

    for await (const msg of client.idle()) {
      if (msg.exists) {
        for await (const uid of client.search({ seen: false, uid: `${state.lastUid + 1}:*` })) {
          await processUid(client, uid);
          state.lastUid = Math.max(state.lastUid || 0, uid);
          await writeState(state);
        }
      }
    }
  } catch (err) {
    console.error('IMAP error:', err.message);
  } finally {
    try { await client.logout(); } catch {}
  }
}

run();