const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  nombre: { 
    type: String, 
    required: true,
    trim: true
  },
  rol: { 
    type: String, 
    enum: ['admin', 'usuario', 'soporte'], 
    default: 'usuario' 
  },
  resetToken: { 
    type: String, 
    default: null 
  },
  resetTokenExpira: { 
    type: Date, 
    default: null 
  },
  notificaciones: {
    tarea_creada: { type: Boolean, default: true },
    tarea_actualizada: { type: Boolean, default: true },
    recordatorios_vencimiento: { type: Boolean, default: true }
  },
  silenciar_notificaciones_hasta: { 
    type: Date, 
    default: null 
  },
  activo: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: { 
    createdAt: 'createdAt', 
    updatedAt: 'updatedAt' 
  }
});

userSchema.index({ email: 1 });
userSchema.index({ activo: 1 });
userSchema.index({ resetToken: 1 });

userSchema.methods.estaActivo = function() {
  return this.activo === true;
};

userSchema.methods.esAdmin = function() {
  return this.rol === 'admin';
};

userSchema.methods.esSoporte = function() {
  return this.rol === 'soporte' || this.rol === 'admin';
};

userSchema.methods.estaSilenciado = function() {
  return this.silenciar_notificaciones_hasta && 
         new Date(this.silenciar_notificaciones_hasta) > new Date();
};

module.exports = mongoose.model('User', userSchema);