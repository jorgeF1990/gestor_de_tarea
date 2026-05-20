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
  prioridad: { 
    type: String, 
    enum: ['baja', 'media', 'alta', 'urgente'], 
    default: 'media' 
  },
  estado: { 
    type: String, 
    enum: ['abierto', 'pendiente', 'en_proceso', 'resuelto', 'cerrado', 'reabierto', 'cancelado', 'archivado'],
    default: 'pendiente' 
  },
  historial: [historialSchema],
  
  fecha_creacion: { type: Date, default: Date.now },
  fecha_vencimiento: { type: Date },
  fecha_cierre: { type: Date },
  imagen: String,
  leidoPor: [
    {
      usuario: String,
      fecha: { type: Date, default: Date.now }
    }
  ],
  last_vencimiento_notification: { type: Date, default: null },
  
  silenciar_notificaciones_hasta: { type: Date, default: null },
  notificaciones_habilitadas: { type: Boolean, default: true },
  ultimo_recordatorio_enviado: { type: String, default: null },
  
  // ========== ASIGNACIÓN MÚLTIPLE ==========
  asignados: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  
  // ========== CAMPOS PARA RECURRENCIA ==========
  es_recurrente: { type: Boolean, default: false },
  recurrencia: {
    tipo: { 
      type: String, 
      enum: ['diaria', 'semanal', 'mensual', 'anual'],
      default: null 
    },
    intervalo: { type: Number, default: 1, min: 1 },
    dias_semana: [{
      type: Number,
      enum: [0, 1, 2, 3, 4, 5, 6]  // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
    }],
    dia_mes: { type: Number, min: 1, max: 31 },
    solo_dias_habiles: { type: Boolean, default: true },
    fecha_inicio: { type: Date },
    fecha_fin: { type: Date },
    ultima_generacion: { type: Date },
    ticket_padre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null
    },
    activa: { type: Boolean, default: true }
  },
  
  // Campos para integración con calendarios
  google_event_id: String,
  outlook_event_id: String,
  fecha_actualizacion: { type: Date, default: Date.now },
  actualizador: String
});

/* =========================   ÍNDICES   ========================= */
ticketSchema.index({ usuario_id: 1, estado: 1, fecha_creacion: -1 });
ticketSchema.index({ estado: 1, fecha_vencimiento: 1, last_vencimiento_notification: 1 });
ticketSchema.index({ numero_ticket: 1 });
ticketSchema.index({ asignados: 1 });
ticketSchema.index({ 'recurrencia.ticket_padre': 1 });
ticketSchema.index({ es_recurrente: 1, 'recurrencia.activa': 1 });

module.exports = mongoose.model('Ticket', ticketSchema);