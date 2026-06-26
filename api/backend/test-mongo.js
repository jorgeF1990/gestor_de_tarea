const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin:Tickets2026@tickets-cluster.5mikqmi.mongodb.net/tickets?retryWrites=true&w=majority&appName=tickets-cluster';

console.log('🌐 Conectando a MongoDB Atlas...');
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
  console.error('🔍 Tipo de error:', err.name);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('💡 Sugerencia: Verifica que tu IP esté en la whitelist de MongoDB Atlas');
  } else if (err.message.includes('ENOTFOUND')) {
    console.error('💡 Sugerencia: Verifica tu conexión a Internet o usa una VPN');
  } else if (err.message.includes('Authentication failed')) {
    console.error('💡 Sugerencia: Verifica el usuario y contraseña en la URI');
  }
  process.exit(1);
});
