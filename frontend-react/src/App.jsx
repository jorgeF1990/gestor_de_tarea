import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import AppShell from "./layout/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";

// Layout y componentes
import Home from "./components/Home";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Tickets from "./components/Tickets";
import TareaDetail from "./components/TareaDetail";
import StatsPage from "./components/StatsPage";
import Recuperar from "./components/Recuperar";
import ResetPassword from "./components/ResetPassword";
import GestionUsuarios from "./components/GestionUsuarios";
import AsignarUsuarios from "./components/AsignarUsuarios";
import CalendarView from "./components/CalendarView";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recuperar" element={<Recuperar />} />
            <Route path="/reset/:token" element={<ResetPassword />} />

            {/* Protegidas - Usuarios autenticados */}
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Tickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tareas/:id"
              element={
                <ProtectedRoute>
                  <TareaDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tareas/:id/silenciar"
              element={
                <ProtectedRoute>
                  <TareaDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarView />
                </ProtectedRoute>
              }
            />

            {/* Protegidas - Solo Admin */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <StatsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <GestionUsuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/asignar"
              element={
                <ProtectedRoute roles={["admin", "soporte"]}>
                  <AsignarUsuarios />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  );
}