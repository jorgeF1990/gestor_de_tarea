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
// INTERCEPTOR - SIEMPRE USAR localStorage
// ============================================
API.interceptors.request.use(
  (config) => {
    // Siempre leer de localStorage directamente
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.log('Interceptor - URL:', config.url);
    console.log('Interceptor - Token existe:', !!token);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Interceptor - Token agregado');
    } else {
      console.warn('Interceptor - No hay token');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
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

const handle = (p) => p.then(res => res.data).catch(err => {
  if (err?.response?.data) throw err.response.data;
  if (err?.message) throw { message: err.message };
  throw err;
});

export const login = (data) => handle(API.post('/auth/login', data));
export const register = (data) => handle(API.post('/auth/register', data));
export const getTickets = () => handle(API.get('/tickets'));
export const recuperarPassword = (email) => handle(API.post('/auth/recuperar', { email }));
export const resetPassword = (token, nuevaPassword) => handle(API.post(`/auth/reset/${token}`, { nuevaPassword }));

export default API;
