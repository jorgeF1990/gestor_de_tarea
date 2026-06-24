// src/api.js
import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_URL = import.meta.env.VITE_API_URL 
  || import.meta.env.VITE_BACKEND_URL 
  || (isLocalhost ? 'http://localhost:5001' : 'https://tareasync.vercel.app');

console.log('API_URL:', API_URL);

const API = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true
});

// ============================================
// INTERCEPTOR: OBTENER TOKEN DEL CONTEXTO
// ============================================
// Variable global para acceder al token desde el interceptor
let authToken = null;

// Función para actualizar el token desde el contexto
export const setAuthToken = (token) => {
  authToken = token;
};

// Interceptor para agregar el token automáticamente
API.interceptors.request.use(
  (config) => {
    // Primero intentar usar el token del contexto
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    } else {
      // Fallback: leer de localStorage
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// INTERCEPTOR PARA MANEJAR ERRORES 401
// ============================================
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar token
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      authToken = null;
      
      // Redirigir al login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Solo para desarrollo local
if (import.meta.env.DEV && !API_URL) {
  API.defaults.baseURL = 'http://localhost:5001';
}

const handle = (p) => p.then(res => res.data).catch(err => {
  if (err?.response?.data) throw err.response.data;
  if (err?.message) throw { message: err.message };
  throw err;
});

// ============================================
// AUTENTICACIÓN
// ============================================
export const login = (data) => handle(API.post('/auth/login', data));
export const register = (data) => handle(API.post('/auth/register', data));

// ============================================
// TICKETS - SIN PARÁMETRO TOKEN
// ============================================
export const getTickets = () => handle(API.get('/tickets'));

// ============================================
// RECUPERACIÓN DE CONTRASEÑA
// ============================================
export const recuperarPassword = (email) =>
  handle(API.post('/auth/recuperar', { email }));

export const resetPassword = (token, nuevaPassword) =>
  handle(API.post(`/auth/reset/${token}`, { nuevaPassword }));

export default API;