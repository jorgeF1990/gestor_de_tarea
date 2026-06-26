const express = require('express');
const router = express.Router();
const rootPath = require('app-root-path');

const auth = require(`${rootPath.path}/backend/middlewares/auth`);
const googleCalendarService = require(`${rootPath.path}/backend/services/googleCalendar.service`);
const outlookCalendarService = require(`${rootPath.path}/backend/services/outlookCalendar.service`);
const Ticket = require(`${rootPath.path}/backend/models/ticket.model`);

// ==================== GOOGLE CALENDAR ====================

router.get('/auth/google', auth, async (req, res) => {
  try {
    const { ticketId } = req.query;
    const authUrl = googleCalendarService.getAuthUrl(ticketId);
    req.session.calendarUserId = req.user.id;
    req.session.calendarTicketId = ticketId;
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error iniciando auth Google:', error.message);
    res.status(500).json({ error: 'Error al iniciar autenticación con Google' });
  }
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await googleCalendarService.getTokensFromCode(code);
    const userId = req.session.calendarUserId;
    const ticketId = req.session.calendarTicketId;
    
    if (userId) googleCalendarService.saveTokens(userId, tokens);
    
    delete req.session.calendarUserId;
    delete req.session.calendarTicketId;
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectPath = ticketId ? `/tickets/${ticketId}?calendar=google_connected` : '/dashboard?calendar=google_connected';
    res.redirect(`${frontendUrl}${redirectPath}`);
  } catch (error) {
    console.error('Error en callback Google:', error.message);
    res.status(500).send('Error de autenticación con Google');
  }
});

router.get('/status/google', auth, async (req, res) => {
  try {
    const isConnected = await googleCalendarService.hasValidTokens(req.user.id);
    res.json({ connected: isConnected });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

router.post('/ticket/:id/sync-google', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id).populate('usuario_id', 'email');
    
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    
    const isConnected = await googleCalendarService.hasValidTokens(req.user.id);
    if (!isConnected) {
      const authUrl = googleCalendarService.getAuthUrl(id);
      return res.status(401).json({ error: 'No conectado a Google Calendar', authUrl });
    }
    
    if (!ticket.fecha_vencimiento) {
      return res.status(400).json({ error: 'El ticket no tiene fecha de vencimiento' });
    }
    
    const startDateTime = new Date(ticket.fecha_vencimiento).toISOString();
    const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();
    
    const eventData = {
      summary: `[Ticket #${ticket.numero_ticket}] ${ticket.asunto}`,
      description: `${ticket.descripcion}\n\n---\nTicket ID: ${ticket._id}\nURL: ${process.env.FRONTEND_URL}/tickets/${ticket._id}`,
      startDateTime,
      endDateTime,
      timeZone: 'America/Buenos_Aires',
      location: 'Portfolio Investment',
      attendees: [ticket.usuario_id?.email].filter(Boolean)
    };
    
    const result = await googleCalendarService.createEvent(req.user.id, eventData);
    
    ticket.google_event_id = result.eventId;
    ticket.google_event_link = result.eventLink;
    ticket.last_calendar_sync = new Date();
    await ticket.save();
    
    res.json({ 
      success: true, 
      eventId: result.eventId, 
      eventLink: result.eventLink, 
      hangoutLink: result.hangoutLink 
    });
  } catch (error) {
    console.error('Error creando evento en Google Calendar:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/disconnect/google', auth, async (req, res) => {
  try {
    googleCalendarService.disconnect(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error desconectando Google:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== OUTLOOK CALENDAR ====================

router.get('/auth/outlook', auth, async (req, res) => {
  try {
    const { ticketId } = req.query;
    const authUrl = outlookCalendarService.getAuthUrl(ticketId);
    req.session.calendarUserId = req.user.id;
    req.session.calendarTicketId = ticketId;
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error iniciando auth Outlook:', error.message);
    res.status(500).json({ error: 'Error al iniciar autenticación con Outlook' });
  }
});

router.get('/auth/outlook/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await outlookCalendarService.getTokensFromCode(code);
    const userId = req.session.calendarUserId;
    const ticketId = req.session.calendarTicketId;
    
    if (userId) outlookCalendarService.saveTokens(userId, tokens);
    
    delete req.session.calendarUserId;
    delete req.session.calendarTicketId;
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectPath = ticketId ? `/tickets/${ticketId}?calendar=outlook_connected` : '/dashboard?calendar=outlook_connected';
    res.redirect(`${frontendUrl}${redirectPath}`);
  } catch (error) {
    console.error('Error en callback Outlook:', error.message);
    res.status(500).send('Error de autenticación con Outlook');
  }
});

router.get('/status/outlook', auth, async (req, res) => {
  try {
    const isConnected = await outlookCalendarService.hasValidTokens(req.user.id);
    res.json({ connected: isConnected });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

router.post('/ticket/:id/sync-outlook', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id).populate('usuario_id', 'email');
    
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    
    const isConnected = await outlookCalendarService.hasValidTokens(req.user.id);
    if (!isConnected) {
      const authUrl = outlookCalendarService.getAuthUrl(id);
      return res.status(401).json({ error: 'No conectado a Outlook Calendar', authUrl });
    }
    
    if (!ticket.fecha_vencimiento) {
      return res.status(400).json({ error: 'El ticket no tiene fecha de vencimiento' });
    }
    
    const startDateTime = new Date(ticket.fecha_vencimiento).toISOString();
    const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();
    
    const eventData = {
      summary: `[Ticket #${ticket.numero_ticket}] ${ticket.asunto}`,
      description: `${ticket.descripcion}\n\n---\nTicket ID: ${ticket._id}\nURL: ${process.env.FRONTEND_URL}/tickets/${ticket._id}`,
      startDateTime,
      endDateTime,
      timeZone: 'America/Buenos_Aires',
      location: 'Portfolio Investment',
      attendees: [ticket.usuario_id?.email].filter(Boolean)
    };
    
    const result = await outlookCalendarService.createEvent(req.user.id, eventData);
    
    ticket.outlook_event_id = result.eventId;
    ticket.outlook_event_link = result.eventLink;
    ticket.last_calendar_sync = new Date();
    await ticket.save();
    
    res.json({ 
      success: true, 
      eventId: result.eventId, 
      eventLink: result.eventLink, 
      onlineMeetingUrl: result.onlineMeetingUrl 
    });
  } catch (error) {
    console.error('Error creando evento en Outlook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/disconnect/outlook', auth, async (req, res) => {
  try {
    outlookCalendarService.disconnect(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error desconectando Outlook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;