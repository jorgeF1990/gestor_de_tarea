const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = new User({ nombre, email, password: hashedPassword });
    await nuevoUsuario.save();

    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign(
      {
        id: usuario._id,
        rol: usuario.rol,
        email: usuario.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      token,
      usuario: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
};