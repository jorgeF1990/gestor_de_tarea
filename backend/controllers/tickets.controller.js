// backend/controllers/tickets.controller.js
const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const { enviarCorreoTicket } = require('../utils/mailer');

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const resolveAppUrlFromReq = (req) => {
  // Si APP_URL del .env es distinta del FE local, úsala; sino usa la del request (útil en dev)
  const envUrl = process.env.APP_URL && process.env.APP_URL !== 'http://localhost:3000'
    ? process.env.APP_URL
    : null;
  const reqUrl = `${req.protocol}://${req.get('host')}`; // ej. http://localhost:5001
  return (envUrl || reqUrl).replace(/\/$/, '');
};

/* CREAR TICKET */
exports.crearTicket = async (req, res) => {
  try {
    const asunto = (req.body?.asunto || '').toString().trim();
    const descripcion = (req.body?.descripcion || '').toString();
    const imagen = req.file?.filename || null;
    const numeroCorto = Math.floor(1000 + Math.random() * 9000).toString();

    if (!asunto) {
      return res.status(400).json({ error: 'El asunto es requerido' });
    }

    const ticket = new Ticket({
      usuario_id: req.user.id,
      asunto,
      descripcion,
      numero_ticket: numeroCorto,
      prioridad: 'media',
      estado: 'pendiente',
      imagen,
      historial: [{
        fecha: new Date(),
        estado: 'pendiente',
        comentario: `Ticket creado.\nAsunto: ${asunto}\nDescripción: ${descripcion}`,
        autor: req.user.email
      }],
      leidoPor: [{ usuario: req.user.email, fecha: new Date() }]
    });

    await ticket.save();
    await ticket.populate('usuario_id', 'email');

    // Para mailer
    ticket.APP_URL = resolveAppUrlFromReq(req);
    ticket.ultimo_autor = req.user.email;

    // Destinatarios: dueño del ticket + casilla de soporte; nunca el autor
    let destinatarios = [ticket.usuario_id?.email, 'envios@portfolioinvestment.com.ar'];
    destinatarios = uniq(destinatarios).filter(e => e && e !== req.user.email);

    const imagenPath = imagen ? `uploads/${imagen}` : null;
    await enviarCorreoTicket(ticket, destinatarios, imagenPath, 'crear');

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Error al crear ticket:', err);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

/* AGREGAR COMENTARIO (ATÓMICO) */
exports.agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID inválido' });
    }

    const comentario = (req.body?.comentario || '').toString();
    const imagen = req.file?.filename || null;

    if (!comentario && !imagen) {
      return res.status(400).json({ mensaje: 'Comentario o imagen requerido' });
    }

    // Traer doc base (solo para datos del mail y estado actual)
    const base = await Ticket.findById(id).populate('usuario_id', 'email');
    if (!base) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    const histEntry = {
      fecha: new Date(),
      estado: base.estado,
      comentario,
      autor: req.user.email,
      imagen
    };

    // Update atómico: push historial + marcar como no leído para otros
    const updated = await Ticket.findOneAndUpdate(
      { _id: id },
      {
        $push: { historial: histEntry },
        $pull: { leidoPor: { usuario: req.user.email } },
        $set: { fecha_actualizacion: new Date() }
      },
      { new: true }
    ).populate('usuario_id', 'email');

    if (!updated) return res.status(404).json({ mensaje: 'Ticket no encontrado tras update' });

    // Para mailer
    updated.APP_URL = resolveAppUrlFromReq(req);
    updated.ultimo_autor = req.user.email;

    // Notificar SOLO a la contraparte
    const cliente = updated.usuario_id?.email;
    const autor = req.user.email;
    const esAutorCliente = cliente && autor === cliente;

    let destinatarios = esAutorCliente ? ['envios@portfolioinvestment.com.ar'] : [cliente];
    destinatarios = uniq(destinatarios).filter(e => e && e !== autor);

    const imagenPath = imagen ? `uploads/${imagen}` : null;
    if (destinatarios.length) {
      await enviarCorreoTicket(updated, destinatarios, imagenPath, 'comentario');
    }

    res.json(updated);
  } catch (err) {
    console.error('Error al agregar comentario (atomic):', err);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
};

