const mongoose = require('mongoose');

const historialSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  estado: String,
  comentario: String,
  autor: String,
  imagen: String
});

const ESTADOS = {
  ABIERTO: 'abierto',
  PENDIENTE: 'pendiente',
  EN_PROCESO: 'en_proceso',
  RESUELTO: 'resuelto',
  CERRADO: 'cerrado',
  REABIERTO: 'reabierto',
  CANCELADO: 'cancelado',
  ARCHIVADO: 'archivado'
};

const PRIORIDADES = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
  URGENTE: 'urgente'
};

const TIPOS_RECURRENCIA = {
  DIARIA: 'diaria',
  SEMANAL: 'semanal',
  MENSUAL: 'mensual',
  ANUAL: 'anual'
};

const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6];

const ticketSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  asunto: { type: String, required: true },
  descripcion: { type: String, default: '' },
  numero_ticket: { type: String, unique: true },
  prioridad: { 
    type: String, 
    enum: Object.values(PRIORIDADES), 
    default: PRIORIDADES.MEDIA 
  },
  estado: { 
    type: String, 
    enum: Object.values(ESTADOS), 
    default: ESTADOS.PENDIENTE 
  },
  historial: [historialSchema],
  fecha_creacion: { type: Date, default: Date.now },
  fecha_vencimiento: { type: Date },
  fecha_cierre: { type: Date },
  imagen: { type: String, default: null },
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
  asignados: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  es_recurrente: { type: Boolean, default: false },
  recurrencia: {
    tipo: { 
      type: String, 
      enum: Object.values(TIPOS_RECURRENCIA),
      default: null 
    },
    intervalo: { type: Number, default: 1, min: 1 },
    dias_semana: [{
      type: Number,
      enum: DIAS_SEMANA
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
  google_event_id: { type: String, default: null },
  outlook_event_id: { type: String, default: null },
  fecha_actualizacion: { type: Date, default: Date.now },
  actualizador: { type: String, default: null }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

ticketSchema.index({ usuario_id: 1, estado: 1, fecha_creacion: -1 });
ticketSchema.index({ estado: 1, fecha_vencimiento: 1, last_vencimiento_notification: 1 });
ticketSchema.index({ numero_ticket: 1 });
ticketSchema.index({ asignados: 1 });
ticketSchema.index({ 'recurrencia.ticket_padre': 1 });
ticketSchema.index({ es_recurrente: 1, 'recurrencia.activa': 1 });

ticketSchema.methods.esFinal = function() {
  return [ESTADOS.CERRADO, ESTADOS.RESUELTO, ESTADOS.ARCHIVADO].includes(this.estado);
};

ticketSchema.methods.estaVencido = function() {
  return this.fecha_vencimiento && this.fecha_vencimiento < new Date() && !this.esFinal();
};

ticketSchema.methods.estaSilenciado = function() {
  return this.silenciar_notificaciones_hasta && new Date(this.silenciar_notificaciones_hasta) > new Date();
};

module.exports = mongoose.model('Ticket', ticketSchema);