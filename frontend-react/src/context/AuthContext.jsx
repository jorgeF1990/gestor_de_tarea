import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  login: async (token, opts) => {},
  logout: () => {},
  hasRole: (roles) => false,
  updateUser: (data) => {}
});

function getInitialToken() {
  const ls = localStorage.getItem("token");
  if (ls) return ls;
  const ss = sessionStorage.getItem("token");
  if (ss) return ss;
  return null;
}

function decodeToken(token) {
  try {
    const decoded = jwtDecode(token);
    const exp = decoded.exp ? decoded.exp * 1000 : null;
    
    if (exp && Date.now() >= exp) {
      return null;
    }
    
    return {
      id: decoded.id || decoded._id || decoded.sub,
      email: decoded.email,
      rol: decoded.rol || "usuario",
      nombre: decoded.nombre || decoded.name || "Usuario",
      exp: exp
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getInitialToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
        // Auto-refresh si el token expira pronto (5 min)
        if (decoded.exp && decoded.exp - Date.now() < 300000) {
          console.warn('[Auth] Token expira pronto, redirigiendo a refresh');
          // Aquí se podría implementar refresh token
        }
      } else {
        // Token inválido o expirado
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Error decodificando token:', error);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (newToken, opts = { remember: true }) => {
    setToken(newToken);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    
    if (opts.remember) {
      localStorage.setItem("token", newToken);
    } else {
      sessionStorage.setItem("token", newToken);
    }
    
    const decoded = decodeToken(newToken);
    if (decoded) {
      setUser(decoded);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  }, []);

  const hasRole = useCallback((roles) => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.rol);
  }, [user]);

  const updateUser = useCallback((data) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!user && !!token,
    loading,
    login,
    logout,
    hasRole,
    updateUser
  }), [user, token, loading, login, logout, hasRole, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}