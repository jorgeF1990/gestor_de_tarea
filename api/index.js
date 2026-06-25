// api/index.js - Punto de entrada para Vercel
console.log('=== API INDEX ===');

// FORZAR MONGODB_URI PARA PRODUCCION
const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
process.env.MONGODB_URI = MONGODB_URI;
process.env.MONGO_URI = MONGODB_URI;

console.log('MONGODB_URI forzada en process.env');

try {
  const app = require('../backend/app.js');
  console.log('App cargada correctamente');
  module.exports = app;
} catch (err) {
  console.error('Error cargando app:', err.message);
  
  const express = require('express');
  const errorApp = express();
  errorApp.use(express.json());
  errorApp.get('*', (req, res) => {
    res.status(500).json({ error: 'Error cargando backend', message: err.message });
  });
  errorApp.post('*', (req, res) => {
    res.status(500).json({ error: 'Error cargando backend (POST)', message: err.message });
  });
  module.exports = errorApp;
}
