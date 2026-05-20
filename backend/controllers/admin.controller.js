const User = require('../models/User');

/* OBTENER TODOS LOS USUARIOS */
exports.obtenerUsuarios = async (req, res) => {
  try {
    // Solo admin puede ver todos los usuarios
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const usuarios = await User.find({}, '-password');
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

/* ACTUALIZAR USUARIO */
exports.actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, activo, notificaciones } = req.body;
    
    // Solo admin puede modificar usuarios
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // No permitir que un admin se desactive a sí mismo
    if (id === req.user.id && activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    
    const updateData = {};
    if (rol) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;
    if (notificaciones) updateData.notificaciones = notificaciones;
    
    const usuario = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(usuario);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};