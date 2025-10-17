import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL
});

export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getTickets = (token) =>
  API.get('/tickets', { headers: { Authorization: `Bearer ${token}` } });