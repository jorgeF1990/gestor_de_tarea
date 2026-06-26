// backend/controllers/tickets.controller.js
const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const { enviarCorreoTicket } = require('../utils/mailer');
const { calcularProximaFecha, ajustarADiaHabil, esDiaHabil } = require('../utils/fechas');
const ical = require('ical-generator').default;

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const resolveAppUrlFromReq = (req) => {
  const envUrl = process.env.APP_URL && process.env.APP_URL !== 'http://localhost:3000'
    ? process.env.APP_URL
    : null;
  const reqUrl = `${req.protocol}://${req.get('host')}`;
  return (envUrl || reqUrl).replace(/\/$/, '');
};

const ADMIN_EMAIL = 'envios@portfolioinvestment.com.ar';

const ESTADOS_VALIDOS = {
  ABIERTO: 'abierto',
  PENDIENTE: 'pendiente',
  EN_PROCESO: 'en_proceso',
  RESUELTO: 'resuelto',
  CERRADO: 'cerrado',
  REABIERTO: 'reabierto',
  CANCELADO: 'cancelado',
  ARCHIVADO: 'archivado'
};

const ESTADOS_FINALES = [ESTADOS_VALIDOS.CERRADO, ESTADOS_VALIDOS.RESUELTO, ESTADOS_VALIDOS.ARCHIVADO];

const TIPOS_RECURRENCIA = ['diaria', 'semanal', 'mensual', 'anual'];

async function esAdminOAgente(email) {
  if (!email) return false;
  try {
    const user = await User.findOne({ email: email.toLowerCase() }, 'rol');
    return user && ['admin', 'soporte'].includes(user.rol);
  } catch {
    return false;
  }
}

async function getDestinatariosNotificacion(ticket, actorEmail, accion) {
  let destinatarios = [];
  
  const creadorEmail = ticket.usuario_id?.email || null;
  
  let emailsAsignados = [];
  if (ticket.asignados && ticket.asignados.length > 0) {
    const populados = ticket.asignados
      .filter(a => a && a.email)
      .map(a => a.email);
    emailsAsignados.push(...populados);
    
    const idsNoPopulados = ticket.asignados
      .filter(a => (typeof a === 'string') || (a instanceof mongoose.Types.ObjectId) || (a && a._id && !a.email))
      .map(a => (a._id || a).toString())
      .filter(Boolean);
    
    if (idsNoPopulados.length > 0) {
      try {
        const usuarios = await User.find({ _id: { $in: idsNoPopulados } }, 'email');
        emailsAsignados.push(...usuarios.map(u => u.email).filter(Boolean));
      } catch (e) {}
    }
  }
  
  const esActorAdmin = await esAdminOAgente(actorEmail);
  
  switch (accion) {
    case 'crear':
      if (actorEmail) destinatarios.push(actorEmail);
      destinatarios.push(...emailsAsignados);
      destinatarios.push(ADMIN_EMAIL);
      break;
      
    case 'comentario':
      if (esActorAdmin) {
        if (creadorEmail) destinatarios.push(creadorEmail);
        destinatarios.push(...emailsAsignados.filter(e => e !== actorEmail));
        destinatarios.push(ADMIN_EMAIL);
      } else {
        destinatarios.push(...emailsAsignados);
        destinatarios.push(ADMIN_EMAIL);
      }
      break;
      
    case 'estado':
    case 'asignacion':
    case 'desasignacion':
      if (creadorEmail) destinatarios.push(creadorEmail);
      destinatarios.push(...emailsAsignados.filter(e => e !== actorEmail));
      destinatarios.push(ADMIN_EMAIL);
      if (actorEmail) destinatarios.push(actorEmail);
      break;
      
    default:
      if (creadorEmail) destinatarios.push(creadorEmail);
      destinatarios.push(...emailsAsignados);
      destinatarios.push(ADMIN_EMAIL);
  }
  
  return uniq(destinatarios).filter(e => e);
}

