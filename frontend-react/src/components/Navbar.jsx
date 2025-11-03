import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./Navbar.css";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();            // limpia contexto + localStorage
    navigate("/");       // re-render inmediato por cambio de contexto
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/">Home</Link>
        {user?.rol === "admin" && <Link to="/dashboard">Dashboard</Link>}
        {user?.rol === "admin" && <Link to="/stats">Estadísticas</Link>}
        {user && <Link to="/tickets">Tickets</Link>}
      </div>

      <div className="navbar-right">
        {user ? (
          <>
            <span className="navbar-user">{user.email}</span>
            <button className="navbar-button" onClick={handleLogout}>Cerrar sesión</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
