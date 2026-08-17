const http = require('http');
require('dotenv/config');
const { port } = require('./lib/constants');
const { requestHandler } = require('./router');
const { runReminderSweep } = require('./lib/reminders');
const { processQueue: processWhatsAppQueue } = require('./lib/whatsapp-queue');

const server = http.createServer(requestHandler);
server.listen(port, () => console.log(`COMPEX disponÃ­vel em http://localhost:${port}`));

// Varredura de lembretes/escalonamento de prazos — roda a cada 15min, sem bloquear o boot.
const REMINDER_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(runReminderSweep, REMINDER_SWEEP_INTERVAL_MS);
runReminderSweep();

// Fila de WhatsApp roda num intervalo próprio, mais curto — mensagem enfileirada não deve
// esperar até 15min pra sair. Separado do sweep de lembretes de propósito (evento independente).
const WHATSAPP_QUEUE_INTERVAL_MS = 3 * 60 * 1000;
setInterval(processWhatsAppQueue, WHATSAPP_QUEUE_INTERVAL_MS);
processWhatsAppQueue();
