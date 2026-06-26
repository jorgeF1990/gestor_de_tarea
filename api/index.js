console.log('=== VERCEL SERVERLESS START ===');
console.log('[DEBUG] Directorio actual:', __dirname);
console.log('[DEBUG] Archivos en api/:', require('fs').readdirSync(__dirname));

// FORZAR VARIABLES DE ENTORNO
const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = MONGODB_URI;
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'clave_secreta_para_jwt_vercel_2026';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

console.log('[ENV] MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');

// INTENTAR CARGAR EL BACKEND DESDE LA COPIA LOCAL
try {
  const path = require('path');
  const backendPath = path.join(__dirname, 'backend/app.js');
  console.log('[BACKEND] Intentando cargar:', backendPath);
  
  // Verificar que el archivo existe
  const fs = require('fs');
  if (!fs.existsSync(backendPath)) {
    throw new Error(`Archivo no encontrado: ${backendPath}`);
  }
  
  console.log('[BACKEND] ✅ Archivo encontrado, cargando...');
  const app = require(backendPath);
  console.log('[BACKEND] ✅ App cargada correctamente');
  module.exports = app;
} catch (err) {
  console.error('[BACKEND] ❌ Error:', err.message);
  console.error('[BACKEND] Stack:', err.stack);
  
  // FALLBACK - App de emergencia
  console.log('[FALLBACK] Usando app de emergencia...');
  const express = require('express');
  const cors = require('cors');
  
  const fallbackApp = express();
  fallbackApp.use(cors({ origin: true, credentials: true }));
  fallbackApp.use(express.json());
  
  fallbackApp.get('/health', (req, res) => {
    res.json({ ok: true, status: 'healthy', mode: 'fallback', debug: __dirname });
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
  
  console.log('[FALLBACK] ✅ App de emergencia lista');
  module.exports = fallbackApp;
}
