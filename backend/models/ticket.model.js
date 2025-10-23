const mongoose = require('mongoose');

const historialSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  estado: String,
  comentario: String,
  autor: String,
  imagen: String

});

const ticketSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  asunto: String,
  descripcion: String,
  numero_ticket: { type: String, unique: true },
  prioridad: { type: String, enum: ['baja', 'media', 'alta'], default: 'media' },
  estado: { type: String, enum: ['abierto', 'pendiente', 'en_proceso', 'resuelto', 'cerrado', 'reabierto', 'cancelado'], default: 'pendiente' },
  historial: [historialSchema],

  fecha_creacion: { type: Date, default: Date.now },
  imagen: String,
  leidoPor: [
    {
      usuario: String,
      fecha: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Ticket', ticketSchema);
