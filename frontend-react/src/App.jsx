import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import AppShell from "./layout/AppShell"; // tu layout lateral que ya tenés
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./components/Home";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Tickets from "./components/Tickets";
import Recuperar from "./components/Recuperar";
import ResetPassword from "./components/ResetPassword";
import StatsPage from "./components/StatsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Home />} />

            {/* Público (si ya está logueado, igual puede entrar; si querés, podríamos redirigir) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Rutas para cualquier usuario logueado */}
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Tickets />
                </ProtectedRoute>
              }
            />

            {/* Rutas restringidas por rol */}
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

            {/* Recuperación / Reset (públicas) */}
            <Route path="/recuperar" element={<Recuperar />} />
            <Route path="/reset/:token" element={<ResetPassword />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  );
}
