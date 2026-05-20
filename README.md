# 📋 Gestor de Tareas

Aplicación full-stack para gestionar tareas con seguimiento de comentarios, archivos adjuntos, notificaciones por correo y control de lectura.

---

## 📋 Descripción y características

### Descripción
Gestor de Tareas es una aplicación web para la gestión de tareas entre usuarios y administradores. Permite crear, asignar y hacer seguimiento de tareas con notificaciones por correo en tiempo real.

### Características principales
- ✅ Crear, actualizar y listar tareas
- ✅ Asignación de múltiples usuarios por tarea
- ✅ Historial de actividad con autor, fecha y archivo adjunto
- ✅ Adjuntar imágenes en comentarios (multipart/form-data)
- ✅ Notificaciones por correo al crear, comentar, asignar o cambiar estado
- ✅ Recordatorios automáticos de vencimiento (30, 21, 14, 7, 3, 1 día y post-vencimiento)
- ✅ Control de lectura por usuario (campo `leidoPor`)
- ✅ Autenticación JWT para rutas protegidas
- ✅ Recurrencia de tareas (diaria, semanal, mensual, anual)
- ✅ Vistas: Lista, Kanban, Calendario y Archivadas
- ✅ Dashboard con KPIs en tiempo real
- ✅ Drag & Drop en vista Kanban
- ✅ Modo oscuro / claro
- ✅ Silenciar notificaciones por tarea

---

## 🛠️ Tecnologías y requisitos

### Backend
- Node.js v16+
- Express
- Mongoose (MongoDB)
- Multer (carga de archivos)
- Nodemailer (envío de correos)
- JWT (autenticación)
- node-cron (tareas programadas)
- ical-generator (eventos de calendario)

### Frontend
- Vite
- React 18
- Axios
- react-big-calendar
- Lucide React (iconos)
- jwt-decode

### Base de datos
- MongoDB (local o Atlas)

### Requisitos mínimos
- Node.js v16+
- MongoDB accesible (local o nube)
- Cuenta SMTP para envíos de correo (opcional para notificaciones)

---

## 🚀 Instalación y configuración

### Clonar e instalar

```bash
# Clonar repositorio
git clone https://github.com/jorgeF1990/gestor_de_tarea.git
cd gestor_de_tarea

# Instalar dependencias raíz
npm install

# Instalar dependencias backend
cd backend
npm install

# Instalar dependencias frontend
cd ../frontend-react
npm install
