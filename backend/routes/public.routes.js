const express = require('express');
const router = express.Router();
const Ticket = require('../models/ticket.model');

router.get('/silenciar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const ticket = await Ticket.findById(token);
    
    if (!ticket) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Tarea no encontrada</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
            .container { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
            .error { color: #ef4444; font-size: 48px; margin-bottom: 16px; }
            h1 { color: #1e293b; margin-bottom: 8px; }
            p { color: #64748b; margin-bottom: 24px; }
            .btn { display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">✗</div>
            <h1>Tarea no encontrada</h1>
            <p>La tarea que buscas no existe o fue eliminada.</p>
            <a href="${process.env.FRONTEND_URL || 'https://tareasync.vercel.app'}" class="btn">Ir al inicio</a>
          </div>
        </body>
        </html>
      `);
    }
    
    const silenciarHasta = new Date();
    silenciarHasta.setDate(silenciarHasta.getDate() + 30);
    
    ticket.silenciar_notificaciones_hasta = silenciarHasta;
    ticket.notificaciones_habilitadas = false;
    await ticket.save();
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://tareasync.vercel.app';
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notificaciones silenciadas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafc;
          }
          .container {
            background: #ffffff;
            padding: 48px 40px;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            text-align: center;
            max-width: 480px;
            width: 90%;
            border: 1px solid #e2e8f0;
          }
          .icon {
            width: 64px;
            height: 64px;
            background: #ecfdf5;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 16px;
            color: #10b981;
            font-size: 32px;
          }
          h1 {
            color: #0f172a;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .subtitle {
            color: #475569;
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          .badge {
            display: inline-block;
            background: #f1f5f9;
            color: #475569;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-bottom: 24px;
          }
          .btn {
            display: inline-block;
            background: #4f46e5;
            color: #ffffff;
            padding: 10px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: background 0.2s;
          }
          .btn:hover {
            background: #4338ca;
          }
          .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✓</div>
          <h1>Notificaciones silenciadas</h1>
          <p class="subtitle">
            No recibirás más recordatorios sobre esta tarea por 30 días.
            <br>
            <span style="font-size: 13px; color: #64748b;">
              Hasta: ${silenciarHasta.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </p>
          <div class="badge">Tarea #${ticket.numero_ticket || 'Sin número'}</div>
          <br>
          <a href="${frontendUrl}/tickets/${ticket._id}" class="btn">Ver tarea</a>
          <div class="footer">TareaSync • Sistema de gestión de tareas</div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error al silenciar:', error.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
          .container { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
          .error { color: #ef4444; font-size: 48px; margin-bottom: 16px; }
          h1 { color: #1e293b; margin-bottom: 8px; }
          p { color: #64748b; margin-bottom: 24px; }
          .btn { display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Error</h1>
          <p>Ocurrió un error al procesar tu solicitud. Por favor, intentá nuevamente.</p>
          <a href="${process.env.FRONTEND_URL || 'https://tareasync.vercel.app'}" class="btn">Ir al inicio</a>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;