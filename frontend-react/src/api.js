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

let authToken = null;

export const setAuthToken = (token) => {
  console.log('setAuthToken llamado:', token ? 'Token recibido' : 'Token null');
  authToken = token;
};

API.interceptors.request.use(
  (config) => {
    console.log('Interceptor request - URL:', config.url);
    console.log('Interceptor request - authToken:', authToken ? 'Existe' : 'No existe');
    
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
      console.log('Interceptor request - Token agregado desde authToken');
    } else {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      console.log('Interceptor request - token de localStorage:', token ? 'Existe' : 'No existe');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Interceptor request - Token agregado desde localStorage');
      } else {
        console.warn('Interceptor request - No hay token disponible');
      }
    }
    
    console.log('Interceptor request - Headers finales:', config.headers);
    return config;
  },
  (error) => {
    console.error('Interceptor request error:', error);
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => {
    console.log('Interceptor response - Status:', response.status);
    return response;
  },
  (error) => {
    console.error('Interceptor response error:', error.response?.status, error.response?.data);
    if (error.response?.status === 401) {
      console.warn('Error 401 - Token inválido o expirado');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      authToken = null;
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

if (import.meta.env.DEV && !API_URL) {
  API.defaults.baseURL = 'http://localhost:5001';
}

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
