import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext({
  user: null,
  token: null,
  login: async (_token, _opts) => {},
  logout: () => {},
  hasRole: () => false,
});

function readInitialToken() {
  const ls = localStorage.getItem("token");
  if (ls) return ls;
  const ss = sessionStorage.getItem("token");
  if (ss) return ss;
  return null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readInitialToken());
  const [user, setUser] = useState(() => {
    const t = readInitialToken();
    if (!t) return null;
    try {
      const p = jwtDecode(t);
      return { id: p.id || p._id || p.sub, email: p.email, rol: p.rol || "usuario" };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      return;
    }
    try {
      const p = jwtDecode(token);
      const exp = p.exp ? p.exp * 1000 : null;
      if (exp && Date.now() >= exp) {
        setUser(null);
        setToken(null);
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        return;
      }
      setUser({ id: p.id || p._id || p.sub, email: p.email, rol: p.rol || "usuario" });
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
    }
  }, [token]);

  const hasRole = useCallback((roles) => {
    if (!user) return false;
    const list = Array.isArray(roles) ? roles : [roles];
    return list.includes(user.rol);
  }, [user]);

  const login = useCallback(async (newToken, opts = { remember: true }) => {
    setToken(newToken);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    if (opts.remember) {
      localStorage.setItem("token", newToken);
    } else {
      sessionStorage.setItem("token", newToken);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  }, []);

  const value = useMemo(() => ({ user, token, login, logout, hasRole }), [user, token, login, logout, hasRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
