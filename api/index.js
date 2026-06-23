const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.0.00', mongodb: 'conectado' });
});

app.post('/auth/login', (req, res) => {
  res.json({ ok: true, message: 'Login simulado' });
});

app.get('/tickets', (req, res) => {
  res.json({ ok: true, message: 'Ruta tickets funcionando', tickets: [] });
});

app.get('/tickets/usuarios/disponibles', (req, res) => {
  res.json({ ok: true, message: 'Usuarios disponibles', usuarios: [] });
});

module.exports = app;