const obtenerUrlImagen = (file) => {
  return file ? file.path || file.filename || null : null;
};

const getEstadoFinal = (estado) => {
  return ESTADOS_FINALES.includes(estado) ? estado : null;
};

/* ==================== CREAR TICKET ==================== */
exports.crearTicket = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      error: 'Usuario no autenticado correctamente'
    });
  }

  try {
    const asunto = (req.body?.asunto || '').toString().trim();
    const descripcion = (req.body?.descripcion || '').toString();
    
    let fecha_vencimiento = null;
    if (req.body?.fecha_vencimiento) {
      const fecha = req.body.fecha_vencimiento;
      const hora = req.body.hora_vencimiento || '23:59';
      const fechaHora = new Date(`${fecha}T${hora}:00`);
      if (!isNaN(fechaHora.getTime())) {
        fecha_vencimiento = fechaHora;
      }
    }
    
    const esRecurrente = req.body?.es_recurrente === 'true' || req.body?.es_recurrente === true;
    let configRecurrencia = null;
    
    if (esRecurrente) {
      const tipo = req.body?.recurrencia_tipo;
      const intervalo = parseInt(req.body?.recurrencia_intervalo) || 1;
      const soloDiasHabiles = req.body?.solo_dias_habiles !== 'false' && req.body?.solo_dias_habiles !== false;
      
      if (!tipo || !TIPOS_RECURRENCIA.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de recurrencia invalido' });
      }
      
      if (soloDiasHabiles && fecha_vencimiento) {
        if (!esDiaHabil(fecha_vencimiento)) {
          fecha_vencimiento = ajustarADiaHabil(fecha_vencimiento);
        }
      }
      
      configRecurrencia = {
        tipo,
        intervalo,
        solo_dias_habiles: soloDiasHabiles,
        fecha_inicio: fecha_vencimiento || new Date(),
        activa: true,
        ultima_generacion: new Date()
      };
      
      if (tipo === 'semanal') {
        if (req.body?.dias_semana) {
          try {
            configRecurrencia.dias_semana = typeof req.body.dias_semana === 'string' 
              ? JSON.parse(req.body.dias_semana) 
              : req.body.dias_semana;
          } catch (e) {
            configRecurrencia.dias_semana = [1, 2, 3, 4, 5];
          }
        } else {
          configRecurrencia.dias_semana = [1, 2, 3, 4, 5];
        }
      }
      
      if (tipo === 'mensual' && req.body?.dia_mes) {
        configRecurrencia.dia_mes = parseInt(req.body.dia_mes);
      }
      
      if (req.body?.fecha_fin_recurrencia) {
        const fechaFin = new Date(req.body.fecha_fin_recurrencia);
        if (!isNaN(fechaFin.getTime())) {
          configRecurrencia.fecha_fin = fechaFin;
        }
      }
    }
    
    const numeroCorto = generateShortId();
    const imagen = obtenerUrlImagen(req.file);

    if (!asunto) {
      return res.status(400).json({ error: 'El asunto es requerido' });
    }

    if (fecha_vencimiento && isNaN(fecha_vencimiento.getTime())) {
      return res.status(400).json({ error: 'Fecha de vencimiento invalida' });
    }

    let descripcionRecurrencia = '';
    if (esRecurrente && configRecurrencia) {
      const { tipo, intervalo, solo_dias_habiles } = configRecurrencia;
      const tipoTexto = { diaria: 'dia(s)', semanal: 'semana(s)', mensual: 'mes(es)', anual: 'anio(s)' };
      descripcionRecurrencia = '\nRecurrencia: Cada ' + intervalo + ' ' + tipoTexto[tipo];
      if (solo_dias_habiles) descripcionRecurrencia += ' (solo dias habiles)';
      if (tipo === 'semanal' && configRecurrencia.dias_semana) {
        const nombresDias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const dias = configRecurrencia.dias_semana.map(d => nombresDias[d]).join(', ');
        descripcionRecurrencia += ' - Dias: ' + dias;
      }
    }

    let asignadosIniciales = [];
    if (req.body?.usuarios_asignados) {
      try {
        asignadosIniciales = JSON.parse(req.body.usuarios_asignados);
      } catch (e) {}
    }

    const ticket = new Ticket({
      usuario_id: req.user.id,
      asunto,
      descripcion,
      numero_ticket: numeroCorto,
      prioridad: 'media',
      estado: ESTADOS_VALIDOS.PENDIENTE,
      imagen: imagen || null,
      fecha_vencimiento,
      es_recurrente: esRecurrente,
      recurrencia: configRecurrencia,
      asignados: asignadosIniciales,
      historial: [{
        fecha: new Date(),
        estado: ESTADOS_VALIDOS.PENDIENTE,
        comentario: 'Tarea creada.' + descripcionRecurrencia + '\nAsunto: ' + asunto + '\nDescripcion: ' + descripcion + (fecha_vencimiento ? '\nFecha vencimiento: ' + fecha_vencimiento.toLocaleString() : ''),
        autor: req.user.email
      }],
      leidoPor: [{ usuario: req.user.email, fecha: new Date() }]
    });

    await ticket.save();
    await ticket.populate('usuario_id', 'email');
    await ticket.populate('asignados', 'email nombre');

    ticket.APP_URL = resolveAppUrlFromReq(req);
    ticket.ultimo_autor = req.user.email;

    const destinatarios = await getDestinatariosNotificacion(ticket, req.user.email, 'crear');
    
    if (destinatarios.length) {
      await enviarCorreoTicket(ticket, destinatarios, imagen, 'crear');
    }

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Error al crear tarea:', err.message);
    res.status(500).json({ error: 'Error al crear tarea', detalle: err.message });
  }
};

