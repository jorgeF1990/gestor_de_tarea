import axios from 'axios';

// Configuración unificada de API
const getBaseURL = () => {
  // En producción usar la URL de Vercel
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'https://tareasync.vercel.app';
  }
  // En desarrollo usar el proxy de Vite
  return import.meta.env.VITE_API_URL || '';
};

const API_BASE_URL = getBaseURL();

console.log('[API] Environment:', import.meta.env.MODE);
console.log('[API] Base URL:', API_BASE_URL);

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor de Request - Token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log en desarrollo
    if (import.meta.env.DEV) {
      console.log('[API Request]', config.method.toUpperCase(), config.url);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Response - Manejo de errores
API.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('[API Response]', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    
    console.error('[API Error]', status, data?.message || error.message);
    
    // Manejo de 401 - Token expirado
    if (status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/register') &&
          !window.location.pathname.includes('/recuperar')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// AUTH ENDPOINTS
// ============================================
export const login = (data) => API.post('/auth/login', data).then(res => res.data);
export const register = (data) => API.post('/auth/register', data).then(res => res.data);
export const recuperarPassword = (email) => API.post('/auth/recuperar', { email }).then(res => res.data);
export const resetPassword = (token, nuevaPassword) => API.post(`/auth/reset/${token}`, { nuevaPassword }).then(res => res.data);
export const logout = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

// ============================================
// TICKETS ENDPOINTS
// ============================================
export const getTickets = (params = {}) => API.get('/tickets', { params }).then(res => res.data);
export const getTicket = (id) => API.get(`/tickets/${id}`).then(res => res.data);
export const createTicket = (data) => API.post('/tickets', data).then(res => res.data);
export const updateTicketStatus = (id, estado) => API.put(`/tickets/${id}/estado`, { estado }).then(res => res.data);
export const addComment = (id, data) => API.put(`/tickets/${id}/comentario`, data).then(res => res.data);
export const markAsRead = (id) => API.put(`/tickets/${id}/leido`, {}).then(res => res.data);
export const deleteTicket = (id) => API.delete(`/tickets/${id}`).then(res => res.data);
export const silenciarTicket = (id, dias = 30) => API.post(`/tickets/${id}/silenciar`, { dias }).then(res => res.data);
export const reanudarTicket = (id) => API.post(`/tickets/${id}/reanudar`, {}).then(res => res.data);
export const getAsignados = (id) => API.get(`/tickets/${id}/asignados`).then(res => res.data);
export const asignarUsuario = (id, usuarioId) => API.post(`/tickets/${id}/asignar`, { usuarioId }).then(res => res.data);
export const desasignarUsuario = (id, usuarioId) => API.delete(`/tickets/${id}/asignar/${usuarioId}`).then(res => res.data);
export const getUsuariosDisponibles = () => API.get('/tickets/usuarios/disponibles').then(res => res.data);

// ============================================
// ADMIN ENDPOINTS
// ============================================
export const getUsuarios = () => API.get('/admin/usuarios').then(res => res.data);
export const updateUsuario = (id, data) => API.put(`/admin/usuarios/${id}`, data).then(res => res.data);
export const generarRecurrentes = () => API.post('/admin/generar-recurrentes').then(res => res.data);

// ============================================
// CALENDAR ENDPOINTS
// ============================================
export const syncGoogleCalendar = (id) => API.post(`/tickets/${id}/sync-google`).then(res => res.data);
export const syncOutlookCalendar = (id) => API.post(`/tickets/${id}/sync-outlook`).then(res => res.data);
export const getGoogleStatus = () => API.get('/calendar/status/google').then(res => res.data);
export const getOutlookStatus = () => API.get('/calendar/status/outlook').then(res => res.data);
export const disconnectGoogle = () => API.post('/calendar/disconnect/google').then(res => res.data);
export const disconnectOutlook = () => API.post('/calendar/disconnect/outlook').then(res => res.data);

// ============================================
// EXPORT DEFAULT
// ============================================
export default API;