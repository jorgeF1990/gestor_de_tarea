import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Tickets from './components/Tickets';
import Recuperar from './components/Recuperar';
import ResetPassword from './components/ResetPassword';
import StatsPage from './components/StatsPage';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/reset/:token" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;