/* ==================== AGREGAR COMENTARIO ==================== */
exports.agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID invalido' });
    }

    const comentario = (req.body?.comentario || '').toString();
    const imagen = obtenerUrlImagen(req.file);

    if (!comentario && !imagen) {
      return res.status(400).json({ mensaje: 'Comentario o imagen requerido' });
    }
    
    const base = await Ticket.findById(id)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email nombre');
    
    if (!base) return res.status(404).json({ mensaje: 'Tarea no encontrada' });

    const histEntry = {
      fecha: new Date(),
      estado: base.estado,
      comentario,
      autor: req.user.email,
      imagen
    };
    
    const updated = await Ticket.findOneAndUpdate(
      { _id: id },
      {
        $push: { historial: histEntry },
        $pull: { leidoPor: { usuario: req.user.email } },
        $set: { fecha_actualizacion: new Date() }
      },
      { new: true }
    ).populate('usuario_id', 'email')
     .populate('asignados', 'email nombre');

    if (!updated) return res.status(404).json({ mensaje: 'Tarea no encontrada' });

    updated.APP_URL = resolveAppUrlFromReq(req);
    updated.ultimo_autor = req.user.email;

    const destinatarios = await getDestinatariosNotificacion(updated, req.user.email, 'comentario');
    
    if (destinatarios.length) {
      await enviarCorreoTicket(updated, destinatarios, imagen, 'comentario');
    }

    res.json(updated);
  } catch (err) {
    console.error('Error al agregar comentario:', err.message);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
};

