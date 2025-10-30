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
  marcarLeido
} = require('../controllers/tickets.controller'); // Asegúrate del nombre real del archivo

const router = express.Router();

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
   Rutas (protegidas)
   ========================= */
router.get('/', auth, obtenerTickets);
router.post('/', auth, upload.single('imagen'), crearTicket);
router.put('/:id/estado', auth, actualizarEstado);
router.put('/:id/comentario', auth, upload.single('imagen'), agregarComentario);
router.put('/:id/leido', auth, marcarLeido);

module.exports = router;
