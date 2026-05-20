const cron = require('node-cron');
const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const { enviarCorreoTicket } = require('../utils/mailer');
const { generarTicketsRecurrentes } = require('../controllers/tickets.controller');

// Función para obtener destinatarios con respeto a preferencias
const getDestinatariosConPreferencias = async (tarea, usuariosIds) => {
  const usuarios = await User.find({ 
    _id: { $in: usuariosIds },
    'notificaciones.recordatorios_vencimiento': true,
    $or: [
      { silenciar_notificaciones_hasta: { $exists: false } },
      { silenciar_notificaciones_hasta: null },
      { silenciar_notificaciones_hasta: { $lt: new Date() } }
    ]
  });
  
  return usuarios.map(u => u.email).filter(Boolean);
};

// Función para obtener TODOS los emails involucrados en una tarea
async function getEmailsInvolucrados(ticket) {
  let todosInvolucrados = [];
  
  if (ticket.usuario_id?.email) {
    todosInvolucrados.push(ticket.usuario_id.email);
  }
  
  if (ticket.asignados && ticket.asignados.length > 0) {
    const emailsAsignados = ticket.asignados
      .filter(a => a && a.email)
      .map(a => a.email);
    todosInvolucrados.push(...emailsAsignados);
    
    const idsNoPopulados = ticket.asignados
      .filter(a => (typeof a === 'string') || (a && !a.email))
      .map(a => (a._id || a).toString())
      .filter(Boolean);
    
    if (idsNoPopulados.length > 0) {
      try {
        const usuarios = await User.find({ _id: { $in: idsNoPopulados } }, 'email');
        todosInvolucrados.push(...usuarios.map(u => u.email).filter(Boolean));
      } catch (e) {}
    }
  }
  
  todosInvolucrados.push('envios@portfolioinvestment.com.ar');
  
  return [...new Set(todosInvolucrados.filter(Boolean))];
}

// Función principal: revisar tareas para notificaciones de vencimiento
const revisarTareasVencimiento = async () => {
  console.log(`[${new Date().toISOString()}] 🔔 Iniciando revisión de tareas para vencimiento...`);
  
  // VERIFICAR CONEXIÓN A MONGODB ANTES DE CONTINUAR
  if (mongoose.connection.readyState !== 1) {
    console.warn('⚠️ MongoDB no está conectado. Intentando reconectar...');
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB reconectado para el scheduler');
    } catch (e) {
      console.error('❌ No se pudo reconectar a MongoDB, abortando revisión');
      return;
    }
  }
  
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const tareasAVencer = await Ticket.find({
      estado: { $nin: ['cerrado', 'resuelto', 'cancelado', 'archivado', 'archivada'] },
      fecha_vencimiento: { $exists: true, $ne: null },
      notificaciones_habilitadas: true,
      $or: [
        { silenciar_notificaciones_hasta: { $exists: false } },
        { silenciar_notificaciones_hasta: null },
        { silenciar_notificaciones_hasta: { $lt: new Date() } }
      ]
    }).populate('usuario_id', 'email')
      .populate('asignados', 'email');
    
    if (tareasAVencer.length === 0) {
      console.log('No hay tareas para evaluar notificaciones.');
      return;
    }
    
    console.log(`📊 ${tareasAVencer.length} tareas para evaluar`);
    let notificacionesEnviadas = 0;
    
    for (const tarea of tareasAVencer) {
      const fechaVen = new Date(tarea.fecha_vencimiento);
      fechaVen.setHours(0, 0, 0, 0);
      
      const diasHastaVencimiento = Math.ceil((fechaVen - hoy) / (1000 * 60 * 60 * 24));
      const esVencida = fechaVen < hoy;
      const diasVencida = esVencida ? Math.abs(diasHastaVencimiento) : 0;
      
      let tipoNotificacion = null;
      let debeNotificar = false;
      
      const ultimaNotif = tarea.last_vencimiento_notification;
      const diasDesdeUltimaNotif = ultimaNotif 
        ? Math.ceil((hoy - new Date(ultimaNotif)) / (1000 * 60 * 60 * 24)) 
        : 999;
      
      if (!esVencida) {
        if (diasHastaVencimiento >= 28 && diasHastaVencimiento <= 32 && diasDesdeUltimaNotif > 7) {
          tipoNotificacion = '30_dias'; debeNotificar = true;
        } else if (diasHastaVencimiento >= 20 && diasHastaVencimiento <= 22 && diasDesdeUltimaNotif > 7) {
          tipoNotificacion = '21_dias'; debeNotificar = true;
        } else if (diasHastaVencimiento >= 13 && diasHastaVencimiento <= 15 && diasDesdeUltimaNotif > 7) {
          tipoNotificacion = '14_dias'; debeNotificar = true;
        } else if (diasHastaVencimiento >= 5 && diasHastaVencimiento <= 7 && diasDesdeUltimaNotif > 3) {
          tipoNotificacion = '7_dias'; debeNotificar = true;
        } else if (diasHastaVencimiento >= 2 && diasHastaVencimiento <= 3 && diasDesdeUltimaNotif > 1) {
          tipoNotificacion = '3_dias'; debeNotificar = true;
        } else if (diasHastaVencimiento === 1 && diasDesdeUltimaNotif > 0) {
          tipoNotificacion = '1_dia'; debeNotificar = true;
        } else if (diasHastaVencimiento === 0 && diasDesdeUltimaNotif > 0) {
          tipoNotificacion = 'hoy'; debeNotificar = true;
        }
      }
      
      if (esVencida && !['cerrado', 'resuelto', 'archivado', 'archivada'].includes(tarea.estado)) {
        if (diasVencida >= 1 && diasVencida <= 2 && diasDesdeUltimaNotif > 1) {
          tipoNotificacion = 'vencida_1'; debeNotificar = true;
        } else if (diasVencida >= 3 && diasVencida <= 5 && diasDesdeUltimaNotif > 3) {
          tipoNotificacion = 'vencida_3'; debeNotificar = true;
        } else if (diasVencida >= 6 && diasVencida <= 10 && diasDesdeUltimaNotif > 5) {
          tipoNotificacion = 'vencida_7'; debeNotificar = true;
        } else if (diasVencida >= 11 && diasVencida <= 20 && diasDesdeUltimaNotif > 10) {
          tipoNotificacion = 'vencida_14'; debeNotificar = true;
        } else if (diasVencida >= 21 && diasDesdeUltimaNotif > 15) {
          tipoNotificacion = 'vencida_30'; debeNotificar = true;
        }
      }
      
      if (debeNotificar && tipoNotificacion) {
        try {
          const destinatarios = await getEmailsInvolucrados(tarea);
          
          if (destinatarios.length > 0) {
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const emailData = {
              ...tarea.toObject(),
              APP_URL: appUrl,
              diasHastaVencimiento: Math.abs(diasHastaVencimiento),
              esVencida,
              tipoNotificacion,
              descripcionRecordatorio: getDescripcionRecordatorio(tipoNotificacion, diasHastaVencimiento)
            };
            
            await enviarCorreoTicket(emailData, destinatarios, null, tipoNotificacion);
            
            await Ticket.findOneAndUpdate(
              { _id: tarea._id },
              { $set: { last_vencimiento_notification: new Date(), ultimo_recordatorio_enviado: tipoNotificacion } }
            );
            
            notificacionesEnviadas++;
            console.log(`📧 Recordatorio enviado: #${tarea.numero_ticket} (${tipoNotificacion}) - ${diasHastaVencimiento} días - Destinatarios: ${destinatarios.length}`);
          }
        } catch (mailError) {
          console.error(`❌ Error enviando recordatorio para #${tarea.numero_ticket}:`, mailError.message);
        }
      }
    }
    
    console.log(`✅ Revisión completada. Notificaciones enviadas: ${notificacionesEnviadas}`);
    
  } catch (err) {
    console.error('❌ Error en revisión programada de tareas:', err.message);
  }
};

