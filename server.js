// server.js - Para ejecutar localmente
require('dotenv').config();

const app = require('./api/index.js');
const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`[SERVER] Backend corriendo en http://localhost:${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] Ping DB: http://localhost:${PORT}/ping-db`);
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('[SERVER] Cerrando servidor...');
  server.close(() => {
    console.log('[SERVER] Servidor cerrado');
    process.exit(0);
  });
});