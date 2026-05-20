import React from "react";
import "./NotificationsPanel.css";

export default function NotificationsPanel({
  open,
  items,
  onClose,
  onMarkAll,
  onMarkOne,
}) {
  if (!open) return null;

  return (
    <div className="notif">
      <div className="notif-panel">
        <div className="notif-head">
          <h4>Notificaciones</h4>
          <div className="spacer" />
          <button className="btn-ghost" onClick={onMarkAll}>
            Marcar todo como visto
          </button>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty">No hay notificaciones</div>
        ) : (
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={n.read ? "read" : ""}>
                <div className="meta">
                  <span className={`chip dot ${n.kind}`}>{n.kind}</span>
                  <span className="time">
                    {new Date(n.date).toLocaleString()}
                  </span>
                </div>
                <div className="title">{n.title}</div>
                <div className="desc">{n.desc}</div>
                <div className="ops">
                  {!n.read && (
                    <button
                      className="btn-ghost"
                      onClick={() => onMarkOne(n)}
                    >
                      Marcar como visto
                    </button>
                  )}
                  <a className="btn" href={`/tickets/${n.ticketId || ""}`}>
                    Abrir tarea
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="notif-backdrop" onClick={onClose} />
    </div>
  );
}
