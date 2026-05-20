const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const User = require('../models/User');
const { generarTicketsRecurrentes } = require('../controllers/tickets.controller');

// Todas las rutas requieren autenticación y rol admin
router.use(auth);
router.use((req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
});

// Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await User.find({}, '-password');
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Actualizar usuario
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, activo, notificaciones } = req.body;
    
    // No permitir que un admin se desactive a sí mismo
    if (id === req.user.id && activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    
    const updateData = {};
    if (rol !== undefined) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;
    if (notificaciones) updateData.notificaciones = notificaciones;
    
    const usuario = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json(usuario);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ========== ENDPOINT ADMIN: FORZAR GENERACIÓN DE TICKETS RECURRENTES ==========
router.post('/generar-recurrentes', async (req, res) => {
  try {
    const resultado = await generarTicketsRecurrentes();
    res.json({ 
      success: true, 
      message: 'Generación de tickets recurrentes completada',
      ...resultado 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al generar tickets recurrentes', 
      detalle: error.message 
    });
  }
});

module.exports = router;