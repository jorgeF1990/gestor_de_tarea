import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

/**
 * Uso:
 * <ProtectedRoute roles={['admin','soporte']}>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * Si no pasás roles, solo requiere estar logueado.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, isAuthenticated, loading } = useContext(AuthContext);
  const location = useLocation();

  //  Esperar a que termine la carga del token
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="loader"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando sesión...</p>
      </div>
    );
  }

  //  Usar isAuthenticated en lugar de solo user
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  //  Verificar roles correctamente
  if (roles && roles.length > 0) {
    const roleList = Array.isArray(roles) ? roles : [roles];
    if (!roleList.includes(user?.rol)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}