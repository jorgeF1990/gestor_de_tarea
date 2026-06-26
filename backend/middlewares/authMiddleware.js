// backend/middlewares/auth.js
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id || decoded.sub,
      rol: decoded.rol || 'usuario',
      email: decoded.email
    };

    if (!req.user.id || !req.user.email) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    next();
  } catch (err) {
    console.error('Error al verificar token:', err.message);
    res.status(403).json({ error: 'Token inválido' });
  }
};