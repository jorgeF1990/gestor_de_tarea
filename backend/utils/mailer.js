const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Envía un correo según la acción realizada sobre el ticket
 * Adjunta imágenes encontradas en imagenPath y en ticket.historial (si existen)
 *
 * @param {Object} ticket - Datos del ticket (debe contener numero_ticket y opcionalmente APP_URL, historial[])
 * @param {string[]|string} destinatarios - Correos destino
 * @param {string|null} imagenPath - Ruta local relativa a proyecto (ej: 'uploads/miimagen.jpg') o null
 * @param {'crear'|'estado'|'comentario'} accion - Tipo de acción
 */
exports.enviarCorreoTicket = async (ticket, destinatarios, imagenPath = null, accion = 'crear') => {
  if (!ticket || !ticket.numero_ticket) {
    console.warn('enviarCorreoTicket: ticket inválido o sin numero_ticket');
    return;
  }



  // Priorizar FRONTEND_URL del .env; si no existe, usar ticket.APP_URL o APP_URL del env como fallback 
  //descomentar si se quiere usar ticket.APP_URL
  const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

  //const envAppUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  //const ticketAppUrl = ticket?.APP_URL ? String(ticket.APP_URL).replace(/\/$/, '') : '';
  // APP_URL público para enlaces en el correo: preferir FRONTEND_URL, luego ticket.APP_URL, luego APP_URL (backend)
  const APP_URL = FRONTEND_URL; //|| ticketAppUrl || envAppUrl || '';
  const BACKEND_URL = (process.env.BACKEND_URL || process.env.APP_URL || '').replace(/\/$/, '');

  // helper para construir URL pública de imagen
  const makeImageUrl = (filename) => {
    if (!filename) return null;
    if (/^https?:\/\//i.test(filename)) return filename;
    if (BACKEND_URL && BACKEND_URL.length) {
      // fallback relativo
      return `${BACKEND_URL}/uploads/${encodeURIComponent(filename)}`;
    }
    return `${APP_URL}/uploads/${filename}`;
  };

  // helpers fecha/hora
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR') : 'Desconocida');
  const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('es-AR') : 'Desconocida');

  const createdAt = ticket.createdAt || ticket.fecha_creacion || Date.now();
  const fechaCreacion = ticket.fecha_creacion || formatDate(createdAt);
  const horaCreacion = ticket.hora_creacion || formatTime(createdAt);
  const ultimoAutor = ticket.ultimo_autor || ticket.usuario_id?.email || 'Desconocido';
  const fechaActualizacion = new Date();

  // Construcción del HTML
  let html = `<h2>${accion === 'crear' ? 'Nuevo ticket creado' : accion === 'comentario' ? 'Nuevo comentario en ticket' : 'Actualización de ticket'}</h2>`;
  html += `<p><strong>Ticket #${ticket.numero_ticket}</strong></p>`;

  if (accion === 'crear') {
    html += `
      <p><strong>Asunto:</strong> ${ticket.asunto || 'Sin asunto'}</p>
      <p><strong>Fecha:</strong> ${fechaCreacion}</p>
      <p><strong>Hora:</strong> ${horaCreacion}</p>
      <p><strong>Creado por:</strong> ${ultimoAutor}</p>
      <p><strong>Estado:</strong> ${ticket.estado || 'N/A'}</p>
      <p><strong>Prioridad:</strong> ${ticket.prioridad || 'N/A'}</p>
      <p><strong>Descripción:</strong><br>${(ticket.descripcion || '').replace(/\n/g, '<br>')}</p>
      <p><strong>Imagen:</strong><br>${makeImageUrl(ticket.imagen)}</p>
    `;
  } else if (accion === 'estado') {
    html += `
      <p><strong>Estado actual:</strong> ${ticket.estado || 'N/A'}</p>
      <p><strong>Prioridad actual:</strong> ${ticket.prioridad || 'N/A'}</p>
      <p><strong>Fecha:</strong> ${formatDate(fechaActualizacion)}</p>
      <p><strong>Hora:</strong> ${formatTime(fechaActualizacion)}</p>
      <p><strong>Actualizado por:</strong> ${ticket.actualizador || ultimoAutor}</p>
    `;
  } else if (accion === 'comentario') {
    const ultimo = Array.isArray(ticket.historial) && ticket.historial.length ? ticket.historial[ticket.historial.length - 1] : null;
    if (ultimo) {
      const fechaUlt = new Date(ultimo.fecha || Date.now()).toLocaleString('es-AR');
      const imagenUrlUlt = makeImageUrl(ultimo.imagen);
      const imagenLinkUlt = imagenUrlUlt ? `<br><a href="${imagenUrlUlt}" target="_blank" rel="noopener noreferrer">url: ${imagenUrlUlt}</a>` : '';
      html += `<p>${fechaUlt} - <strong>${ultimo.estado || ''}</strong>: ${(ultimo.comentario || '').replace(/\n/g, '<br>')} (${ultimo.autor || 'Desconocido'})${imagenLinkUlt}</p>`;
    } else {
      html += `<p>Ticket #${ticket.numero_ticket} actualizado con un nuevo comentario.</p>`;
    }
  }

  // Historial completo (orden cronológico ascendente)
  if (Array.isArray(ticket.historial) && ticket.historial.length) {
    html += `<hr><h3>Historial completo</h3>`;
    const historialOrdenado = ticket.historial.slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    historialOrdenado.forEach(entry => {
      const fecha = entry.fecha ? new Date(entry.fecha).toLocaleString('es-AR') : 'Fecha desconocida';
      const comentario = entry.comentario ? entry.comentario.replace(/\n/g, '<br>') : '';
      const imagenUrl = makeImageUrl(entry.imagen);
      const imagenHtml = imagenUrl ? `<br><a href="${imagenUrl}" target="_blank" rel="noopener noreferrer">url: ${imagenUrl}</a>` : '';
      html += `<p>${fecha} - <strong>${entry.estado || ''}</strong>: ${comentario} (${entry.autor || 'Desconocido'})${imagenHtml}</p>`;
    });
  }

  // Mostrar URL de imagen pasada en imagenPath (si se pasó)
  if (imagenPath) {
    const filename = path.basename(imagenPath);
    const imagenUrl = makeImageUrl(filename);
    if (imagenUrl) {
      html += `<hr><p><strong>Imagen adjunta (URL):</strong> <a href="${imagenUrl}" target="_blank" rel="noopener noreferrer">${imagenUrl}</a></p>`;
    }
  }

  html += `
    <hr>
    <p style="color: red;"><strong>⚠️ No responda a este correo.</strong><br>
    Para continuar con el seguimiento, ingrese a la <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">Sistema Tickets</a> y acceda al ticket 
    <span style="display:inline-block; font-size:20px; font-weight:700; color:#000; background:#fff; padding:2px 6px; border-radius:4px; margin-left:6px;">#${ticket.numero_ticket}</span>.
    </p>
  `;

  // Recopilar attachments: imagenPath y todas las imágenes del historial que existan en disco
  const attachments = [];

  // Adjuntar imagenPath si existe en disco
  if (imagenPath) {
    const fullPath = path.resolve(imagenPath);
    if (fs.existsSync(fullPath)) {
      attachments.push({ filename: path.basename(fullPath), path: fullPath });
    }
  }

  // Adjuntar imágenes referenciadas en historial (evitar duplicados)
  if (Array.isArray(ticket.historial) && ticket.historial.length) {
    const nombres = new Set();
    ticket.historial.forEach(entry => {
      if (entry.imagen) nombres.add(entry.imagen);
    });
    for (const name of nombres) {
      const candidate = path.resolve('uploads', name);
      if (fs.existsSync(candidate)) {
        if (!attachments.find(a => path.resolve(a.path) === candidate)) {
          attachments.push({ filename: name, path: candidate });
        }
      }
    }
  }

  const mailOptions = {
    from: `"Sistema Tickets Portfolio Investment" <${process.env.EMAIL_FROM}>`,
    to: Array.isArray(destinatarios) ? destinatarios.join(',') : destinatarios,
    subject: `Ticket #${ticket.numero_ticket} ${accion === 'crear' ? 'creado' : accion === 'estado' ? 'actualizado' : 'comentado'}`,
    html,
    attachments: attachments.length ? attachments : undefined
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Correo enviado a: ${mailOptions.to}`);
  } catch (error) {
    console.error('Error al enviar el correo:', error && error.message ? error.message : error);
  }
};

/**
 * Función simple para enviar correos (útil para recuperación de contraseña)
 * @param {string} to - destinatario
 * @param {string} subject - asunto
 * @param {string} text - cuerpo en texto plano
 * @param {string|null} html - cuerpo en html (opcional)
 */
async function enviarCorreo(to, subject, text, html = null) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html: html || undefined
  };
  return transporter.sendMail(mailOptions);
}

module.exports.enviarCorreo = enviarCorreo;