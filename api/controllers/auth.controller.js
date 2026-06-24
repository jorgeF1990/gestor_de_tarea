// backend/controllers/auth.controller.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { enviarCorreo } = require('../utils/mailer');

// Registro
exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ message: 'El usuario ya existe' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = new User({ nombre, email, password: hashedPassword });
    await nuevoUsuario.save();
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    console.log('=== LOGIN REQUEST ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('JWT_SECRET presente:', !!process.env.JWT_SECRET);

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña requeridos' });
    }

    const usuario = await User.findOne({ email });
    console.log('Usuario encontrado:', !!usuario);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    console.log('Hash guardado (inicio):', usuario.password ? usuario.password.slice(0, 30) + '...' : 'no hay hash');
    const passwordValida = await bcrypt.compare(password, usuario.password);
    console.log('Resultado bcrypt.compare:', passwordValida);
    if (!passwordValida) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('Token generado:', !!token);
    console.log('=== LOGIN RESPONSE ===');

    // RESPONSE CORRECTO CON TOKEN
    return res.status(200).json({
      token: token,
      usuario: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ 
      message: 'Error al iniciar sesión',
      error: err.message 
    });
  }
};

// Solicitud de recuperación de contraseña
exports.recuperarPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const usuario = await User.findOne({ email });
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const token = crypto.randomBytes(32).toString('hex');
    usuario.resetToken = token;
    usuario.resetTokenExpira = Date.now() + 3600000;
    await usuario.save();

    const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const fallbackUrl = `${req.protocol}://${req.get('host')}`;
    const appFrontend = FRONTEND_URL || fallbackUrl;
    const enlace = `${appFrontend}/reset/${token}`;

    try {
      const asunto = 'Recuperación de contraseña';
      const texto = `Hacé clic o pegá el enlace en tu navegador para restablecer la contraseña:\n\n${enlace}\n\nEl enlace expira en 1 hora.`;
      await enviarCorreo(usuario.email, asunto, texto);
    } catch (mailErr) {
      console.error('Error enviando mail de recuperación:', mailErr);
      usuario.resetToken = undefined;
      usuario.resetTokenExpira = undefined;
      await usuario.save();
      return res.status(502).json({ message: 'No se pudo enviar el correo de recuperación' });
    }

    return res.json({ message: 'Correo de recuperación enviado' });
  } catch (err) {
    console.error('Error en recuperación:', err);
    return res.status(500).json({ message: 'Error al enviar correo de recuperación', detalle: err.message });
  }
};

// Restablecer contraseña
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const nuevaPassword = req.body.nuevaPassword || req.body.password || req.body.newPassword;
    
    console.log('--- RESET PASSWORD ---');
    console.log('Token:', token);
    console.log('Nueva password recibida:', nuevaPassword ? '[OCULTA]' : 'no recibida');

    if (!nuevaPassword) return res.status(400).json({ message: 'Nueva contraseña requerida' });

    const usuario = await User.findOne({
      resetToken: token,
      resetTokenExpira: { $gt: Date.now() }
    });

    if (!usuario) return res.status(400).json({ message: 'Token inválido o expirado' });

    usuario.password = await bcrypt.hash(nuevaPassword, 10);
    usuario.resetToken = undefined;
    usuario.resetTokenExpira = undefined;
    await usuario.save();

    console.log('Nuevo hash guardado (inicio):', usuario.password ? usuario.password.slice(0, 30) + '...' : 'ninguno');
    console.log('resetToken/resetTokenExpira limpios:', usuario.resetToken, usuario.resetTokenExpira);

    const accept = req.get('accept') || '';
    if (!accept.includes('application/json')) {
      return res.send('<p>Contraseña actualizada correctamente. Podés cerrar esta ventana.</p>');
    }

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al restablecer contraseña:', err);
    return res.status(500).json({ message: 'Error al actualizar contraseña', detalle: err.message });
  }
};