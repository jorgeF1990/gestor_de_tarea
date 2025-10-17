// Cargar variables de entorno
require('dotenv').config();

// Importar dependencias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); 

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');

// Inicializar la app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

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
app.use('/auth', authRoutes);       // /auth/login y /auth/register
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

// Iniciar servidor
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});