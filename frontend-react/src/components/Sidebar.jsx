import React, { useContext, useMemo } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { 
  Home, 
  Ticket, 
  LayoutDashboard, 
  BarChart3, 
  LogOut, 
  User, 
  LogIn, 
  UserPlus,
  Settings,
  Users,
  CalendarDays
} from 'lucide-react';
import { AuthContext } from "../context/AuthContext";
import "./Sidebar.css";

export default function Sidebar({ open, onToggle, isMobile, onClose }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
    if (isMobile && onClose) onClose();
  };

  const handleLinkClick = () => {
    if (isMobile && onClose) onClose();
  };

  const isAdmin = user?.rol === 'admin';
  const isSupport = user?.rol === 'soporte' || isAdmin;

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : "sidebar--closed"}`}>
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand" onClick={handleLinkClick}>
          <div className="sidebar-logo-wrap">
            <img src="/favicon.svg" alt="Logo" className="sidebar-logo" />
          </div>
          <div className="sidebar-brandtext">
            <div className="sidebar-title">TareaSync</div>
            <div className="sidebar-sub">Gestión de tareas</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">General</div>

          <NavLink to="/" className="sidebar-link" onClick={handleLinkClick}>
            <span className="icon"><Home size={18} /></span>
            <span className="label">Inicio</span>
          </NavLink>

          <NavLink to="/tickets" className="sidebar-link" onClick={handleLinkClick}>
            <span className="icon"><Ticket size={18} /></span>
            <span className="label">Tareas</span>
          </NavLink>

          <NavLink to="/calendar" className="sidebar-link" onClick={handleLinkClick}>
            <span className="icon"><CalendarDays size={18} /></span>
            <span className="label">Calendario</span>
          </NavLink>

          {(isAdmin || isSupport) && (
            <NavLink to="/admin/asignar" className="sidebar-link" onClick={handleLinkClick}>
              <span className="icon"><Users size={18} /></span>
              <span className="label">Asignar usuarios</span>
            </NavLink>
          )}

          {isAdmin && (
            <>
              <NavLink to="/dashboard" className="sidebar-link" onClick={handleLinkClick}>
                <span className="icon"><LayoutDashboard size={18} /></span>
                <span className="label">Dashboard</span>
              </NavLink>
              <NavLink to="/stats" className="sidebar-link" onClick={handleLinkClick}>
                <span className="icon"><BarChart3 size={18} /></span>
                <span className="label">Estadísticas</span>
              </NavLink>
              <NavLink to="/admin/usuarios" className="sidebar-link" onClick={handleLinkClick}>
                <span className="icon"><Users size={18} /></span>
                <span className="label">Usuarios</span>
              </NavLink>
            </>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Cuenta</div>

          {!user ? (
            <>
              <NavLink to="/login" className="sidebar-link" onClick={handleLinkClick}>
                <span className="icon"><LogIn size={18} /></span>
                <span className="label">Iniciar sesión</span>
              </NavLink>
              <NavLink to="/register" className="sidebar-link" onClick={handleLinkClick}>
                <span className="icon"><UserPlus size={18} /></span>
                <span className="label">Registrarse</span>
              </NavLink>
            </>
          ) : (
            <>
              <div className="sidebar-user">
                <div className="user-avatar" aria-hidden>
                  <User size={16} />
                </div>
                <div className="user-meta">
                  <div className="user-email" title={user.email}>
                    {user.email}
                  </div>
                  <div className="user-role">{user.rol}</div>
                </div>
              </div>

              <button className="sidebar-btn" onClick={handleLogout}>
                <span className="icon"><LogOut size={18} /></span>
                <span className="label">Cerrar sesión</span>
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-badge">
          v{import.meta.env.VITE_VERSION || "1.0.0"}
        </div>
      </div>
    </aside>
  );
}