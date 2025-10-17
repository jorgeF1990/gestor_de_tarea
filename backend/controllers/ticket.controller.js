const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  }
});

// Función para enviar notificación
async function enviarNotificacion(email, asunto, mensaje) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: asunto,
      text: mensaje
    });
  } catch (err) {
    console.error('Error al enviar correo:', err.message);
  }
}

// Crear ticket
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
        comentario: `Ticket creado.\nAsunto: ${asunto}\nDescripción: ${descripcion}` 
      }]
    });

    await ticket.save();

    const usuario = await User.findById(req.user.id);
    await enviarNotificacion(
      usuario.email,
      'Ticket generado',
      `Tu ticket fue creado con número: ${ticket.numero_ticket}\nEstado: ${ticket.estado}`
    );

    res.status(201).json({
      mensaje: 'Ticket creado',
      ticket: {
        _id: ticket._id,
        numero_ticket: ticket.numero_ticket,
        asunto: ticket.asunto,
        descripcion: ticket.descripcion,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        correo: usuario.email,
        fecha_creacion: ticket.fecha_creacion,
        imagen: ticket.imagen
      }
    });
  } catch (err) {
    console.error('Error al crear ticket:', err.message);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

// Actualizar estado, prioridad o agregar comentario
exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, prioridad, comentario } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    if (estado) ticket.estado = estado;
    if (prioridad) ticket.prioridad = prioridad;

    if (comentario) {
      ticket.historial.push({
        fecha: new Date(),
        estado: estado || ticket.estado,
        comentario: `${comentario} (${req.user.rol === 'admin' ? 'admin' : req.user.email})`
      });
    }

    await ticket.save();

    const usuario = await User.findById(ticket.usuario_id);
    await enviarNotificacion(
      usuario.email,
      'Actualización de ticket',
      `Tu ticket con número: ${ticket.numero_ticket} ha sido actualizado.\nNuevo estado: ${ticket.estado}\nNueva prioridad: ${ticket.prioridad}\nComentario: ${comentario || 'Sin comentario'}`
    );

    res.json({
      mensaje: 'Ticket actualizado',
      ticket: {
        _id: ticket._id,
        numero_ticket: ticket.numero_ticket,
        asunto: ticket.asunto,
        descripcion: ticket.descripcion,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        historial: ticket.historial,
        correo: usuario.email,
        fecha_creacion: ticket.fecha_creacion
      }
    });
  } catch (err) {
    console.error('Error al actualizar ticket:', err.message);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
};

// Obtener tickets
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

    res.json(tickets.map(ticket => ({
      _id: ticket._id,
      numero_ticket: ticket.numero_ticket,
      asunto: ticket.asunto,
      descripcion: ticket.descripcion,
      estado: ticket.estado,
      prioridad: ticket.prioridad,
      historial: ticket.historial,
      correo: ticket.usuario_id.email,
      fecha_creacion: ticket.fecha_creacion,
      imagen: ticket.imagen
    })));
  } catch (err) {
    console.error('Error al obtener tickets:', err.message);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};