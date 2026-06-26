const mongoose = require('mongoose');

// Usar conexión directa (sin SRV)
const uri = 'mongodb://admin:Tickets2026@tickets-cluster-shard-00-00.5mikqmi.mongodb.net:27017,tickets-cluster-shard-00-01.5mikqmi.mongodb.net:27017,tickets-cluster-shard-00-02.5mikqmi.mongodb.net:27017/tickets?ssl=true&replicaSet=atlas-l29n2h-shard-0&authSource=admin&retryWrites=true&w=majority&appName=tickets-cluster';

console.log('🌐 Conectando a MongoDB Atlas (directo)...');
console.log('📡 URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
})
.then(() => {
  console.log('✅ Conectado exitosamente a MongoDB Atlas');
  console.log('📊 Base de datos:', mongoose.connection.db.databaseName);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Error de conexión:', err.message);
  process.exit(1);
});
