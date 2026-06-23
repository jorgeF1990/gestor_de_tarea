const axios = require('axios');
const fs = require('fs');
const path = require('path');

class OutlookCalendarService {
  constructor() {
    this.tokensDir = path.join(__dirname, '../tokens');
  }

  getAuthUrl(ticketId = null) {
    const state = ticketId ? JSON.stringify({ ticketId }) : null;
    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read offline_access',
      response_mode: 'query'
    });
    if (state) params.append('state', state);
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async getTokensFromCode(code) {
    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      code: code,
      redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  }

  async refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  }

  saveTokens(userId, tokens) {
    if (!fs.existsSync(this.tokensDir)) fs.mkdirSync(this.tokensDir, { recursive: true });
    const tokensPath = path.join(this.tokensDir, `outlook_${userId}.json`);
    fs.writeFileSync(tokensPath, JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      expiryDate: Date.now() + (tokens.expires_in * 1000)
    }));
  }

  loadTokens(userId) {
    const tokensPath = path.join(this.tokensDir, `outlook_${userId}.json`);
    if (fs.existsSync(tokensPath)) return JSON.parse(fs.readFileSync(tokensPath));
    return null;
  }

  async hasValidTokens(userId) {
    try {
      const tokens = this.loadTokens(userId);
      if (!tokens) return false;
      if (tokens.expiryDate && tokens.expiryDate < Date.now()) {
        const newTokens = await this.refreshAccessToken(tokens.refreshToken);
        this.saveTokens(userId, newTokens);
      }
      return true;
    } catch (error) {
      console.error('Error verificando tokens Outlook:', error.message);
      return false;
    }
  }

  async getValidAccessToken(userId) {
    const tokens = this.loadTokens(userId);
    if (!tokens) return null;
    if (tokens.expiryDate && tokens.expiryDate < Date.now()) {
      const newTokens = await this.refreshAccessToken(tokens.refreshToken);
      this.saveTokens(userId, newTokens);
      return newTokens.access_token;
    }
    return tokens.accessToken;
  }

  async createEvent(userId, eventData) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) throw new Error('Usuario no autenticado con Outlook');
      const event = {
        subject: eventData.summary,
        body: { contentType: 'HTML', content: eventData.description },
        start: { dateTime: eventData.startDateTime, timeZone: eventData.timeZone || 'America/Buenos_Aires' },
        end: { dateTime: eventData.endDateTime, timeZone: eventData.timeZone || 'America/Buenos_Aires' },
        location: { displayName: eventData.location || 'TaskNest' },
        isReminderOn: true,
        reminderMinutesBeforeStart: 30
      };
      if (eventData.attendees?.length) {
        event.attendees = eventData.attendees.map(email => ({ emailAddress: { address: email }, type: 'required' }));
      }
      const response = await axios.post('https://graph.microsoft.com/v1.0/me/events', event, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      });
      return { success: true, eventId: response.data.id, eventLink: response.data.webLink, onlineMeetingUrl: response.data.onlineMeeting?.joinUrl || null };
    } catch (error) {
      console.error('Error creando evento en Outlook:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateEvent(userId, eventId, eventData) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) throw new Error('Usuario no autenticado con Outlook');
      const event = {
        subject: eventData.summary,
        body: { contentType: 'HTML', content: eventData.description },
        start: { dateTime: eventData.startDateTime, timeZone: eventData.timeZone || 'America/Buenos_Aires' },
        end: { dateTime: eventData.endDateTime, timeZone: eventData.timeZone || 'America/Buenos_Aires' }
      };
      const response = await axios.patch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, event, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      });
      return { success: true, eventId: response.data.id, eventLink: response.data.webLink };
    } catch (error) {
      console.error('Error actualizando evento en Outlook:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteEvent(userId, eventId) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) throw new Error('Usuario no autenticado con Outlook');
      await axios.delete(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return { success: true };
    } catch (error) {
      console.error('Error eliminando evento de Outlook:', error.response?.data || error.message);
      throw error;
    }
  }

  disconnect(userId) {
    const tokensPath = path.join(this.tokensDir, `outlook_${userId}.json`);
    if (fs.existsSync(tokensPath)) fs.unlinkSync(tokensPath);
    return { success: true };
  }
}

module.exports = new OutlookCalendarService();