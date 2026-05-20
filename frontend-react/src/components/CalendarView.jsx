import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CalendarView.css';

// Importar iconos de Lucide React
import { CalendarDays, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const locales = { 'es': es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CalendarView({ tickets }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');

  // Convertir tickets a eventos cuando cambian los tickets
  useEffect(() => {
    if (tickets && tickets.length > 0) {
      const eventos = tickets
        .filter(t => t && t.fecha_vencimiento) // Filtrar tickets válidos con fecha
        .map(t => {
          // Validar y sanitizar el asunto
          let asunto = t.asunto || 'Sin título';
          if (typeof asunto !== 'string') {
            asunto = String(asunto) || 'Sin título';
          }
          
          // Limitar longitud del título para el calendario
          const tituloCorto = asunto.length > 40 ? asunto.substring(0, 40) + '...' : asunto;
          
          const fechaVen = new Date(t.fecha_vencimiento);
          // Verificar que la fecha sea válida
          if (isNaN(fechaVen.getTime())) {
            return null; // Saltar fechas inválidas
          }
          
          const esVencida = fechaVen < new Date();
          
          return {
            id: t._id,
            title: `#${t.numero_ticket || '?'} - ${tituloCorto}`,
            start: fechaVen,
            end: fechaVen,
            allDay: true,
            resource: t,
            priority: t.prioridad || 'media',
            estado: t.estado || 'pendiente',
            esVencida: esVencida
          };
        })
        .filter(event => event !== null); // Eliminar eventos nulos
      
      setEvents(eventos);
    } else {
      setEvents([]);
    }
  }, [tickets]);

  const getEventColor = (event) => {
    if (!event) return '#4f46e5';
    if (event.esVencida) return '#ef4444';
    switch (event.priority) {
      case 'alta': return '#ef4444';
      case 'media': return '#f59e0b';
      case 'baja': return '#10b981';
      default: return '#4f46e5';
    }
  };

  const eventStyleGetter = (event) => {
    const backgroundColor = getEventColor(event);
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        color: 'white',
        fontSize: '11px',
        padding: '4px 6px',
        border: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    };
  };

  const handleSelectEvent = (event) => {
    if (event && event.id) {
      navigate(`/tareas/${event.id}`);
    }
  };

  // Funciones de navegación
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrev = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (currentView === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (currentView === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const onView = (newView) => {
    setCurrentView(newView);
  };

  const onNavigate = (newDate) => {
    setCurrentDate(newDate);
  };

  // Formatear título según la vista
  const getTitle = () => {
    if (currentView === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: es });
    } else if (currentView === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`;
    } else if (currentView === 'day') {
      return format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });
    }
    return format(currentDate, 'MMMM yyyy', { locale: es });
  };

  // Si no hay tickets, mostrar mensaje
  if (!tickets || tickets.length === 0) {
    return (
      <div className="calendar-empty">
        <CalendarDays size={48} />
        <h3>No hay tareas con fecha de vencimiento</h3>
        <p>Crea tareas con fecha de vencimiento para verlas en el calendario.</p>
      </div>
    );
  }

  return (
    <div className="calendar-view-container">
      {/* Barra de navegación personalizada */}
      <div className="calendar-navbar">
        <div className="calendar-nav-left">
          <button onClick={goToPrev} className="nav-btn" title="Anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToToday} className="nav-btn today-btn">
            <CalendarIcon size={16} />
            Hoy
          </button>
          <button onClick={goToNext} className="nav-btn" title="Siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="calendar-title">
          <h3>{getTitle()}</h3>
        </div>
        
        <div className="calendar-nav-right">
          <div className="view-buttons">
            <button 
              className={`view-btn ${currentView === 'month' ? 'active' : ''}`}
              onClick={() => onView('month')}
            >
              Mes
            </button>
            <button 
              className={`view-btn ${currentView === 'week' ? 'active' : ''}`}
              onClick={() => onView('week')}
            >
              Semana
            </button>
            <button 
              className={`view-btn ${currentView === 'day' ? 'active' : ''}`}
              onClick={() => onView('day')}
            >
              Día
            </button>
            <button 
              className={`view-btn ${currentView === 'agenda' ? 'active' : ''}`}
              onClick={() => onView('agenda')}
            >
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="calendar-legend-bar">
        <div className="calendar-legend">
          <span className="legend-dot legend-alta"></span>
          <span>Alta prioridad</span>
          <span className="legend-dot legend-media"></span>
          <span>Media prioridad</span>
          <span className="legend-dot legend-baja"></span>
          <span>Baja prioridad</span>
          <span className="legend-dot legend-vencida"></span>
          <span>Vencida</span>
        </div>
      </div>

      {/* Componente de calendario */}
      <div className="calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={onNavigate}
          view={currentView}
          onView={onView}
          style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
          messages={{
            next: "Siguiente",
            previous: "Anterior",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            date: "Fecha",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "No hay tareas en este período",
          }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          popup
          components={{
            toolbar: () => null // Ocultamos la toolbar por defecto
          }}
        />
      </div>
    </div>
  );
}