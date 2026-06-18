// src/api.js
import axios from 'axios';

// Obtener la URL de la variable de entorno
const API_URL = import.meta.env.VITE_BACKEND_URL || '';

// Si no hay URL, usar una ruta relativa (no localhost)
const BASE_URL = API_URL || '';

const API = axios.create({
  baseURL: BASE_URL,
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