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
  const { user, hasRole } = useContext(AuthContext);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
