// src/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001',
  timeout: 10000
});

const handle = (p) => p.then(res => res.data).catch(err => {
  // Normalizar el error para que los componentes lo manejen consistentemente
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

// Export default por si prefieres usar la instancia directamente
export default API;