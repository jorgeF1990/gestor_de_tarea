const express = require('express');
const router = express.Router();
const Ticket = require('../models/ticket.model');

// Endpoint público para silenciar notificaciones (desde el email)
router.get('/silenciar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // El token sería un hash único generado para el ticket
    // Por simplicidad, puedes usar el ID del ticket
    const ticket = await Ticket.findById(token);
    
    if (!ticket) {
      return res.status(404).send('Tarea no encontrada');
    }
    
    const silenciarHasta = new Date();
    silenciarHasta.setDate(silenciarHasta.getDate() + 30);
    
    ticket.silenciar_notificaciones_hasta = silenciarHasta;
    ticket.notificaciones_habilitadas = false;
    await ticket.save();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notificaciones silenciadas</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f0f2f5;
          }
          .container {
            background: white;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          }
          .success { color: #10b981; font-size: 48px; margin-bottom: 16px; }
          h1 { color: #1e293b; margin-bottom: 8px; }
          p { color: #64748b; margin-bottom: 24px; }
          .btn {
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Notificaciones silenciadas</h1>
          <p>No recibirás más recordatorios sobre esta tarea por 30 días.</p>
          <a href="${process.env.FRONTEND_URL}/tickets/${ticket._id}" class="btn">Ver tarea</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error al silenciar:', error);
    res.status(500).send('Error al procesar la solicitud');
  }
});

module.exports = router;