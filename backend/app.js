// backend/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { startScheduler } = require('./scheduler/cron.scheduler.js');
const User = require('./models/User');

// ============================================================
// ENVIRONMENT CONFIGURATION
// ============================================================
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

// FORZAR MONGODB_URI PARA PRODUCCION
if (isProduction) {
  process.env.MONGODB_URI = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';
  console.log('[ENV] Production mode - MONGODB_URI forzada');
} else {
  dotenv.config({ path: '.env.local' });
  console.log('[ENV] Development mode');
}

const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// ============================================================
// CORS CONFIGURATION
// ============================================================
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();

const allowedOrigins = isProduction
  ? [
      FRONTEND_URL,
      'https://tareasync.vercel.app',
      'https://tareasync-jorgesfb29-gmailcoms-projects.vercel.app',
      'https://tareasync-ihtrnbh9f-jorgesfb29-gmailcoms-projects.vercel.app',
      'https://gestor-de-tarea-jorgesfb29-gmailcoms-projects.vercel.app',
      'https://gestor-de-tarea-sepia.vercel.app',
      'https://gestor-de-tarea-os8w-jorgesfb29-gmailcoms-projects.vercel.app'
    ]
  : [
      'http://localhost:3000',
      'http://localhost:5001',
      'http://localhost:5173'
    ];

console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn('[CORS] Blocked origin:', origin);
    if (!isProduction) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
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
// MONGODB CONNECTION
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI;

console.log('[DB] Environment:', isProduction ? 'Production' : 'Development');
console.log('[DB] MONGODB_URI:', MONGODB_URI ? 'Defined' : 'Not defined');

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

let isMongoConnected = false;
let mongoConnectionPromise = null;

const connectToMongoDB = async () => {
  if (mongoConnectionPromise) return mongoConnectionPromise;

  if (!MONGODB_URI) {
    console.error('[DB] ERROR: MONGODB_URI not defined');
    return Promise.reject(new Error('MONGODB_URI not defined'));
  }

  console.log('[DB] Connecting to MongoDB...');
  const mode = MONGODB_URI.includes('mongodb+srv') ? 'Atlas (Production)' : 'Local';
  console.log('[DB] Mode:', mode);

  const maskedURI = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log('[DB] URI:', maskedURI);

  mongoConnectionPromise = mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      isMongoConnected = true;
      console.log('[DB] MongoDB connected successfully');
      console.log('[DB] Database:', mongoose.connection.name);

      if (!isProduction) {
        startScheduler();
      } else {
        console.log('[DB] Scheduler disabled in Vercel environment');
      }

      return mongoose.connection;
    })
    .catch(err => {
      console.error('[DB] Connection error:', err.message);
      isMongoConnected = false;
      mongoConnectionPromise = null;
      throw err;
    });

  return mongoConnectionPromise;
};

const getMongoStatus = () => ({
  readyState: mongoose.connection.readyState,
  isConnected: isMongoConnected && mongoose.connection.readyState === 1,
  readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
});

const ensureMongoConnection = async (req, res, next) => {
  try {
    if (!isMongoConnected || mongoose.connection.readyState !== 1) {
      await connectToMongoDB();
    }
    next();
  } catch (err) {
    console.error('[DB] Connection assurance error:', err.message);
    res.status(503).json({
      ok: false,
      error: 'Database service unavailable',
      message: err.message
    });
  }
};

// ============================================================
// ROUTES
// ============================================================
app.use('/auth', ensureMongoConnection, authRoutes);
app.use('/tickets', ensureMongoConnection, ticketRoutes);

// ============================================================
// UTILITY ENDPOINTS
// ============================================================
app.get('/', (_req, res) => res.send('Backend running correctly'));

app.get('/ping-db', async (_req, res) => {
  try {
    const status = getMongoStatus();

    if (!status.isConnected) {
      try {
        await connectToMongoDB();
      } catch (err) {
        return res.status(503).json({
          ok: false,
          error: 'Failed to connect to MongoDB',
          message: err.message,
          readyState: status.readyState,
          readyStateText: status.readyStateText
        });
      }
    }

    await mongoose.connection.db.admin().ping();
    res.json({
      ok: true,
      message: 'MongoDB responds correctly',
      ...getMongoStatus()
    });
  } catch (err) {
    console.error('[DB] Ping error:', err.message);
    res.status(500).json({
      ok: false,
      error: 'Error connecting to MongoDB',
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
        console.warn('[HEALTH] MongoDB unavailable');
      }
    }

    res.json({
      ok: true,
      version: process.env.VITE_VERSION || '1.0.00',
      mongodb: getMongoStatus().isConnected ? 'connected' : 'disconnected',
      environment: isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
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
        return res.status(503).send('Database service unavailable');
      }
    }

    const usuario = await User.findOne({
      resetToken: token,
      resetTokenExpira: { $gt: Date.now() }
    });

    if (!usuario) return res.status(400).send('Invalid or expired token');

    return res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Reset Password</title>
          <style>
            body { font-family: Arial, sans-serif; max-width:600px; margin:40px auto; padding:20px; }
            label, input, button { display:block; width:100%; }
            input { padding:8px; margin:8px 0 16px; box-sizing:border-box; }
            button { padding:10px 16px; }
          </style>
        </head>
        <body>
          <h2>Reset Password</h2>
          <p>User: ${usuario.email}</p>
          <form method="POST" action="/auth/reset/${token}">
            <label>
              New Password
              <input name="nuevaPassword" type="password" placeholder="New password" required minlength="8" />
            </label>
            <button type="submit">Reset Password</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[AUTH] Reset token error:', err);
    res.status(500).send('Internal error');
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err.message);
  console.error(err.stack);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Contact administrator'
  });
});

// ============================================================
// SERVER STARTUP
// ============================================================
const PORT = process.env.PORT || 5001;

if (!process.env.VERCEL) {
  connectToMongoDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log('Server running on port ' + PORT);
        console.log('Available routes:');
        console.log('  POST   /tickets        - Create ticket');
        console.log('  GET    /tickets        - List tickets');
        console.log('  PUT    /tickets/:id/estado - Update status');
        console.log('  GET    /tickets/:id/calendar - Download ICS');
        console.log('  GET    /ping-db        - Verify MongoDB connection');
        console.log('  GET    /health         - Health check');
        console.log('='.repeat(50));
      });
    })
    .catch(err => {
      console.error('[ERROR] Server startup failed:', err.message);
      process.exit(1);
    });
} else {
  console.log('[STARTUP] Vercel mode: On-demand connection enabled');
  connectToMongoDB().catch(err => {
    console.warn('[STARTUP] Initial MongoDB connection failed:', err.message);
  });
}

module.exports = app;
