// api/index.js
// Punto de entrada para Vercel Serverless

const app = require('../backend/app.js');

// Exportar la app de Express para Vercel
module.exports = app;