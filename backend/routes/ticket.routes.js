const express = require('express');
const multer = require('multer');
const { crearTicket, actualizarEstado, obtenerTickets } = require('../controllers/ticket.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const esAdmin = require('../middlewares/esAdmin');
const esSoporte = require('../middlewares/esSoporte');
const path = require('path');

const router = express.Router();

// Configuración básica de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')), // 
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Proteger todas las rutas con autenticación
router.use(authMiddleware);

// Crear ticket (cualquier usuario autenticado)
router.post('/', upload.single('imagen'), crearTicket);
// Actualizar estado del ticket (solo admin)
router.put('/:id/estado', authMiddleware, actualizarEstado);

// Obtener tickets
router.get('/', obtenerTickets);
router.get('/:soporte', esSoporte, obtenerTickets);

module.exports = router;