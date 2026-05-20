const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: String,
  nombre: String,
  rol: { type: String, enum: ['admin', 'usuario', 'soporte'], default: 'usuario' },
  resetToken: String,
  resetTokenExpira: Date,
  
  notificaciones: {
    tarea_creada: { type: Boolean, default: true },
    tarea_actualizada: { type: Boolean, default: true },
    recordatorios_vencimiento: { type: Boolean, default: true }
  },
  
  silenciar_notificaciones_hasta: { type: Date, default: null },
  
  // NUEVO: Usuario activo para asignaciones
  activo: { type: Boolean, default: true }
});

module.exports = mongoose.model('User', userSchema);