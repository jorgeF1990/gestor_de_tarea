// src/api.js
import axios from 'axios';

// Usar la variable de entorno, sin fallback a localhost
const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const API = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true
});

// Para desarrollo local, si no hay variable, usa localhost
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