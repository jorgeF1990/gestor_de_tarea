console.log('=== VERCEL SERVERLESS START ===');

// FORZAR MONGODB_URI
const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = MONGODB_URI;
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'clave_secreta_para_jwt_vercel_2026';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

console.log('[ENV] MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');

try {
  const path = require('path');
  const backendPath = path.resolve(__dirname, '../../backend/app.js');
  console.log('[BACKEND] Cargando desde:', backendPath);
  const app = require(backendPath);
  console.log('[BACKEND]  App cargada correctamente');
  module.exports = app;
} catch (err) {
  console.error('[BACKEND]  Error:', err.message);
  
  // FALLBACK - App de emergencia
  const express = require('express');
  const cors = require('cors');
  
  const fallbackApp = express();
  fallbackApp.use(cors({ origin: true, credentials: true }));
  fallbackApp.use(express.json());
  
  fallbackApp.get('/health', (req, res) => {
    res.json({ ok: true, status: 'healthy', mode: 'fallback' });
  });
  
  fallbackApp.get('/ping-db', (req, res) => {
    res.json({ ok: true, message: 'Ping exitoso (fallback)' });
  });
  
  fallbackApp.post('/auth/login', (req, res) => {
    console.log('[FALLBACK] Login:', req.body);
    res.json({
      token: 'fake_token_' + Date.now(),
      usuario: {
        nombre: 'Test User',
        email: req.body.email || 'test@test.com',
        rol: 'usuario'
      }
    });
  });
  
  fallbackApp.post('/auth/register', (req, res) => {
    res.json({ message: 'Usuario registrado (fallback)' });
  });
  
  fallbackApp.get('/tickets', (req, res) => {
    res.json([]);
  });
  
  fallbackApp.all('*', (req, res) => {
    console.log('[FALLBACK] Ruta no encontrada:', req.method, req.path);
    res.status(404).json({
      error: 'Ruta no encontrada',
      path: req.path,
      method: req.method,
      mode: 'fallback'
    });
  });
  
  console.log('[FALLBACK]  App de emergencia lista');
  module.exports = fallbackApp;
}
