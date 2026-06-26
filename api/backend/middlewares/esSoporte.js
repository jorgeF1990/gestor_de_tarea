module.exports = function isSupportOrAdmin(req, res, next) {
  const rol = req.user?.rol;
  if (rol !== 'soporte' && rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: solo soporte o administradores' });
  }
  next();
};
