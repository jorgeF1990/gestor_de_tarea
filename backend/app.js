// backend/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { startScheduler } = require('./scheduler/cron.scheduler.js');
const User = require('./models/User');

try {
  require('dotenv').config();
  console.log('dotenv cargado correctamente');
} catch (err) {
  console.log('dotenv no disponible, usando variables del sistema');
}

const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// ============================================================
// CORS
// ============================================================
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();
const allowedOrigins = [
  FRONTEND_URL,
  'https://tareasync.vercel.app',
  'https://tareasync-jorgesfb29-gmailcoms-projects.vercel.app',
  'https://tareasync-ihtrnbh9f-jorgesfb29-gmailcoms-projects.vercel.app',
  'https://gestor-de-tarea-jorgesfb29-gmailcoms-projects.vercel.app',
  'https://gestor-de-tarea-sepia.vercel.app',
  'https://gestor-de-tarea-axg2mnrvy-jorgesfb29-gmailcoms-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://localhost:5173'
].filter(Boolean);

console.log('Orígenes permitidos por CORS:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('Origen no permitido por CORS:', origin);
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.options('*', cors());

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/admin', adminRoutes);

// ============================================================
// MONGODB
// ============================================================
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 60000,
  family: 4
};

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';

console.log('=== INICIO DEL BACKEND ===');
console.log('VERCEL:', process.env.VERCEL ? 'SI' : 'NO');
console.log('MONGODB_URI:', MONGODB_URI ? 'DEFINIDA' : 'NO DEFINIDA');
console.log('===========================');

let isMongoConnected = false;
let mongoConnectionPromise = null;

const connectToMongoDB = async () => {
  if (mongoConnectionPromise) return mongoConnectionPromise;

  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI no definida');
    return Promise.reject(new Error('MONGODB_URI no definida'));
  }

  console.log('Conectando a MongoDB...');
  console.log('Modo:', MONGODB_URI.includes('mongodb+srv') ? 'Atlas (produccion)' : 'Local');

  const maskedURI = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log('URI:', maskedURI);

  mongoConnectionPromise = mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      isMongoConnected = true;
      console.log('MongoDB conectado correctamente');
      console.log('Base de datos:', mongoose.connection.name);

      if (!process.env.VERCEL) {
        startScheduler();
      } else {
        console.log('Scheduler desactivado en Vercel');
      }

      return mongoose.connection;
    })
    .catch(err => {
      console.error('Error de conexion a MongoDB:', err.message);
      isMongoConnected = false;
      mongoConnectionPromise = null;
      throw err;
    });

  return mongoConnectionPromise;
};

const getMongoStatus = () => ({
  readyState: mongoose.connection.readyState,
  isConnected: isMongoConnected && mongoose.connection.readyState === 1,
  readyStateText: ['desconectado', 'conectado', 'conectando', 'desconectando'][mongoose.connection.readyState] || 'desconocido'
});

const ensureMongoConnection = async (req, res, next) => {
  try {
    if (!isMongoConnected || mongoose.connection.readyState !== 1) {
      await connectToMongoDB();
    }
    next();
  } catch (err) {
    console.error('Error asegurando conexion MongoDB:', err.message);
    res.status(503).json({
      ok: false,
      error: 'Servicio de base de datos no disponible',
      message: err.message
    });
  }
};

// ============================================================
// RUTAS
// ============================================================
app.use('/auth', ensureMongoConnection, authRoutes);
app.use('/tickets', ensureMongoConnection, ticketRoutes);

// ============================================================
// UTILIDADES
// ============================================================
app.get('/', (_req, res) => res.send('Backend funcionando correctamente'));

app.get('/ping-db', async (_req, res) => {
  try {
    const status = getMongoStatus();

    if (!status.isConnected) {
      try {
        await connectToMongoDB();
      } catch (err) {
        return res.status(503).json({
          ok: false,
          error: 'No se pudo conectar a MongoDB',
          message: err.message,
          readyState: status.readyState,
          readyStateText: status.readyStateText
        });
      }
    }

    await mongoose.connection.db.admin().ping();
    res.json({
      ok: true,
      message: 'MongoDB responde correctamente',
      ...getMongoStatus()
    });
  } catch (err) {
    console.error('Error al hacer ping a MongoDB:', err.message);
    res.status(500).json({
      ok: false,
      error: 'Error al conectar con MongoDB',
      message: err.message,
      ...getMongoStatus()
    });
  }
});

app.get('/health', async (_req, res) => {
  try {
    const status = getMongoStatus();

    if (!status.isConnected) {
      try {
        await connectToMongoDB();
      } catch (err) {
        console.warn('Health check: MongoDB no disponible');
      }
    }

    res.json({
      ok: true,
      version: process.env.VITE_VERSION || '1.0.00',
      mongodb: getMongoStatus().isConnected ? 'conectado' : 'desconectado',
      environment: process.env.VERCEL ? 'vercel' : 'local',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'Health check fallo',
      message: err.message
    });
  }
});

app.get('/auth/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!isMongoConnected || mongoose.connection.readyState !== 1) {
      try {
        await connectToMongoDB();
      } catch (err) {
        return res.status(503).send('Servicio de base de datos no disponible');
      }
    }

    const usuario = await User.findOne({
      resetToken: token,
      resetTokenExpira: { $gt: Date.now() }
    });

    if (!usuario) return res.status(400).send('Token invalido o expirado');

    return res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Restablecer contrasena</title>
          <style>
            body { font-family: Arial, sans-serif; max-width:600px; margin:40px auto; padding:20px; }
            label, input, button { display:block; width:100%; }
            input { padding:8px; margin:8px 0 16px; box-sizing:border-box; }
            button { padding:10px 16px; }
          </style>
        </head>
        <body>
          <h2>Restablecer contrasena</h2>
          <p>Usuario: ${usuario.email}</p>
          <form method="POST" action="/auth/reset/${token}">
            <label>
              Nueva contrasena
              <input name="nuevaPassword" type="password" placeholder="Nueva contrasena" required minlength="8" />
            </label>
            <button type="submit">Restablecer contrasena</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('GET /auth/reset/:token error', err);
    res.status(500).send('Error interno');
  }
});

// ============================================================
// MANEJO DE ERRORES
// ============================================================
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.message);
  console.error(err.stack);
  res.status(500).json({
    ok: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Contacte al administrador'
  });
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================
const PORT = process.env.PORT || 5001;

if (!process.env.VERCEL) {
  connectToMongoDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log('Servidor corriendo en puerto ' + PORT);
        console.log('Rutas disponibles:');
        console.log('  POST   /tickets        - Crear tarea');
        console.log('  GET    /tickets        - Listar tareas');
        console.log('  PUT    /tickets/:id/estado - Actualizar estado');
        console.log('  GET    /tickets/:id/calendar - Descargar ICS');
        console.log('  GET    /ping-db        - Verificar conexion MongoDB');
        console.log('  GET    /health         - Health check');
        console.log('='.repeat(50) + '\n');
      });
    })
    .catch(err => {
      console.error('Fallo al iniciar el servidor:', err.message);
      process.exit(1);
    });
} else {
  console.log('Modo Vercel: Conexion bajo demanda activada');
  connectToMongoDB().catch(err => {
    console.warn('Conexion inicial a MongoDB fallo:', err.message);
  });
}

module.exports = app;