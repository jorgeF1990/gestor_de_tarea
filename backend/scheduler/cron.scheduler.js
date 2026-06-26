const cron = require('node-cron');
const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const User = require('../models/User');
const { enviarCorreoTicket } = require('../utils/mailer');
const { generarTicketsRecurrentes } = require('../controllers/tickets.controller');

const ESTADOS_FINALES = ['cerrado', 'resuelto', 'cancelado', 'archivado', 'archivada'];
const isVercel = process.env.VERCEL === '1';
let schedulerInitialized = false;

const getEmailsInvolucrados = async (ticket) => {
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
      } catch (e) {
        console.warn('[SCHEDULER] Error obteniendo emails de usuarios:', e.message);
      }
    }
  }
  
  todosInvolucrados.push('envios@portfolioinvestment.com.ar');
  
  return [...new Set(todosInvolucrados.filter(Boolean))];
};

const getDescripcionRecordatorio = (tipo) => {
  const descripciones = {
    '30_dias': 'Esta tarea vence en 30 dias. Te recomendamos planificar su ejecucion.',
    '21_dias': 'Esta tarea vence en 3 semanas.',
    '14_dias': 'Esta tarea vence en 2 semanas.',
    '7_dias': 'IMPORTANTE: Esta tarea vence en 7 dias.',
    '3_dias': 'URGENTE: Esta tarea vence en 3 dias.',
    '1_dia': 'ATENCION: Esta tarea vence MAÑANA.',
    'hoy': 'URGENTE: Esta tarea vence HOY.',
    'vencida_1': 'Esta tarea vencio. Por favor, actualiza su estado.',
    'vencida_3': 'Esta tarea vencio hace varios dias. Requiere atencion.',
    'vencida_7': 'Esta tarea vencio hace 1 semana. Por favor, resuelvela.',
    'vencida_14': 'Esta tarea vencio hace 2 semanas. Necesita atencion urgente.',
    'vencida_30': 'Esta tarea vencio hace 1 MES. Por favor, toma accion inmediata.',
    'proximo_recordatorio': 'Recordatorio de vencimiento proximo.',
    'vencido_recordatorio': 'La tarea ha vencido. Por favor, toma accion.'
  };
  return descripciones[tipo] || 'Recordatorio de vencimiento';
};

