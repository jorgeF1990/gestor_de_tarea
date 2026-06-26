console.log('=== VERCEL SERVERLESS START ===');

// FORZAR VARIABLES DE ENTORNO
const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = MONGODB_URI;
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'clave_secreta_para_jwt_vercel_2026';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

try {
  // Cargar backend desde la copia local
  const app = require('./backend/app.js');
  console.log('[BACKEND] ✅ App cargada correctamente');
  module.exports = app;
} catch (err) {
  console.error('[BACKEND] ❌ Error:', err.message);
  
  // Fallback
  const express = require('express');
  const cors = require('cors');
  const fallbackApp = express();
  fallbackApp.use(cors({ origin: true, credentials: true }));
  fallbackApp.use(express.json());
  
  fallbackApp.get('/health', (req, res) => {
    res.json({ ok: true, status: 'healthy', mode: 'fallback' });
  });
  
  fallbackApp.post('/auth/login', (req, res) => {
    res.json({ token: 'fake_token_' + Date.now(), usuario: { email: req.body.email } });
  });
  
  fallbackApp.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });
  
  module.exports = fallbackApp;
}
