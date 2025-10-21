const express = require('express');
const multer = require('multer');
const path = require('path');

const {
  crearTicket,
  actualizarEstado,
  obtenerTickets,
  marcarLeido,
  agregarComentario
} = require('../controllers/ticket.controller');

const authMiddleware = require('../middlewares/authMiddleware');
const esAdmin = require('../middlewares/esAdmin');
const esSoporte = require('../middlewares/esSoporte');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.use(authMiddleware);

router.post('/', upload.single('imagen'), crearTicket);
router.put('/:id/comentario', upload.single('imagen'), agregarComentario);
router.put('/:id/estado', esAdmin, actualizarEstado);
router.put('/:id/leido', marcarLeido);

router.get('/', obtenerTickets);
router.get('/soporte', esSoporte, obtenerTickets);

module.exports = router;