const { prisma } = require('../db');

// Notificação interna — nunca deve derrubar a request principal se falhar.
async function notify({ email, title, message, link = null }) {
  if (!prisma || !email) return;
  try {
    await prisma.notification.create({ data: { userEmail: email, title, message, link } });
  } catch (error) {
    console.error('[notify]', error);
  }
}

module.exports = { notify };
