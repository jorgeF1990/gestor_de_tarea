module.exports = function (req, res, next) {
  if (req.user.rol !== 'soporte' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: solo soporte o administradores' });
  }
  next();
};