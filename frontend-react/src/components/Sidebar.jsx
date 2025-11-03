// frontend-react/src/components/Sidebar.jsx
import React, { useContext } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./Sidebar.css";

export default function Sidebar({ open, onToggle }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : "sidebar--closed"}`}>
      <div className="sidebar-header">
        
        <Link to="/" className="sidebar-brand" onClick={() => open || onToggle()}>
          <img src="/logo.png" alt="Logo" className="sidebar-logo" />
          <div className="sidebar-brandtext">
            <div className="sidebar-title">Portfolio Investment</div>
            <div className="sidebar-sub">Mesa de ayuda</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">General</div>

          <NavLink to="/" className="sidebar-link">
            <span className="icon"></span> <span className="label">Home</span>
          </NavLink>

        {/* Todos pueden ver Tickets */}
          <NavLink to="/tickets" className="sidebar-link">
            <span className="icon"></span> <span className="label">Tickets</span>
          </NavLink>

        {/* Solo admin */}
          {user?.rol === "admin" && (
            <>
              <NavLink to="/dashboard" className="sidebar-link">
                <span className="icon"></span> <span className="label">Dashboard</span>
              </NavLink>
              <NavLink to="/stats" className="sidebar-link">
                <span className="icon"></span> <span className="label">Estadísticas</span>
              </NavLink>
            </>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Cuenta</div>

          {!user ? (
            <>
              <NavLink to="/login" className="sidebar-link">
                <span className="icon"></span> <span className="label">Login</span>
              </NavLink>
              <NavLink to="/register" className="sidebar-link">
                <span className="icon"></span> <span className="label">Register</span>
              </NavLink>
            </>
          ) : (
            <>
              <div className="sidebar-user">
                <div className="user-avatar" aria-hidden></div>
                <div className="user-meta">
                  <div className="user-email" title={user.email}>{user.email}</div>
                  <div className="user-role">{user.rol}</div>
                </div>
              </div>
              <button className="sidebar-btn" onClick={handleLogout}>
                <span className="icon"></span> <span className="label">Salir</span>
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-badge">v{import.meta.env.VITE_VERSION || "1.0.0"}</div>
      </div>
    </aside>
  );
}
