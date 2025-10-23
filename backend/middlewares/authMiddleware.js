const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Authorization header:', req.headers.authorization);

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      rol: decoded.rol,
      email: decoded.email
    };
    console.log('Token decodificado:', req.user);
    next();
  } catch (err) {
    console.error('Error al verificar token:', err.message);
    res.status(403).json({ error: 'Token inválido' });
  }
};