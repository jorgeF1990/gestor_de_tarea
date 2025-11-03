import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import "./AppShell.css";

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState("light");

  // Detectar tamaño de pantalla (para saber si es móvil)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cargar tema guardado o detectar preferencia del sistema
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const defaultTheme = prefersDark ? "dark" : "light";
      setTheme(defaultTheme);
      document.documentElement.setAttribute("data-theme", defaultTheme);
    }
  }, []);

  // Cambiar tema manualmente
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleMouseEnterSidebar = () => {
    if (!isMobile) setOpen(true);
  };

  const handleMouseLeaveSidebar = () => {
    if (!isMobile) setOpen(false);
  };

  return (
    <div
      className={`appshell ${open ? "appshell--open" : "appshell--closed"} ${theme === "dark" ? "dark-mode" : ""}`}
    >
      {/* Sidebar solo responde al hover en escritorio */}
      <div
        className="appshell-sidebar-wrap"
        onMouseEnter={handleMouseEnterSidebar}
        onMouseLeave={handleMouseLeaveSidebar}
      >
        <Sidebar open={open} onToggle={() => setOpen((o) => !o)} />
      </div>

      <main className="appshell-content">
        {/* Botón de cambio de tema */}
        <div className="appshell-theme-toggle">
          <button onClick={toggleTheme} className="theme-btn">
            {theme === "light" ? " Modo oscuro" : " Modo claro"}
          </button>
        </div>

        <div className="appshell-inner">{children}</div>
      </main>
    </div>
  );
}