/* ==================== ACTUALIZAR ESTADO ==================== */
exports.actualizarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    const { id } = req.params;
    const rol = req.user?.rol;

    if (!['admin', 'soporte'].includes(rol)) {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }

    if (!req.user?.email) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID invalido' });
    }

    if (!estado) {
      return res.status(400).json({ mensaje: 'Estado requerido' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada' });
    }

    // Si el estado es final, registrar fecha de cierre
    if (ESTADOS_FINALES.includes(estado)) {
      ticket.fecha_cierre = new Date();
    }

    ticket.estado = estado;
    await ticket.save();

    res.json(ticket);
  } catch (err) {
    console.error('Error al actualizar estado:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

/* ==================== LISTAR TICKETS ==================== */
exports.obtenerTickets = async (req, res) => {
  try {
    const { estado, prioridad } = req.query;
    const userId = req.user.id;
    const isAdmin = ['admin', 'soporte'].includes(req.user.rol);

    let filtro = {};
    
    if (isAdmin) {
      filtro = {};
    } else {
      filtro = {
        $and: [
          { $or: [{ usuario_id: userId }, { asignados: userId }] },
          { estado: { $ne: ESTADOS_VALIDOS.ARCHIVADO } }
        ]
      };
    }
    
    if (estado) filtro.estado = estado;
    if (prioridad) filtro.prioridad = prioridad;

    let tickets = await Ticket.find(filtro)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email nombre')
      .lean();

    tickets.sort((a, b) => {
      const getTs = (t) => {
        const created = t.createdAt || t.fecha_creacion;
        const updated = t.fecha_actualizacion;
        const lastHist = Array.isArray(t.historial) && t.historial.length
          ? t.historial[t.historial.length - 1]?.fecha : null;
        const times = [
          created ? new Date(created).getTime() : 0,
          updated ? new Date(updated).getTime() : 0,
          lastHist ? new Date(lastHist).getTime() : 0,
        ];
        return Math.max(...times.filter(Boolean)) || 0;
      };
      return getTs(b) - getTs(a);
    });

    res.json(tickets);
  } catch (err) {
    console.error('Error al obtener tareas:', err.message);
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
};

/* ==================== OBTENER TICKET POR ID ==================== */
exports.obtenerTicketPorId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const ticket = await Ticket.findById(id)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email nombre');

    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });

    const esAdmin = ['admin', 'soporte'].includes(req.user.rol);
    const esCreador = ticket.usuario_id._id.toString() === req.user.id;
    const esAsignado = ticket.asignados?.some(a => a._id.toString() === req.user.id);

    if (!esAdmin && !esCreador && !esAsignado) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    if (!esAdmin && ticket.estado === ESTADOS_VALIDOS.ARCHIVADO) {
      return res.status(403).json({ error: 'Esta tarea ha sido archivada' });
    }

    res.json(ticket);
  } catch (err) {
    console.error('Error al obtener tarea:', err.message);
    res.status(500).json({ error: 'Error al obtener tarea' });
  }
};

/* ==================== MARCAR LEIDO ==================== */
exports.marcarLeido = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.user.email;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID invalido' });
    }

    let updated = await Ticket.findOneAndUpdate(
      { _id: id, 'leidoPor.usuario': usuario },
      { $set: { 'leidoPor.$.fecha': new Date() } },
      { new: true }
    );
    
    if (!updated) {
      updated = await Ticket.findOneAndUpdate(
        { _id: id },
        { $push: { leidoPor: { usuario, fecha: new Date() } } },
        { new: true }
      );
    }
    
    if (!updated) return res.status(404).json({ mensaje: 'Tarea no encontrada' });
    
    res.json(updated);
  } catch (err) {
    console.error('Error al marcar leido:', err.message);
    res.status(500).json({ error: 'Error al marcar leido' });
  }
};

/* ==================== ELIMINAR TICKET ==================== */
exports.eliminarTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticketEliminado = await Ticket.findByIdAndDelete(id);
    
    if (!ticketEliminado) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada' });
    }
    
    res.json({ mensaje: 'Tarea eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar tarea:', error.message);
    res.status(500).json({ mensaje: 'Error al eliminar la tarea' });
  }
};