/*ACTUALIZAR ESTADO/PRIORIDAD (ATÓMICO)*/
exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, prioridad, comentario } = req.body;
    const { id } = req.params;
    const rol = req.user?.rol;
    
    if (!['admin','soporte'].includes(rol)) {
      return res.status(403).json({ mensaje: 'No autorizado para cambiar estado o prioridad' });
    }

    if (!req.user?.email) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID inválido' });
    }

    // Doc actual para comparar y para datos de correo
    const actual = await Ticket.findById(id).populate('usuario_id', 'email');
    if (!actual) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    const cambios = [];
    const updateOps = {};
    const setOps = {};
    const pushOps = {};

    // Cambios de estado/prioridad
    if (estado && estado !== actual.estado) {
      setOps.estado = estado;
      cambios.push(`Estado: ${actual.estado} → ${estado}`);
    }
    if (prioridad && prioridad !== actual.prioridad) {
      setOps.prioridad = prioridad;
      cambios.push(`Prioridad: ${actual.prioridad} → ${prioridad}`);
    }

    // Comentario explícito o comentario automático por cambios
    if (comentario) {
      pushOps.historial = {
        fecha: new Date(),
        estado: estado || actual.estado,
        comentario: comentario.toString(),
        autor: req.user.email
      };
    } else if (cambios.length) {
      pushOps.historial = {
        fecha: new Date(),
        estado: estado || actual.estado,
        comentario: `Actualizaciones: ${cambios.join('; ')}`,
        autor: req.user.email
      };
    }

    if (!Object.keys(setOps).length && !Object.keys(pushOps).length) {
      return res.status(200).json({ mensaje: 'Sin cambios', ticket: actual });
    }

    // Marcar como no leído para el resto
    const pullOps = { leidoPor: { usuario: req.user.email } };

    updateOps.$set = { ...setOps, fecha_actualizacion: new Date(), actualizador: req.user.email };
    if (pushOps.historial) updateOps.$push = { historial: pushOps.historial };
    updateOps.$pull = pullOps;

    const updated = await Ticket.findOneAndUpdate(
      { _id: id },
      updateOps,
      { new: true }
    ).populate('usuario_id', 'email');

    if (!updated) return res.status(404).json({ mensaje: 'Ticket no encontrado tras update' });

    // Para mailer
    updated.APP_URL = resolveAppUrlFromReq(req);
    updated.ultimo_autor = req.user.email;

    // Notificar a contraparte
    const cliente = updated.usuario_id?.email;
    const autor = req.user.email;
    const esAutorCliente = cliente && autor === cliente;

    let destinatarios = esAutorCliente ? ['envios@portfolioinvestment.com.ar'] : [cliente];
    destinatarios = uniq(destinatarios).filter(e => e && e !== autor);

    if (destinatarios.length) {
      try {
        await enviarCorreoTicket(updated, destinatarios, null, 'estado');
      } catch (correoError) {
        console.error('Error al enviar correo de actualización:', correoError?.message || correoError);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Error al actualizar ticket (atomic):', err);
    res.status(500).json({ error: 'Error al actualizar ticket', detalle: err.message });
  }
};

/* LISTAR TICKETS */
exports.obtenerTickets = async (req, res) => {
  try {
    const { estado, prioridad } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.rol === 'admin' || req.user.rol === 'soporte';

    const filtro = isAdmin ? {} : { usuario_id: userId };
    if (estado) filtro.estado = estado;
    if (prioridad) filtro.prioridad = prioridad;

    const tickets = await Ticket.find(filtro)
      .populate('usuario_id', 'email')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    console.error('Error al obtener tickets:', err.message);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

/* MARCAR LEÍDO (ATÓMICO)*/
exports.marcarLeido = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.user.email;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ mensaje: 'ID inválido' });
    }

    // 1) Intentar actualizar la fecha de un leidoPor existente
    let updated = await Ticket.findOneAndUpdate(
      { _id: id, 'leidoPor.usuario': usuario },
      { $set: { 'leidoPor.$.fecha': new Date() } },
      { new: true }
    );

    // 2) Si no existía, empujar una nueva entrada
    if (!updated) {
      updated = await Ticket.findOneAndUpdate(
        { _id: id },
        { $push: { leidoPor: { usuario, fecha: new Date() } } },
        { new: true }
      );
    }

    if (!updated) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    res.json(updated);
  } catch (err) {
    console.error('Error al marcar ticket como leído:', err.message);
    res.status(500).json({ error: 'Error al marcar ticket como leído' });
  }
};
