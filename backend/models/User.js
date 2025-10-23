const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: String,
  nombre: String,
  rol: { type: String, enum: ['admin', 'usuario', 'soporte'], default: 'usuario' },
  resetToken: String,
  resetTokenExpira: Date
});

module.exports = mongoose.model('User', userSchema);