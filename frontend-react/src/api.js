import axios from 'axios';

// ============================================
// API CONFIGURATION - URL EXPLICITA
// ============================================
// Usar URL fija para evitar problemas con variables de entorno
const API_URL = 'https://tareasync.vercel.app';

console.log('[API] URL:', API_URL);

const API = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true
});

// ============================================
// REQUEST INTERCEPTOR - AUTH TOKEN
// ============================================
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.log('[API] Request:', config.method.toUpperCase(), config.url);
    console.log('[API] Full URL:', config.baseURL + config.url);
    console.log('[API] Token exists:', !!token);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API] Token attached');
    } else {
      console.warn('[API] No token available');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// RESPONSE INTERCEPTOR - ERROR HANDLING
// ============================================
API.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('[API] Error:', error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================
// API HELPERS
// ============================================
const handle = (p) => p.then(res => res.data).catch(err => {
  if (err?.response?.data) throw err.response.data;
  if (err?.message) throw { message: err.message };
  throw err;
});

// ============================================
// AUTH ENDPOINTS
// ============================================
export const login = (data) => handle(API.post('/auth/login', data));
export const register = (data) => handle(API.post('/auth/register', data));
export const recuperarPassword = (email) => handle(API.post('/auth/recuperar', { email }));
export const resetPassword = (token, nuevaPassword) => handle(API.post(`/auth/reset/${token}`, { nuevaPassword }));

// ============================================
// TICKETS ENDPOINTS
// ============================================
export const getTickets = () => handle(API.get('/tickets'));

// ============================================
// EXPORT DEFAULT
// ============================================
export default API;
