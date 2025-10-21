const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  }
});

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

    const usuario = await User.findById(req.user.id);
    await enviarNotificacion(
      usuario.email,
      'Ticket generado',
      `Tu ticket fue creado con número: ${ticket.numero_ticket}\nEstado: ${ticket.estado}`
    );

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

    ticket.historial.push({
      fecha: new Date(),
      estado: ticket.estado,
      comentario,
      autor: req.user.email,
      imagen
    });

    ticket.leidoPor = ticket.leidoPor.filter(l => l.usuario === req.user.email);

    await ticket.save();

    let destinatario;
    if (req.user.id.toString() === ticket.usuario_id._id.toString()) {
      destinatario = process.env.SOPORTE_EMAIL;
    } else {
      destinatario = ticket.usuario_id.email;
    }

    if (destinatario) {
      await enviarNotificacion(
        destinatario,
        'Nuevo comentario en ticket',
        `El ticket #${ticket.numero_ticket} tiene un nuevo comentario de ${req.user.email}: ${comentario || 'Imagen adjunta'}`
      );
    }

    res.json(ticket);
  } catch (err) {
    console.error('Error al agregar comentario:', err.message);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    const { estado, prioridad, comentario } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate('usuario_id', 'email');
    if (!ticket) return res.status(404).json({ mensaje: 'Ticket no encontrado' });

    if (estado) ticket.estado = estado;
    if (prioridad) ticket.prioridad = prioridad;

    if (comentario) {
      ticket.historial.push({
        fecha: new Date(),
        estado: estado || ticket.estado,
        comentario,
        autor: req.user.email
      });
      ticket.leidoPor = ticket.leidoPor.filter(l => l.usuario === req.user.email);
    }

    await ticket.save();

    const usuario = await User.findById(ticket.usuario_id);
    await enviarNotificacion(
      usuario.email,
      'Actualización de ticket',
      `Tu ticket con número: ${ticket.numero_ticket} ha sido actualizado.\nNuevo estado: ${ticket.estado}\nNueva prioridad: ${ticket.prioridad}\nComentario: ${comentario || 'Sin comentario'}`
    );

    res.json(ticket);
  } catch (err) {
    console.error('Error al actualizar ticket:', err.message);
    res.status(500).json({ error: 'Error al actualizar ticket' });
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