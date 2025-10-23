Sistema de Tickets
Descripción y características
- Descripción: Aplicación full-stack para gestionar tickets, comentarios y archivos adjuntos entre usuarios y soporte.
- Características principales:
- Crear, actualizar y listar tickets.
- Historial de comentarios con autor, fecha y archivo adjunto.
- Adjuntar imágenes en comentarios (campo multipart/form-data llamado imagen).
- Notificaciones por correo al agregar comentarios.
- Control de lectura por usuario (campo leidoPor).
- Autenticación JWT para rutas protegidas.
Tecnologías y requisitos
- Backend: Node.js, Express, Mongoose, Multer, Nodemailer (o equivalente).
- Frontend: Vite, React, Axios.
- Base de datos: MongoDB.
- Requisitos mínimos:
- Node.js v16+
- MongoDB accesible (local o nube)
- Cuenta SMTP para envíos de correo (opcional para notificaciones)
Instalación y configuración
Clonar e instalar
- Clonar repo:
- git clone https://github.com/jorgeF1990/sistema-tickets.git
- Instalar dependencias backend:
- cd backend
- npm install
- Instalar dependencias frontend:
- cd ../frontend (o la ruta según tu estructura)
- npm install
Variables de entorno
Crear backend/.env con al menos:
- PORT = puerto del backend
- MONGO_URI = cadena de conexión a MongoDB
- JWT_SECRET = clave para tokens JWT
- APP_URL = URL pública de la app para enlaces en correos
- SMTP_HOST, SMTP_USER, SMTP_PASS = configuración SMTP para envíos
Ejemplo mínimo:

PORT=4000

MONGO_URI=mongodb://localhost:27017/sistema-tickets

JWT_SECRET=una_clave_segura

APP_URL=http://localhost:5173

SMTP_HOST=smtp.example.com

SMTP_USER=usuario@example.com

SMTP_PASS=tu_password


Ejecutar en desarrollo
- Backend:
- cd backend
- npm run dev
- Frontend:
- cd frontend
- npm run dev
Uso y endpoints relevantes
- PUT /tickets/:id/comentario
- Agrega comentario al ticket.
- Body: multipart/form-data con campos comentario (texto) y archivo con nombre imagen.
- Autenticación: Bearer JWT en header Authorization.
- Resto de endpoints CRUD: tickets, usuarios, autenticación, disponibles en el backend (ajustar según implementación).
Buenas prácticas y despliegue
- .gitignore debería incluir: node_modules/, backend/uploads/, backend/.env, dist/, .vite/, .vscode/ y otros archivos locales.
- Para dejar de rastrear archivos que ya fueron commiteados:
- git rm -r --cached node_modules backend/uploads
- git rm --cached backend/.env
- git add .
- git commit -m "Remove tracked files now ignored"
- git push origin main
- Eliminar secretos del historial: usar BFG o git filter-repo si es necesario; ese proceso reescribe historial y requiere forzar push y coordinación con colaboradores.
- Despliegue sugerido:
- Generar build del frontend: npm run build
- Configurar variables de entorno en servidor
- Iniciar backend en producción con PM2 o Docker
- Usar HTTPS y un proxy inverso (NGINX) para seguridad y performance
Contribuir y licencia
- Flujo de contribución:
- Crear branch por feature o fix: feature/nombre o fix/descripcion
- Commits claros y atómicos
- Abrir Pull Request describiendo cambios y pruebas
- Licencia: MIT (ajustar según necesidad)
- Contacto: https://github.com/jorgeF1990


PORT=4000
MONGO_URI=mongodb://localhost:27017/sistema-tickets
JWT_SECRET=una_clave_segura
APP_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_USER=usuario@example.com
SMTP_PASS=tu_password

Ejecutar en desarrollo
- Backend:
- cd backend
- npm run dev
- Frontend:
- cd frontend
- npm run dev
Uso y endpoints relevantes
- PUT /tickets/:id/comentario
- Agrega comentario al ticket.
- Body: multipart/form-data con campos comentario (texto) y archivo con nombre imagen.
- Autenticación: Bearer JWT en header Authorization.
- Resto de endpoints CRUD: tickets, usuarios, autenticación, disponibles en el backend (ajustar según implementación).
Buenas prácticas y despliegue
- .gitignore debería incluir: node_modules/, backend/uploads/, backend/.env, dist/, .vite/, .vscode/ y otros archivos locales.
- Para dejar de rastrear archivos que ya fueron commiteados:
- git rm -r --cached node_modules backend/uploads
- git rm --cached backend/.env
- git add .
- git commit -m "Remove tracked files now ignored"
- git push origin main
- Eliminar secretos del historial: usar BFG o git filter-repo si es necesario; ese proceso reescribe historial y requiere forzar push y coordinación con colaboradores.
- Despliegue sugerido:
- Generar build del frontend: npm run build
- Configurar variables de entorno en servidor
- Iniciar backend en producción con PM2 o Docker
- Usar HTTPS y un proxy inverso (NGINX) para seguridad y performance
Contribuir y licencia
- Flujo de contribución:
- Crear branch por feature o fix: feature/nombre o fix/descripcion
- Commits claros y atómicos
- Abrir Pull Request describiendo cambios y pruebas
- Licencia: MIT (ajustar según necesidad)
