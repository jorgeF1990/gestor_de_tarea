console.log('=== API INDEX ===');

// Forzar MONGODB_URI desde Vercel o usar fallback directo
const MONGODB_URI = process.env.MONGODB_URI || 
                     process.env.MONGO_URI || 
                     'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';

console.log('MONGODB_URI:', MONGODB_URI ? 'DEFINIDA' : 'NO DEFINIDA');
console.log('URI:', MONGODB_URI.substring(0, 50) + '...');

// Forzar en process.env para que app.js lo vea
process.env.MONGODB_URI = MONGODB_URI;

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
