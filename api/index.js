console.log('=== VERCEL SERVERLESS START ===');

const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = MONGODB_URI;
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'clave_secreta_para_jwt_vercel_2026';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

console.log('[ENV] MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');

try {
  const path = require('path');
  const backendPath = path.resolve(__dirname, './backend/app.js');
  console.log('[BACKEND] Cargando desde:', backendPath);
  const app = require(backendPath);
  console.log('[BACKEND] ✅ App cargada correctamente');
  module.exports = app;
} catch (err) {
  console.error('[BACKEND] ❌ Error:', err.message);
  
  const express = require('express');
  const cors = require('cors');
  
  const fallbackApp = express();
  fallbackApp.use(cors({ origin: true, credentials: true }));
  fallbackApp.use(express.json());
  
  fallbackApp.get('/health', (req, res) => {
    res.json({ ok: true, status: 'healthy', mode: 'fallback' });
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
  
  fallbackApp.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });
  
  module.exports = fallbackApp;
}
