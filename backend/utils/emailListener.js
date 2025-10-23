const { ImapFlow } = require('imapflow');
const Ticket = require('../models/ticket.model');
const fs = require('fs');
const path = require('path');
const os = require('os');

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  }
});

async function escucharRespuestas() {
  await client.connect();
  console.log('📥 Escuchando correos entrantes...');

  const lock = await client.getMailboxLock('INBOX');
  try {
    for await (let msg of client.fetch('1:*', { envelope: true, source: true, bodyParts: ['text/plain'], bodyStructure: true })) {
      const subject = msg.envelope.subject;
      const from = msg.envelope.from[0].address;
      const match = subject.match(/Ticket #(\d+)/);
      if (!match) continue;

      const numero = match[1];
      const ticket = await Ticket.findOne({ numero_ticket: numero });
      if (!ticket) continue;

      let comentario = '';
      for await (let part of client.download(msg.uid, 'text/plain')) {
        comentario += part.toString();
      }

      let imagen = null;
      if (msg.bodyStructure.childNodes) {
        for (const part of msg.bodyStructure.childNodes) {
          if (part.disposition?.type === 'attachment' && part.type === 'image') {
            const filename = part.disposition.params.filename;
            const savePath = path.join(__dirname, '..', 'uploads', filename);
            const writeStream = fs.createWriteStream(savePath);
            for await (let chunk of client.download(msg.uid, part.part)) {
              writeStream.write(chunk);
            }
            writeStream.end();
            imagen = filename;
          }
        }
      }

      ticket.historial.push({
        fecha: new Date(),
        estado: ticket.estado,
        comentario: comentario.trim(),
        autor: from,
        imagen
      });

      await ticket.save();
      console.log(` Comentario agregado al ticket #${numero} desde ${from}`);
    }
  } catch (err) {
    console.error('Error al procesar correo:', err.message);
  } finally {
    lock.release();
  }
}

escucharRespuestas();