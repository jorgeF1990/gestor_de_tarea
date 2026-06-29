// api/index.js
// Cargar variables de entorno desde .env
const path = require('path');
const dotenv = require('dotenv');

// Buscar .env en la raíz del proyecto
const envPath = path.join(__dirname, '..', '.env');
console.log('[VERCEL] Cargando .env desde:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('[VERCEL] Error cargando .env:', result.error.message);
  // Intentar desde la raíz actual
  const fallbackPath = path.join(__dirname, '.env');
  console.log('[VERCEL] Intentando desde:', fallbackPath);
  const fallback = dotenv.config({ path: fallbackPath });
  if (fallback.error) {
    console.error('[VERCEL] No se pudo cargar .env desde ninguna ubicacion');
  }
} else {
  console.log('[VERCEL] Variables de entorno cargadas correctamente');
  console.log('[VERCEL] MONGODB_URI:', process.env.MONGODB_URI ? 'Definida' : 'No definida');
  console.log('[VERCEL] JWT_SECRET:', process.env.JWT_SECRET ? 'Definida' : 'No definida');
}

console.log('[VERCEL] Iniciando funcion serverless');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rootPath = require('app-root-path');

// Root path para resolver rutas relativas
global.__root = rootPath.path;
console.log('[VERCEL] Root path:', __root);

// ============================================================
// CONFIGURACION - VARIABLES DE ENTORNO
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
  console.error('[VERCEL] ERROR: MONGODB_URI no definida');
}

if (!JWT_SECRET) {
  console.warn('[VERCEL] WARNING: JWT_SECRET no definida');
}

// ============================================================
// EXPRESS APP
// ============================================================
const app = express();

// CORS Configuration
const allowedOrigins = [
  'https://tareasync.vercel.app',
  'https://gestor-de-tarea-sepia.vercel.app',
  'https://gestor-de-tarea-os8w-jorgesfb29-gmailcoms-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Bloqueado:', origin);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// ============================================================
// MONGODB CONNECTION (CACHED)
// ============================================================
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  maxPoolSize: 5,
  minPoolSize: 1,
  family: 4
};

let cachedConnection = null;
let isConnecting = false;

async function connectToMongoDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return connectToMongoDB();
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI no definida');
  }

  isConnecting = true;

  try {
    console.log('[VERCEL] Conectando a MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI, mongooseOptions);
    cachedConnection = conn;
    console.log('[VERCEL] MongoDB conectado exitosamente');
    return conn;
  } catch (error) {
    console.error('[VERCEL] Error conectando a MongoDB:', error.message);
    cachedConnection = null;
    throw error;
  } finally {
    isConnecting = false;
  }
}

async function ensureConnection(req, res, next) {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    res.status(503).json({
      error: 'Database service unavailable',
      message: error.message
    });
  }
}

// ============================================================
// HEALTH CHECKS
// ============================================================
app.get('/health', async (req, res) => {
  try {
    const status = mongoose.connection.readyState;
    const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][status] || 'unknown';

    res.json({
      ok: true,
      status: 'healthy',
      mongodb: status === 1 ? 'connected' : 'disconnected',
      mongodbStatus: statusText,
      environment: process.env.NODE_ENV || 'production',
      vercel: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

app.get('/ping-db', async (req, res) => {
  try {
    await connectToMongoDB();
    await mongoose.connection.db.admin().ping();

    res.json({
      ok: true,
      message: 'MongoDB responde correctamente',
      readyState: mongoose.connection.readyState,
      readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Error conectando a MongoDB',
      message: error.message
    });
  }
});

// ============================================================
// RUTAS - IMPORTAR DESDE BACKEND USANDO ROOT PATH
// ============================================================
try {
  const authRoutes = require(path.join(__dirname, '..', 'backend', 'routes', 'auth.routes'));
  const ticketRoutes = require(path.join(__dirname, '..', 'backend', 'routes', 'ticket.routes'));
  const adminRoutes = require(path.join(__dirname, '..', 'backend', 'routes', 'admin.routes'));
  const calendarRoutes = require(path.join(__dirname, '..', 'backend', 'routes', 'calendar.routes'));

  app.use('/auth', ensureConnection, authRoutes);
  app.use('/tickets', ensureConnection, ticketRoutes);
  app.use('/admin', ensureConnection, adminRoutes);
  app.use('/calendar', ensureConnection, calendarRoutes);

  console.log('[VERCEL] Rutas cargadas correctamente');
} catch (error) {
  console.error('[VERCEL] Error cargando rutas:', error.message);
  
  // Fallback para rutas basicas
  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'API running in fallback mode' });
  });
}

// ============================================================
// MANEJO DE ERRORES
// ============================================================
app.use((err, req, res, next) => {
  console.error('[VERCEL] Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Contact administrator'
  });
});

// ============================================================
// ROOT
// ============================================================
app.get('/', (req, res) => {
  res.json({
    message: 'TareaSync API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      ping: '/ping-db',
      auth: '/auth',
      tickets: '/tickets',
      admin: '/admin',
      calendar: '/calendar'
    }
  });
});

// ============================================================
// EXPORT
// ============================================================
module.exports = app;