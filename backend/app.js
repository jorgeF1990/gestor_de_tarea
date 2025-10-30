// backend/app.js
require('dotenv').config();

// Dependencias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Model usado por la ruta GET /auth/reset/:token (form HTML opcional)
const User = require('./models/User');

// Rutas
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');

const app = express();

/* =========================
   CORS
   ========================= */
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();
app.use(cors({
  origin: FRONTEND_URL || true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/* =========================
   Parsers
   ========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   Estáticos (logo y uploads)
   ========================= */
app.use(express.static(path.join(__dirname, 'public')));              // => /logo.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // => /uploads/<archivo>

/* =========================
   MongoDB
   ========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error de conexión a MongoDB:', err.message);
    process.exit(1);
  });

/* =========================
   Rutas principales
   ========================= */
app.use('/auth', authRoutes);       // /auth/*
app.use('/tickets', ticketRoutes);  // /tickets/*

/* =========================
   Utilidades
   ========================= */
app.get('/', (_req, res) => res.send('Backend funcionando correctamente'));

app.get('/ping-db', async (_req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.send('MongoDB responde correctamente');
  } catch (err) {
    console.error('Error al hacer ping a MongoDB:', err.message);
    res.status(500).send('Error al conectar con MongoDB');
  }
});

app.get('/health', (_req, res) =>
  res.json({ ok: true, version: process.env.VITE_VERSION || 'desconocida' })
);

/**
 * Form HTML simple para restablecer contraseña (opcional).
 * Sirve GET /auth/reset/:token y envía el form al POST /auth/reset/:token.
 */
app.get('/auth/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const usuario = await User.findOne({
      resetToken: token,
      resetTokenExpira: { $gt: Date.now() }
    });
    if (!usuario) return res.status(400).send('Token inválido o expirado');

    return res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Restablecer contraseña</title>
          <style>
            body { font-family: Arial, sans-serif; max-width:600px; margin:40px auto; padding:20px; }
            label, input, button { display:block; width:100%; }
            input { padding:8px; margin:8px 0 16px; box-sizing:border-box; }
            button { padding:10px 16px; }
          </style>
        </head>
        <body>
          <h2>Restablecer contraseña</h2>
          <p>Usuario: ${usuario.email}</p>
          <form method="POST" action="/auth/reset/${token}">
            <label>
              Nueva contraseña
              <input name="nuevaPassword" type="password" placeholder="Nueva contraseña" required minlength="8" />
            </label>
            <button type="submit">Restablecer contraseña</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('GET /auth/reset/:token error', err);
    res.status(500).send('Error interno');
  }
});

/* =========================
   Inicio servidor
   ========================= */
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
module.exports = app;