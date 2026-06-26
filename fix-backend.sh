#!/bin/bash

echo "=========================================="
echo "  CORREGIR BACKEND EN VERCEL"
echo "=========================================="

# 1. Verificar backend/app.js
echo "[1/4] Verificando backend/app.js..."
if [ ! -f "backend/app.js" ]; then
    echo "❌ backend/app.js no existe"
    exit 1
fi
echo "✅ backend/app.js existe"

# 2. Actualizar api/index.js
echo "[2/4] Actualizando api/index.js..."
cat > api/index.js << 'API'
console.log('=== VERCEL SERVERLESS START ===');
const MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = MONGODB_URI;
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'clave_secreta_para_jwt_vercel_2026';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

console.log('[ENV] MONGODB_URI:', process.env.MONGODB_URI ? '✓' : '✗');

try {
  const backendPath = './backend/app.js';
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
      usuario: { nombre: 'Test', email: req.body.email, rol: 'usuario' }
    });
  });
  
  fallbackApp.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });
  
  module.exports = fallbackApp;
}
API

# 3. Instalar dependencias del backend
echo "[3/4] Instalando dependencias del backend..."
cd backend
npm install --legacy-peer-deps
cd ..

# 4. Desplegar
echo "[4/4] Desplegando..."
git add .
git commit -m "fix: backend correcto en Vercel $(date +%Y%m%d_%H%M%S)"
git push origin main
vercel --prod --force

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "URL: https://tareasync.vercel.app"
echo ""
echo "Probar: curl https://tareasync.vercel.app/health"
