const nodemailer = require('nodemailer');

exports.enviarCorreo = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.empresa.com',
    port: 587,
    auth: {
      user: 'usuario',
      pass: 'contraseña'
    }
  });

  await transporter.sendMail({ from: 'soporte@empresa.com', to, subject, text });
};