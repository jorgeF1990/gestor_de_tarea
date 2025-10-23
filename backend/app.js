// backend/app.js

// Cargar variables de entorno
require('dotenv').config();

// Importar dependencias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Importar modelo necesario para la ruta de formulario de reset
const User = require('./models/User');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');

// Inicializar la app
const app = express();

// Middlewares
// Permitir CORS desde FRONTEND_URL si está configurado, si no permitir cualquier origen (útil en desarrollo)
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();
app.use(cors({
  origin: FRONTEND_URL || true
}));
app.use(express.json());
// Permitir parsear body de formularios (form submissions desde HTML)
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error de conexión a MongoDB:', err.message);
    process.exit(1);
  });

// Rutas principales
app.use('/auth', authRoutes);       // /auth/login, /auth/register, /auth/recuperar, /auth/reset (POST)
app.use('/tickets', ticketRoutes);  // /tickets

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend funcionando correctamente');
});

// Ruta para verificar conexión con MongoDB
app.get('/ping-db', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.send('MongoDB responde correctamente');
  } catch (err) {
    console.error('Error al hacer ping a MongoDB:', err.message);
    res.status(500).send('Error al conectar con MongoDB');
  }
});

/**
 * Ruta opcional que sirve un formulario HTML simple para restablecer contraseña.
 * Permite abrir el enlace enviado por correo (http://localhost:5001/auth/reset/:token)
 * y enviar un formulario directamente al POST /auth/reset/:token (que ya debe existir).
 */
app.get('/auth/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const usuario = await User.findOne({ resetToken: token, resetTokenExpira: { $gt: Date.now() } });
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

// Iniciar servidor
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});