/* ==================== GENERAR EVENTO CALENDARIO (.ICS) ==================== */
exports.generarEventoCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID invalido' });
    }

    const ticket = await Ticket.findById(id).select('asunto descripcion fecha_vencimiento numero_ticket');
    
    if (!ticket || !ticket.fecha_vencimiento) {
      return res.status(404).json({ mensaje: 'Tarea sin fecha de vencimiento.' });
    }

    const start = ticket.fecha_vencimiento;
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    const cal = ical({ name: 'Ticket #' + ticket.numero_ticket, timezone: 'America/Buenos_Aires' });
    const appUrl = resolveAppUrlFromReq(req);

    cal.createEvent({
      start, end,
      summary: '[TICKET #' + ticket.numero_ticket + '] ' + ticket.asunto,
      description: 'Vencimiento del ticket.\n\nDescripcion:\n' + ticket.descripcion + '\n\nAcceso rapido: ' + appUrl + '/tickets/' + ticket._id,
      url: appUrl + '/tickets/' + ticket._id,
      uid: 'ticket-' + ticket.numero_ticket + '@portfolioinvestment.com.ar'
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ticket-' + ticket.numero_ticket + '.ics"');
    cal.stream(res);
  } catch (err) {
    console.error('Error al generar evento calendar:', err.message);
    res.status(500).json({ error: 'Error al generar evento de calendario' });
  }
};

/* ==================== SCHEDULER: NOTIFICACIONES DE VENCIMIENTO ==================== */
exports.revisarTicketsProximosAVencer = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(today.getDate() + 1);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const filtro = {
      estado: { $nin: ESTADOS_FINALES },
      fecha_vencimiento: { $exists: true, $ne: null },
      $or: [
        {
          fecha_vencimiento: { $lte: threeDaysFromNow, $gte: oneDayFromNow },
          $or: [
            { last_vencimiento_notification: { $exists: false } },
            { last_vencimiento_notification: { $lt: threeDaysAgo } }
          ]
        },
        {
          fecha_vencimiento: { $lt: today },
          last_vencimiento_notification: { $lt: threeDaysAgo }
        }
      ]
    };
    
    const tickets = await Ticket.find(filtro)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email')
      .select('numero_ticket asunto fecha_vencimiento usuario_id asignados');

    if (tickets.length === 0) return;

    for (const ticket of tickets) {
      const destinatarios = await getDestinatariosNotificacion(ticket, null, 'estado');
      const isOverdue = ticket.fecha_vencimiento < new Date();
      const tipo = isOverdue ? 'vencido_recordatorio' : 'proximo_recordatorio';

      if (destinatarios.length > 0) {
        ticket.APP_URL = process.env.APP_URL || 'URL_BASE_DE_LA_APP';
        await enviarCorreoTicket(ticket, destinatarios, null, tipo);
        await Ticket.findOneAndUpdate(
          { _id: ticket._id },
          { $set: { last_vencimiento_notification: new Date() } }
        );
      }
    }
  } catch (err) {
    console.error('Error en revision de tickets:', err.message);
  }
};