const revisarTareasVencimiento = async () => {
  if (isVercel) {
    console.log('[SCHEDULER] Saltando ejecucion en Vercel serverless');
    return;
  }

  console.log(`[${new Date().toISOString()}] Iniciando revision de tareas para vencimiento...`);
  
  if (mongoose.connection.readyState !== 1) {
    console.warn('[SCHEDULER] MongoDB no esta conectado. Intentando reconectar...');
    try {
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
      console.log('[SCHEDULER] MongoDB reconectado');
    } catch (e) {
      console.error('[SCHEDULER] No se pudo reconectar a MongoDB, abortando revision:', e.message);
      return;
    }
  }
  
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const tareasAVencer = await Ticket.find({
      estado: { $nin: ESTADOS_FINALES },
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
      console.log('[SCHEDULER] No hay tareas para evaluar notificaciones.');
      return;
    }
    
    console.log(`[SCHEDULER] ${tareasAVencer.length} tareas para evaluar`);
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
          tipoNotificacion = '30_dias';
          debeNotificar = true;
        } else if (diasHastaVencimiento >= 20 && diasHastaVencimiento <= 22 && diasDesdeUltimaNotif > 7) {
          tipoNotificacion = '21_dias';
          debeNotificar = true;
        } else if (diasHastaVencimiento >= 13 && diasHastaVencimiento <= 15 && diasDesdeUltimaNotif > 7) {
          tipoNotificacion = '14_dias';
          debeNotificar = true;
        } else if (diasHastaVencimiento >= 5 && diasHastaVencimiento <= 7 && diasDesdeUltimaNotif > 3) {
          tipoNotificacion = '7_dias';
          debeNotificar = true;
        } else if (diasHastaVencimiento >= 2 && diasHastaVencimiento <= 3 && diasDesdeUltimaNotif > 1) {
          tipoNotificacion = '3_dias';
          debeNotificar = true;
        } else if (diasHastaVencimiento === 1 && diasDesdeUltimaNotif > 0) {
          tipoNotificacion = '1_dia';
          debeNotificar = true;
        } else if (diasHastaVencimiento === 0 && diasDesdeUltimaNotif > 0) {
          tipoNotificacion = 'hoy';
          debeNotificar = true;
        }
      }
      
      if (esVencida && !ESTADOS_FINALES.includes(tarea.estado)) {
        if (diasVencida >= 1 && diasVencida <= 2 && diasDesdeUltimaNotif > 1) {
          tipoNotificacion = 'vencida_1';
          debeNotificar = true;
        } else if (diasVencida >= 3 && diasVencida <= 5 && diasDesdeUltimaNotif > 3) {
          tipoNotificacion = 'vencida_3';
          debeNotificar = true;
        } else if (diasVencida >= 6 && diasVencida <= 10 && diasDesdeUltimaNotif > 5) {
          tipoNotificacion = 'vencida_7';
          debeNotificar = true;
        } else if (diasVencida >= 11 && diasVencida <= 20 && diasDesdeUltimaNotif > 10) {
          tipoNotificacion = 'vencida_14';
          debeNotificar = true;
        } else if (diasVencida >= 21 && diasDesdeUltimaNotif > 15) {
          tipoNotificacion = 'vencida_30';
          debeNotificar = true;
        }
      }
      
      if (debeNotificar && tipoNotificacion) {
        try {
          const destinatarios = await getEmailsInvolucrados(tarea);
          
          if (destinatarios.length > 0) {
            const appUrl = process.env.APP_URL || 'https://tareasync.vercel.app';
            const emailData = {
              ...tarea.toObject(),
              APP_URL: appUrl,
              diasHastaVencimiento: Math.abs(diasHastaVencimiento),
              esVencida,
              tipoNotificacion,
              descripcionRecordatorio: getDescripcionRecordatorio(tipoNotificacion)
            };
            
            await enviarCorreoTicket(emailData, destinatarios, null, tipoNotificacion);
            
            await Ticket.findOneAndUpdate(
              { _id: tarea._id },
              { 
                $set: { 
                  last_vencimiento_notification: new Date(), 
                  ultimo_recordatorio_enviado: tipoNotificacion 
                } 
              }
            );
            
            notificacionesEnviadas++;
            console.log(`[SCHEDULER] Recordatorio enviado: #${tarea.numero_ticket} (${tipoNotificacion}) - Destinatarios: ${destinatarios.length}`);
          }
        } catch (mailError) {
          console.error(`[SCHEDULER] Error enviando recordatorio para #${tarea.numero_ticket}:`, mailError.message);
        }
      }
    }
    
    console.log(`[SCHEDULER] Revision completada. Notificaciones enviadas: ${notificacionesEnviadas}`);
    
  } catch (err) {
    console.error('[SCHEDULER] Error en revision programada de tareas:', err.message);
  }
};

const startScheduler = () => {
  if (isVercel) {
    console.log('[SCHEDULER] Deshabilitado en entorno Vercel serverless');
    return;
  }

  if (schedulerInitialized) {
    console.log('[SCHEDULER] Scheduler ya inicializado');
    return;
  }

  schedulerInitialized = true;

  console.log('[SCHEDULER] Iniciando scheduler de notificaciones...');
  
  try {
    revisarTareasVencimiento().catch(err => 
      console.error('[SCHEDULER] Error en revision inicial:', err)
    );
    
    cron.schedule('40 9 * * *', async () => {
      console.log('[SCHEDULER] CRON (09:40): Ejecutando revision de vencimientos...');
      await revisarTareasVencimiento();
    }, { timezone: 'America/Buenos_Aires' });
    
    cron.schedule('10 10 * * *', async () => {
      console.log('[SCHEDULER] CRON (10:10): Generando tickets recurrentes...');
      try {
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        }
        const resultado = await generarTicketsRecurrentes();
        console.log(`[SCHEDULER] Recurrencia: ${resultado.generados} generados de ${resultado.revisados} revisados`);
      } catch (error) {
        console.error('[SCHEDULER] Error en generacion recurrente:', error.message);
      }
    }, { timezone: 'America/Buenos_Aires' });
    
    cron.schedule('0 18 * * *', async () => {
      console.log('[SCHEDULER] CRON (18:00): Ejecutando revision de vencimientos...');
      await revisarTareasVencimiento();
    }, { timezone: 'America/Buenos_Aires' });

    console.log('[SCHEDULER] Scheduler iniciado correctamente');
    console.log('[SCHEDULER] Horarios: 09:40 y 18:00 (vencimientos) | 10:10 (recurrentes)');
  } catch (error) {
    console.error('[SCHEDULER] Error al iniciar:', error.message);
  }
};

const ejecutarRevisionManual = async () => {
  console.log('[SCHEDULER] Ejecutando revision manual...');
  await revisarTareasVencimiento();
};

module.exports = { 
  startScheduler, 
  revisarTareasVencimiento,
  ejecutarRevisionManual
};