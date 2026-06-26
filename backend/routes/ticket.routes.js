// backend/routes/ticket.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const rootPath = require('app-root-path');

const auth = require(`${rootPath.path}/backend/middlewares/auth`);

const {
  crearTicket,
  agregarComentario,
  actualizarEstado,
  obtenerTickets,
  obtenerTicketPorId,
  marcarLeido,
  eliminarTicket,
  generarEventoCalendar,
  obtenerAsignados,
  asignarUsuario,
  desasignarUsuario,
  obtenerUsuariosDisponibles,
  actualizarRecurrencia
} = require('../controllers/tickets.controller');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfuybsomz',
  api_key: process.env.CLOUDINARY_API_KEY || '99688937873469',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tickets',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

const fileFilter = (_req, file, cb) => {
  if (/^image\//i.test(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'), false);
};

const upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/', auth, upload.single('imagen'), crearTicket);
router.get('/', auth, obtenerTickets);
router.get('/:id', auth, obtenerTicketPorId);
router.put('/:id/estado', auth, actualizarEstado);
router.put('/:id/comentario', auth, upload.single('imagen'), agregarComentario);
router.put('/:id/leido', auth, marcarLeido);
router.delete('/:id', auth, eliminarTicket);
router.get('/:id/calendar', auth, generarEventoCalendar);

router.put('/:id/recurrencia', auth, actualizarRecurrencia);

router.get('/:id/recurrencia', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const ticket = await Ticket.findById(req.params.id)
      .select('es_recurrente recurrencia numero_ticket');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    res.json({
      es_recurrente: ticket.es_recurrente,
      recurrencia: ticket.recurrencia,
      numero_ticket: ticket.numero_ticket
    });
  } catch (error) {
    console.error('Error al obtener recurrencia:', error.message);
    res.status(500).json({ error: 'Error al obtener configuracion' });
  }
});

router.post('/:id/silenciar', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    const { dias } = req.body;
    
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const esPropietario = ticket.usuario_id.toString() === req.user.id;
    const esAdmin = req.user.rol === 'admin';
    
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const silenciarHasta = new Date();
    const diasASilenciar = dias || 30;
    silenciarHasta.setDate(silenciarHasta.getDate() + diasASilenciar);
    
    await Ticket.findByIdAndUpdate(id, {
      $set: {
        silenciar_notificaciones_hasta: silenciarHasta,
        notificaciones_habilitadas: false
      }
    }, { runValidators: false });
    
    res.json({ 
      success: true, 
      message: `Notificaciones silenciadas hasta ${silenciarHasta.toLocaleDateString()}` 
    });
  } catch (error) {
    console.error('Error al silenciar notificaciones:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.post('/:id/reanudar', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const esPropietario = ticket.usuario_id.toString() === req.user.id;
    const esAdmin = req.user.rol === 'admin';
    
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    await Ticket.findByIdAndUpdate(id, {
      $set: {
        silenciar_notificaciones_hasta: null,
        notificaciones_habilitadas: true
      }
    }, { runValidators: false });
    
    res.json({ success: true, message: 'Notificaciones reanudadas' });
  } catch (error) {
    console.error('Error al reanudar notificaciones:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.get('/:id/notificaciones/estado', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id)
      .select('silenciar_notificaciones_hasta notificaciones_habilitadas ultimo_recordatorio_enviado');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const ahora = new Date();
    const silenciado = ticket.silenciar_notificaciones_hasta && 
                       new Date(ticket.silenciar_notificaciones_hasta) > ahora;
    
    res.json({
      habilitadas: ticket.notificaciones_habilitadas && !silenciado,
      silenciadoHasta: ticket.silenciar_notificaciones_hasta,
      ultimoRecordatorio: ticket.ultimo_recordatorio_enviado
    });
  } catch (error) {
    console.error('Error al obtener estado:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.get('/:id/asignados', auth, obtenerAsignados);
router.post('/:id/asignar', auth, asignarUsuario);
router.delete('/:id/asignar/:usuarioId', auth, desasignarUsuario);
router.get('/usuarios/disponibles', auth, obtenerUsuariosDisponibles);

module.exports = router;