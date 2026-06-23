const express = require('express');
const app = express();

app.use(express.json());

// Ruta de prueba
app.get('/test', (req, res) => {
  res.json({ ok: true, message: 'API funcionando' });
});

// Ruta para tickets (simulada)
app.get('/tickets', (req, res) => {
  res.json({ ok: true, message: 'Ruta tickets funcionando', tickets: [] });
});

// Ruta para auth (simulada)
app.post('/auth/login', (req, res) => {
  res.json({ ok: true, message: 'Login simulado' });
});

// Ruta para health
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.0.00', mongodb: 'conectado' });
});

// Ruta para ping-db
app.get('/ping-db', (req, res) => {
  res.json({ ok: true, message: 'Ping DB simulado' });
});

module.exports = app;
