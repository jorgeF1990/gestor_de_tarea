require('dotenv').config();

// Dependencias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Scheduler
const { startScheduler } = require('./scheduler/cron.scheduler.js');

// Model usado por la ruta GET /auth/reset/:token (form HTML opcional)
const User = require('./models/User');

// Rutas
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');

const app = express();

const adminRoutes = require('./routes/admin.routes');

/* =========================   CORS   ========================= */
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();
app.use(cors({
  origin: FRONTEND_URL || true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/* =========================   Parsers   ========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================   Estaticos (logo y uploads)   ========================= */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/admin', adminRoutes);

/* =========================   MongoDB - CONEXION ROBUSTA   ========================= */
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
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

// Determinar que URI usar (prioridad: MONGODB_URI > MONGO_URI)
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('ERROR: No se encontro MONGODB_URI ni MONGO_URI en las variables de entorno');
  console.error('Asegurate de tener configurado el archivo .env');
  process.exit(1);
}

console.log('Conectando a MongoDB...');
console.log('Modo:', MONGODB_URI.includes('mongodb+srv') ? 'Atlas (produccion)' : 'Local');

mongoose.connect(MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('MongoDB conectado correctamente');
    console.log('Base de datos:', mongoose.connection.name);
    startScheduler();
  })
  .catch(err => {
    console.error('Error de conexion a MongoDB:', err.message);
    process.exit(1);
  });

// Mantener viva la conexion a MongoDB (ping cada 1 minuto)
setInterval(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
    }
  } catch (err) {
    console.warn('Ping a MongoDB fallo:', err.message);
  }
}, 60000);

// Manejar eventos de conexion
mongoose.connection.on('connected', () => {
  console.log('Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Error de conexion Mongoose:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose desconectado de MongoDB');
});

mongoose.connection.on('reconnected', () => {
  console.log('Mongoose reconectado a MongoDB');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB desconectado por cierre de la aplicacion');
  process.exit(0);
});

/* =========================   Rutas principales   ========================= */
app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);

/* =========================   Utilidades   ========================= */
app.get('/', (_req, res) => res.send('Backend funcionando correctamente'));

app.get('/ping-db', async (_req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ 
      ok: true, 
      message: 'MongoDB responde correctamente',
      readyState: mongoose.connection.readyState,
      readyStateText: ['desconectado', 'conectado', 'conectando', 'desconectando'][mongoose.connection.readyState] || 'desconocido'
    });
  } catch (err) {
    console.error('Error al hacer ping a MongoDB:', err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al conectar con MongoDB',
      readyState: mongoose.connection.readyState
    });
  }
});

app.get('/health', (_req, res) =>
  res.json({ 
    ok: true, 
    version: process.env.VITE_VERSION || 'desconocida',
    mongodb: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'
  }));

app.get('/auth/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
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

/* =========================   Inicio servidor   ========================= */
const PORT = process.env.PORT || 5001;
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
  console.log('\nSistema de notificaciones:');
  console.log('  - 30, 21, 14, 7, 3, 1 dias antes del vencimiento');
  console.log('  - El mismo dia del vencimiento');
  console.log('  - Recordatorios post-vencimiento (1, 3, 7, 14, 30 dias)');
  console.log('  - Notificaciones de asignacion/desasignacion');
  console.log('  - Notificaciones de comentarios');
  console.log('='.repeat(50) + '\n');
});

module.exports = app;