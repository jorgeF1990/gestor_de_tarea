// backend/routes/ticket.routes.js
const express = require('express');
const path = require('path');
const multer = require('multer');

const auth = require('../middlewares/authMiddleware');

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

console.log('=== CARGANDO TICKET ROUTES ===');

const router = express.Router();

console.log('Rutas de tickets registradas:');
console.log('  POST / (crear)');
console.log('  GET / (listar)');
console.log('  GET /:id');
console.log('  PUT /:id/estado');
console.log('  PUT /:id/comentario');
console.log('  PUT /:id/leido');
console.log('  DELETE /:id');
console.log('  GET /:id/calendar');
console.log('  GET /:id/recurrencia');
console.log('  PUT /:id/recurrencia');
console.log('  POST /:id/silenciar');
console.log('  POST /:id/reanudar');
console.log('  GET /:id/notificaciones/estado');
console.log('  GET /:id/asignados');
console.log('  POST /:id/asignar');
console.log('  DELETE /:id/asignar/:usuarioId');
console.log('  GET /usuarios/disponibles');

/* =========================
   Multer a /uploads
   ========================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (/^image\//i.test(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* =========================
   Rutas CRUD principales
   ========================= */
router.post('/', auth, upload.single('imagen'), crearTicket);
router.get('/', auth, obtenerTickets);
router.get('/:id', auth, obtenerTicketPorId);
router.put('/:id/estado', auth, actualizarEstado);
router.put('/:id/comentario', auth, upload.single('imagen'), agregarComentario);
router.put('/:id/leido', auth, marcarLeido);
router.delete('/:id', auth, eliminarTicket);
router.get('/:id/calendar', auth, generarEventoCalendar);

/* =========================
   ENDPOINTS DE RECURRENCIA
   ========================= */
router.put('/:id/recurrencia', auth, actualizarRecurrencia);
router.get('/:id/recurrencia', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const ticket = await Ticket.findById(req.params.id)
      .select('es_recurrente recurrencia numero_ticket');
    
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    res.json({
      es_recurrente: ticket.es_recurrente,
      recurrencia: ticket.recurrencia,
      numero_ticket: ticket.numero_ticket
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuracion' });
  }
});

/* =========================
   ENDPOINTS PARA NOTIFICACIONES
   ========================= */
router.post('/:id/silenciar', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    const { dias } = req.body;
    
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    const esPropietario = ticket.usuario_id.toString() === req.user.id;
    const esAdmin = req.user.rol === 'admin';
    
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    let silenciarHasta = new Date();
    const diasASilenciar = dias || 30;
    silenciarHasta.setDate(silenciarHasta.getDate() + diasASilenciar);
    
    await Ticket.findByIdAndUpdate(id, {
      $set: {
        silenciar_notificaciones_hasta: silenciarHasta,
        notificaciones_habilitadas: false
      }
    }, { runValidators: false });
    
    res.json({ success: true, message: `Notificaciones silenciadas hasta ${silenciarHasta.toLocaleDateString()}` });
  } catch (error) {
    console.error('Error al silenciar notificaciones:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.post('/:id/reanudar', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
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
    console.error('Error al reanudar notificaciones:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.get('/:id/notificaciones/estado', auth, async (req, res) => {
  try {
    const Ticket = require('../models/ticket.model');
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id).select('silenciar_notificaciones_hasta notificaciones_habilitadas ultimo_recordatorio_enviado');
    if (!ticket) return res.status(404).json({ error: 'Tarea no encontrada' });
    
    const ahora = new Date();
    const silenciado = ticket.silenciar_notificaciones_hasta && new Date(ticket.silenciar_notificaciones_hasta) > ahora;
    
    res.json({
      habilitadas: ticket.notificaciones_habilitadas && !silenciado,
      silenciadoHasta: ticket.silenciar_notificaciones_hasta,
      ultimoRecordatorio: ticket.ultimo_recordatorio_enviado
    });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

/* =========================
   ENDPOINTS DE ASIGNACION DE USUARIOS
   ========================= */
router.get('/:id/asignados', auth, obtenerAsignados);
router.post('/:id/asignar', auth, asignarUsuario);
router.delete('/:id/asignar/:usuarioId', auth, desasignarUsuario);
router.get('/usuarios/disponibles', auth, obtenerUsuariosDisponibles);

console.log('=== TICKET ROUTES CARGADAS ===');

module.exports = router;