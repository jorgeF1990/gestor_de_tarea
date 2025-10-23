const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const { enviarCorreoTicket } = require('../utils/mailer');

const resolveAppUrlFromReq = (req) => {
  const envUrl = process.env.APP_URL && process.env.APP_URL !== 'http://localhost:3000' ? process.env.APP_URL : null;
  const reqUrl = `${req.protocol}://${req.get('host')}`; // ej. http://localhost:5001
  return (envUrl || reqUrl).replace(/\/$/, '');
};

exports.crearTicket = async (req, res) => {
  try {
    const { asunto, descripcion } = req.body;
    const imagen = req.file?.filename || null;
    const numeroCorto = Math.floor(1000 + Math.random() * 9000).toString();

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

    // Propiedades auxiliares para el correo
    ticket.fecha = new Date(ticket.createdAt).toLocaleDateString('es-AR');
    ticket.hora_creacion = new Date(ticket.createdAt).toLocaleTimeString('es-AR');
    ticket.ultimo_autor = ticket.usuario_id?.email || req.user.email;

    // Asegurar APP_URL correcto (backend) para que el mailer genere URLs accesibles
    ticket.APP_URL = resolveAppUrlFromReq(req);

    const imagenPath = imagen ? `uploads/${imagen}` : null;
    const destinatarios = [ticket.usuario_id.email, 'envios@portfolioinvestment.com.ar'];

    await enviarCorreoTicket(ticket, destinatarios, imagenPath, 'crear');

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Error al crear ticket:', err.message);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

exports.agregarComentario = async (req, res) => {
  try {
    const { comentario } = req.body;
    const imagen = req.file?.filename || null;

    if (!comentario && !imagen) {
      return res.status(400).json({ mensaje: 'Comentario o imagen requerido' });
    }

    const ticket = await Ticket.findById(req.params.id).populate('usuario_id', 'email');
    if (!ticket) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    // Agregar comentario al historial
    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado,
      comentario,
      autor: req.user.email,
      imagen
    });

    // Marcar como no leído para los demás
    if (Array.isArray(ticket.leidoPor)) {
      ticket.leidoPor = ticket.leidoPor.filter(l => l.usuario !== req.user.email);
    }

    await ticket.save();
    await ticket.populate('usuario_id', 'email');

    // Propiedades auxiliares para el correo
    ticket.fecha = new Date().toLocaleDateString('es-AR');
    ticket.hora_creacion = new Date().toLocaleTimeString('es-AR');
    ticket.ultimo_autor = req.user.email;

    // Asegurar APP_URL correcto
    ticket.APP_URL = resolveAppUrlFromReq(req);

    const imagenPath = imagen ? `uploads/${imagen}` : null;
    const destinatarios = [
      ticket.usuario_id.email,
      req.user.id.toString() === ticket.usuario_id._id.toString()
        ? 'envios@portfolioinvestment.com.ar'
        : req.user.email
    ];

    await enviarCorreoTicket(ticket, destinatarios, imagenPath, 'comentario');

    res.json(ticket);
  } catch (err) {
    console.error('Error al agregar comentario:', err.message);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, prioridad, comentario } = req.body;
    const { id } = req.params;

    if (!req.user || !req.user.email) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const ticket = await Ticket.findById(id).populate('usuario_id', 'email');
    if (!ticket) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    let huboCambio = false;
    const cambios = [];

    if (estado && estado !== ticket.estado) {
      const prev = ticket.estado;
      ticket.estado = estado;
      huboCambio = true;
      cambios.push(`Estado: ${prev} → ${estado}`);
    }

    if (prioridad && prioridad !== ticket.prioridad) {
      const prev = ticket.prioridad;
      ticket.prioridad = prioridad;
      huboCambio = true;
      cambios.push(`Prioridad: ${prev} → ${prioridad}`);
    }

    if (comentario) {
      ticket.historial.push({
        fecha: new Date(),
        estado: ticket.estado,
        comentario,
        autor: req.user.email
      });
      huboCambio = true;
    }

    if (huboCambio && !comentario) {
      ticket.historial.push({
        fecha: new Date(),
        estado: ticket.estado,
        comentario: cambios.length ? `Actualizaciones: ${cambios.join('; ')}` : 'Actualización de estado/prioridad',
        autor: req.user.email
      });
    }

    if (!huboCambio) {
      return res.status(200).json({ mensaje: 'No hubo cambios en estado, prioridad ni comentario', ticket });
    }

    // Marcar como no leído para los demás
    if (Array.isArray(ticket.leidoPor)) {
      ticket.leidoPor = ticket.leidoPor.filter(l => l.usuario !== req.user.email);
    }

    ticket.actualizador = req.user.email;
    await ticket.save();
    await ticket.populate('usuario_id', 'email');

    // Propiedades auxiliares para el correo
    ticket.fecha = new Date().toLocaleDateString('es-AR');
    ticket.hora_creacion = new Date().toLocaleTimeString('es-AR');
    ticket.ultimo_autor = req.user.email;

    // Asegurar APP_URL correcto
    ticket.APP_URL = resolveAppUrlFromReq(req);

    const destinatarios = [ticket.usuario_id.email, 'envios@portfolioinvestment.com.ar'];

    try {
      await enviarCorreoTicket(ticket, destinatarios, null, 'estado');
    } catch (correoError) {
      console.error('Error al enviar correo de actualización:', correoError.message);
    }

    res.json(ticket);
  } catch (err) {
    console.error('Error al actualizar ticket:', err);
    res.status(500).json({ error: 'Error al actualizar ticket', detalle: err.message });
  }
};

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
      .sort({ fecha_creacion: -1 });

    res.json(tickets);
  } catch (err) {
    console.error('Error al obtener tickets:', err.message);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

exports.marcarLeido = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.user.email;

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    const existente = ticket.leidoPor.find(l => l.usuario === usuario);
    if (existente) {
      existente.fecha = new Date();
    } else {
      ticket.leidoPor.push({ usuario, fecha: new Date() });
    }

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    console.error('Error al marcar ticket como leído:', err.message);
    res.status(500).json({ error: 'Error al marcar ticket como leído' });
  }
};