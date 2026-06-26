import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./AppShell.css";

// Iconos
import { Menu, Sun, Moon, LogOut, User } from "lucide-react";

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Detectar móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Aplicar tema
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  const toggleSidebar = () => {
    setIsOpen(prev => !prev);
  };

  const closeSidebar = () => {
    if (isMobile) setIsOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  const handleMouseEnter = () => {
    if (!isMobile) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isMobile) setIsOpen(false);
  };

  return (
    <div className={`appshell ${isOpen ? "appshell--open" : "appshell--closed"}`}>
      {/* Overlay para móvil */}
      <div className="appshell-overlay" onClick={closeSidebar} />

      {/* Sidebar */}
      <div
        className="appshell-sidebar-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Sidebar 
          open={isOpen} 
          onToggle={toggleSidebar}
          onClose={closeSidebar}
          isMobile={isMobile}
        />
      </div>

      {/* Contenido principal */}
      <main className="appshell-content">
        {/* Header */}
        <header className="appshell-header">
          <div className="appshell-header-left">
            <button 
              className="menu-toggle" 
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="appshell-header-right">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
            </button>

            <button 
              className="theme-toggle" 
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          </div>
        </header>

        <div className="appshell-inner">
          {children}
        </div>
      </main>
    </div>
  );
}