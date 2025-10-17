const mongoose = require('mongoose');

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
  estado: { type: String, enum: ['pendiente', 'en_proceso', 'resuelto'], default: 'pendiente' },
  historial: [
    {
      fecha: Date,
      estado: String,
      comentario: String
    }
  ],
  fecha_creacion: { type: Date, default: Date.now },
  imagen: String
});

module.exports = mongoose.model('Ticket', ticketSchema);