/* ==================== GENERAR TICKETS RECURRENTES ==================== */
exports.generarTicketsRecurrentes = async () => {
  try {
    const ahora = new Date();
    const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
    
    const ticketsRecurrentes = await Ticket.find({
      es_recurrente: true,
      'recurrencia.activa': true,
      'recurrencia.ticket_padre': null,
      estado: { $nin: [ESTADOS_VALIDOS.ARCHIVADO, ESTADOS_VALIDOS.CANCELADO] },
      $or: [
        { 'recurrencia.fecha_fin': { $exists: false } },
        { 'recurrencia.fecha_fin': null },
        { 'recurrencia.fecha_fin': { $gt: ahora } }
      ]
    }).populate('usuario_id', 'email').populate('asignados', 'email');
    
    let generados = 0;
    
    for (const ticket of ticketsRecurrentes) {
      try {
        const fechaBase = ticket.recurrencia.ultima_generacion || ticket.recurrencia.fecha_inicio || ticket.fecha_vencimiento || ticket.fecha_creacion;
        const proximaFecha = calcularProximaFecha(fechaBase, ticket.recurrencia);
        
        if (proximaFecha && proximaFecha >= inicioDia && proximaFecha <= finDia) {
          const yaExiste = await Ticket.findOne({
            'recurrencia.ticket_padre': ticket._id,
            fecha_vencimiento: { $gte: inicioDia, $lt: finDia }
          });
          
          if (!yaExiste) {
            const nuevoTicket = new Ticket({
              usuario_id: ticket.usuario_id._id || ticket.usuario_id,
              asunto: ticket.asunto,
              descripcion: ticket.descripcion,
              numero_ticket: generateShortId(),
              prioridad: ticket.prioridad,
              estado: ESTADOS_VALIDOS.PENDIENTE,
              fecha_vencimiento: proximaFecha,
              imagen: ticket.imagen,
              es_recurrente: false,
              recurrencia: { ticket_padre: ticket._id, activa: false },
              asignados: ticket.asignados || [],
              historial: [{
                fecha: new Date(),
                estado: ESTADOS_VALIDOS.PENDIENTE,
                comentario: 'Tarea generada automaticamente por recurrencia desde Ticket #' + ticket.numero_ticket,
                autor: 'sistema'
              }],
              leidoPor: []
            });
            
            await nuevoTicket.save();
            await Ticket.findByIdAndUpdate(ticket._id, {
              $set: { 'recurrencia.ultima_generacion': ahora, fecha_actualizacion: new Date() }
            });
            
            generados++;
            
            try {
              const appUrl = process.env.APP_URL || 'http://localhost:3000';
              nuevoTicket.APP_URL = appUrl;
              const destinatarios = await getDestinatariosNotificacion(ticket, null, 'estado');
              if (destinatarios.length) {
                await enviarCorreoTicket(nuevoTicket, destinatarios, null, 'tarea_recurrente');
              }
            } catch (mailError) {
              console.error('Error enviando email de recurrencia:', mailError.message);
            }
          }
        }
      } catch (innerError) {
        console.error('Error procesando ticket recurrente #' + ticket.numero_ticket + ':', innerError.message);
      }
    }
    
    return { generados, revisados: ticketsRecurrentes.length };
  } catch (error) {
    console.error('Error en generacion de tickets recurrentes:', error.message);
    throw error;
  }
};

/* ==================== ACTUALIZAR CONFIGURACION DE RECURRENCIA ==================== */
exports.actualizarRecurrencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa, tipo, intervalo, solo_dias_habiles, dias_semana, dia_mes, fecha_fin } = req.body;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }
    
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    const esAdmin = ['admin', 'soporte'].includes(req.user.rol);
    const esCreador = ticket.usuario_id.toString() === req.user.id;
    
    if (!esAdmin && !esCreador) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const updateOps = { es_recurrente: true };
    
    if (activa !== undefined) {
      updateOps['recurrencia.activa'] = activa === true || activa === 'true';
    }
    
    if (tipo && TIPOS_RECURRENCIA.includes(tipo)) {
      updateOps['recurrencia.tipo'] = tipo;
    }
    
    if (intervalo) {
      updateOps['recurrencia.intervalo'] = parseInt(intervalo);
    }
    
    if (solo_dias_habiles !== undefined) {
      updateOps['recurrencia.solo_dias_habiles'] = solo_dias_habiles === true || solo_dias_habiles === 'true';
    }
    
    if (dias_semana) {
      try {
        const dias = typeof dias_semana === 'string' ? JSON.parse(dias_semana) : dias_semana;
        if (!Array.isArray(dias) || !dias.every(d => [0, 1, 2, 3, 4, 5, 6].includes(d))) {
          return res.status(400).json({ error: 'Dias de semana invalidos' });
        }
        updateOps['recurrencia.dias_semana'] = dias;
      } catch (e) {
        return res.status(400).json({ error: 'Formato invalido para dias de semana' });
      }
    }
    
    if (dia_mes) {
      const dia = parseInt(dia_mes);
      if (dia < 1 || dia > 31) {
        return res.status(400).json({ error: 'Dia del mes invalido' });
      }
      updateOps['recurrencia.dia_mes'] = dia;
    }
    
    if (fecha_fin) {
      const ff = new Date(fecha_fin);
      if (isNaN(ff.getTime())) {
        return res.status(400).json({ error: 'Fecha fin invalida' });
      }
      updateOps['recurrencia.fecha_fin'] = ff;
    }
    
    if (Object.keys(updateOps).length === 0) {
      return res.status(400).json({ error: 'No se especificaron cambios' });
    }
    
    updateOps.fecha_actualizacion = new Date();
    const updated = await Ticket.findByIdAndUpdate(id, { $set: updateOps }, { new: true });
    
    updated.historial.push({
      fecha: new Date(),
      estado: updated.estado,
      comentario: 'Configuracion de recurrencia actualizada por ' + req.user.email,
      autor: req.user.email
    });
    await updated.save();
    
    res.json({ success: true, message: 'Configuracion de recurrencia actualizada', ticket: updated });
  } catch (error) {
    console.error('Error al actualizar recurrencia:', error.message);
    res.status(500).json({ error: 'Error al actualizar recurrencia' });
  }
};

