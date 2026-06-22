console.log('=== API INDEX ===');
console.log('Cargando backend/app.js...');

const app = require('../backend/app.js');

// Agregar ruta de debug
app.get('/debug-routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      });
    }
  });
  res.json({ routes });
});

console.log('App cargada correctamente');
module.exports = app;
