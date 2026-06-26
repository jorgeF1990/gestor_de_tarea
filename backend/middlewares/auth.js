const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('[AUTH] JWT_SECRET no definida en variables de entorno');
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Token requerido',
      message: 'No se proporcionó token de autenticación'
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(401).json({ 
      error: 'Formato de token invalido',
      message: 'El token debe tener formato Bearer [token]'
    });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ 
      error: 'Token mal formado',
      message: 'El token debe ser de tipo Bearer'
    });
  }

  if (!token) {
    return res.status(401).json({ 
      error: 'Token vacio',
      message: 'No se proporcionó un token valido'
    });
  }

  if (!JWT_SECRET) {
    console.error('[AUTH] JWT_SECRET no definida');
    return res.status(500).json({ 
      error: 'Error de configuracion del servidor',
      message: 'Contacte al administrador'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.id || decoded._id || decoded.sub,
      rol: decoded.rol || 'usuario',
      email: decoded.email
    };

    if (!req.user.id || !req.user.email) {
      return res.status(401).json({ 
        error: 'Token invalido',
        message: 'El token no contiene datos de usuario validos'
      });
    }

    next();
  } catch (err) {
    console.error('[AUTH] Error al verificar token:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        message: 'La sesión ha expirado. Inicie sesión nuevamente'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Token invalido',
        message: 'El token proporcionado no es valido'
      });
    }

    if (err.name === 'NotBeforeError') {
      return res.status(403).json({ 
        error: 'Token no activo',
        message: 'El token aun no esta activo'
      });
    }

    return res.status(500).json({ 
      error: 'Error al verificar autenticacion',
      message: 'Error interno al procesar el token'
    });
  }
}

function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'No autenticado',
      message: 'Se requiere autenticacion para esta accion'
    });
  }

  if (req.user.rol !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Se requieren permisos de administrador'
    });
  }

  next();
}

function isSupportOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'No autenticado',
      message: 'Se requiere autenticacion para esta accion'
    });
  }

  const rol = req.user.rol;
  if (rol !== 'soporte' && rol !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Se requieren permisos de soporte o administrador'
    });
  }

  next();
}

function isOwnerOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'No autenticado',
      message: 'Se requiere autenticacion para esta accion'
    });
  }

  const userId = req.params.id || req.params.userId;
  
  if (req.user.rol === 'admin') {
    return next();
  }

  if (userId && req.user.id === userId) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Acceso denegado',
    message: 'No tienes permiso para acceder a este recurso'
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
    req.user = null;
    return next();
  }

  const token = parts[1];

  if (!token || !JWT_SECRET) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id || decoded.sub,
      rol: decoded.rol || 'usuario',
      email: decoded.email
    };
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = auth;
module.exports.auth = auth;
module.exports.isAdmin = isAdmin;
module.exports.isSupportOrAdmin = isSupportOrAdmin;
module.exports.isOwnerOrAdmin = isOwnerOrAdmin;
module.exports.optionalAuth = optionalAuth;