/* ==================== ASIGNACION DE USUARIOS ==================== */
exports.obtenerAsignados = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('asignados', 'email nombre rol');
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(ticket.asignados || []);
  } catch (error) {
    console.error('Error al obtener asignados:', error.message);
    res.status(500).json({ error: 'Error al obtener asignados' });
  }
};

exports.asignarUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const ticket = await Ticket.findById(req.params.id)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email nombre');
    
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    const usuario = await User.findById(usuarioId);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (!ticket.asignados) ticket.asignados = [];
    
    if (ticket.asignados.some(a => (a._id || a).toString() === usuarioId)) {
      return res.status(400).json({ error: 'El usuario ya esta asignado' });
    }
    
    ticket.asignados.push(usuarioId);
    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado,
      comentario: 'Usuario ' + usuario.email + ' asignado a la tarea por ' + req.user.email,
      autor: req.user.email
    });
    await ticket.save();

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    ticket.APP_URL = appUrl;
    ticket.ultimo_autor = req.user.email;
    
    const destinatarios = await getDestinatariosNotificacion(ticket, req.user.email, 'asignacion');
    if (destinatarios.length) {
      await enviarCorreoTicket(ticket.toObject(), destinatarios, null, 'asignacion_usuario');
    }
    
    res.json({ success: true, message: 'Usuario ' + usuario.email + ' asignado correctamente' });
  } catch (error) {
    console.error('Error al asignar usuario:', error.message);
    res.status(500).json({ error: 'Error al asignar usuario' });
  }
};

exports.desasignarUsuario = async (req, res) => {
  try {
    const { id, usuarioId } = req.params;
    const ticket = await Ticket.findById(id)
      .populate('usuario_id', 'email')
      .populate('asignados', 'email nombre');
    
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    const usuario = await User.findById(usuarioId);
    
    ticket.asignados = (ticket.asignados || []).filter(a => (a._id || a).toString() !== usuarioId);
    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado,
      comentario: 'Usuario ' + (usuario?.email || usuarioId) + ' desasignado de la tarea por ' + req.user.email,
      autor: req.user.email
    });
    await ticket.save();

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    ticket.APP_URL = appUrl;
    ticket.ultimo_autor = req.user.email;
    
    const destinatarios = await getDestinatariosNotificacion(ticket, req.user.email, 'desasignacion');
    if (destinatarios.length) {
      await enviarCorreoTicket(ticket.toObject(), destinatarios, null, 'desasignacion_usuario');
    }
    
    res.json({ success: true, message: 'Usuario desasignado correctamente' });
  } catch (error) {
    console.error('Error al desasignar usuario:', error.message);
    res.status(500).json({ error: 'Error al desasignar usuario' });
  }
};

/* ==================== OBTENER USUARIOS DISPONIBLES ==================== */
exports.obtenerUsuariosDisponibles = async (req, res) => {
  try {
    const esAdmin = ['admin', 'soporte'].includes(req.user.rol);
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const usuarios = await User.find({ activo: true }, 'email nombre rol');
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};