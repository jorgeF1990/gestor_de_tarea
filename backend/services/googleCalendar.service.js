const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = null;
    this.tokensDir = path.join(__dirname, '../tokens');
  }

  initOAuthClient() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    return this.oauth2Client;
  }

  getAuthUrl(ticketId = null) {
    if (!this.oauth2Client) this.initOAuthClient();
    const state = ticketId ? JSON.stringify({ ticketId }) : null;
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
      state: state
    });
  }

  async getTokensFromCode(code) {
    if (!this.oauth2Client) this.initOAuthClient();
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  saveTokens(userId, tokens) {
    if (!fs.existsSync(this.tokensDir)) {
      fs.mkdirSync(this.tokensDir, { recursive: true });
    }
    const tokensPath = path.join(this.tokensDir, `google_${userId}.json`);
    fs.writeFileSync(tokensPath, JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date
    }));
  }

  loadTokens(userId) {
    const tokensPath = path.join(this.tokensDir, `google_${userId}.json`);
    if (fs.existsSync(tokensPath)) {
      const data = JSON.parse(fs.readFileSync(tokensPath));
      if (!this.oauth2Client) this.initOAuthClient();
      this.oauth2Client.setCredentials({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        expiry_date: data.expiryDate
      });
      return true;
    }
    return false;
  }

  async hasValidTokens(userId) {
    try {
      const tokensPath = path.join(this.tokensDir, `google_${userId}.json`);
      if (!fs.existsSync(tokensPath)) return false;
      
      if (!this.oauth2Client) this.initOAuthClient();
      const data = JSON.parse(fs.readFileSync(tokensPath));
      this.oauth2Client.setCredentials({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        expiry_date: data.expiryDate
      });
      
      if (this.oauth2Client.isTokenExpiring()) {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.saveTokens(userId, credentials);
      }
      return true;
    } catch (error) {
      console.error('Error verificando tokens Google:', error.message);
      return false;
    }
  }

  async createEvent(userId, eventData) {
    try {
      if (!this.loadTokens(userId)) {
        throw new Error('Usuario no autenticado con Google Calendar');
      }
      
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.startDateTime,
          timeZone: eventData.timeZone || 'America/Buenos_Aires'
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: eventData.timeZone || 'America/Buenos_Aires'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };
      
      if (eventData.attendees?.length) {
        event.attendees = eventData.attendees.map(email => ({ email }));
      }
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all'
      });
      
      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink || null
      };
    } catch (error) {
      console.error('Error creando evento en Google Calendar:', error.message);
      throw error;
    }
  }

  async updateEvent(userId, eventId, eventData) {
    try {
      if (!this.loadTokens(userId)) {
        throw new Error('Usuario no autenticado con Google Calendar');
      }
      
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId
      });
      
      const event = {
        summary: eventData.summary || existingEvent.data.summary,
        description: eventData.description || existingEvent.data.description,
        start: {
          dateTime: eventData.startDateTime || existingEvent.data.start.dateTime,
          timeZone: eventData.timeZone || 'America/Buenos_Aires'
        },
        end: {
          dateTime: eventData.endDateTime || existingEvent.data.end.dateTime,
          timeZone: eventData.timeZone || 'America/Buenos_Aires'
        }
      };
      
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId,
        resource: event,
        sendUpdates: 'all'
      });
      
      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink
      };
    } catch (error) {
      console.error('Error actualizando evento en Google Calendar:', error.message);
      throw error;
    }
  }

  async deleteEvent(userId, eventId) {
    try {
      if (!this.loadTokens(userId)) {
        throw new Error('Usuario no autenticado con Google Calendar');
      }
      
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all'
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error eliminando evento de Google Calendar:', error.message);
      throw error;
    }
  }

  disconnect(userId) {
    const tokensPath = path.join(this.tokensDir, `google_${userId}.json`);
    if (fs.existsSync(tokensPath)) {
      fs.unlinkSync(tokensPath);
    }
    return { success: true };
  }
}

module.exports = new GoogleCalendarService();