function getDescripcionRecordatorio(tipo, dias) {
  const descripciones = {
    '30_dias': 'Esta tarea vence en 30 días. Te recomendamos planificar su ejecución.',
    '21_dias': 'Esta tarea vence en 3 semanas.',
    '14_dias': 'Esta tarea vence en 2 semanas.',
    '7_dias': 'IMPORTANTE: Esta tarea vence en 7 días.',
    '3_dias': 'URGENTE: Esta tarea vence en 3 días.',
    '1_dia': 'ATENCIÓN: Esta tarea vence MAÑANA.',
    'hoy': 'URGENTE: Esta tarea vence HOY.',
    'vencida_1': 'Esta tarea venció. Por favor, actualiza su estado.',
    'vencida_3': 'Esta tarea venció hace varios días. Requiere atención.',
    'vencida_7': 'Esta tarea venció hace 1 semana. Por favor, resuélvela.',
    'vencida_14': 'Esta tarea venció hace 2 semanas. Necesita atención urgente.',
    'vencida_30': 'Esta tarea venció hace 1 MES. Por favor, toma acción inmediata.'
  };
  return descripciones[tipo] || `Recordatorio de vencimiento`;
}

const startScheduler = () => {
    console.log('🚀 Ejecutando revisión inicial de vencimientos...');
    revisarTareasVencimiento().catch(err => console.error('Error en revisión inicial:', err));
    
    cron.schedule('40 9 * * *', async () => {
        console.log('CRON JOB (09:40): Ejecutando revisión de vencimientos...');
        await revisarTareasVencimiento();
    }, { timezone: "America/Buenos_Aires" });
    
    cron.schedule('10 10 * * *', async () => {
        console.log('CRON JOB (10:10): Generando tickets recurrentes...');
        try {
            if (mongoose.connection.readyState !== 1) {
                await mongoose.connect(process.env.MONGO_URI);
            }
            const resultado = await generarTicketsRecurrentes();
            console.log(`Resultado recurrencia: ${resultado.generados} tickets generados de ${resultado.revisados} revisados`);
        } catch (error) {
            console.error('Error en generación recurrente:', error.message);
        }
    }, { timezone: "America/Buenos_Aires" });
    
    cron.schedule('0 18 * * *', async () => {
        console.log('CRON JOB (18:00): Ejecutando revisión de vencimientos...');
        await revisarTareasVencimiento();
    }, { timezone: "America/Buenos_Aires" });

    console.log('✅ Scheduler de notificaciones y recurrencia iniciado.');
    console.log('   📅 09:40 y 18:00 → Revisión de vencimientos');
    console.log('   🔄 10:10 → Generación de tickets recurrentes');
    console.log('   ⚡ Ejecución inicial al arrancar el servidor');
};

module.exports = { startScheduler, revisarTareasVencimiento };