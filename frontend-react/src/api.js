// src/api.js
import axios from 'axios';

// FORZAR URL DE PRODUCCION
// Si estas en localhost, usa localhost:5001
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_URL = isLocalhost 
  ? 'http://localhost:5001' 
  : 'https://gestor-de-tarea-jorgesfb29-gmailcoms-projects.vercel.app';

console.log('API_URL:', API_URL); // Para verificar en consola

const API = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true
});

// Solo para desarrollo local
if (import.meta.env.DEV && !API_URL) {
  API.defaults.baseURL = 'http://localhost:5001';
}

const handle = (p) => p.then(res => res.data).catch(err => {
  if (err?.response?.data) throw err.response.data;
  if (err?.message) throw { message: err.message };
  throw err;
});

// Autenticación
export const login = (data) => handle(API.post('/auth/login', data));
export const register = (data) => handle(API.post('/auth/register', data));

// Tickets
export const getTickets = (token) =>
  handle(API.get('/tickets', { headers: { Authorization: `Bearer ${token}` } }));

// Recuperación de contraseña
export const recuperarPassword = (email) =>
  handle(API.post('/auth/recuperar', { email }));

export const resetPassword = (token, nuevaPassword) =>
  handle(API.post(`/auth/reset/${token}`, { nuevaPassword }));

export default API;