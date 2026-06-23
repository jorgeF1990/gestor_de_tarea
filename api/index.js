console.log('=== API INDEX - VERSION COMPLETA ===');
console.log('Directorio actual:', __dirname);
console.log('Archivos en el directorio:', require('fs').readdirSync(__dirname));

console.log('Intentando cargar backend/app.js...');

try {
  const app = require('../backend/app.js');
  console.log('App cargada correctamente');
  console.log('Tipo de app:', typeof app);
  console.log('===========================');
  module.exports = app;
} catch (err) {
  console.error('Error cargando app:', err.message);
  console.error('Stack:', err.stack);
  
  const express = require('express');
  const errorApp = express();
  errorApp.use(express.json());
  errorApp.get('*', (req, res) => {
    res.status(500).json({ 
      error: 'Error cargando backend', 
      message: err.message,
      stack: err.stack 
    });
  });
  errorApp.post('*', (req, res) => {
    res.status(500).json({ 
      error: 'Error cargando backend (POST)', 
      message: err.message,
      stack: err.stack 
    });
  });
  module.exports = errorApp;
}
