const { prisma } = require('../db');
const { buildMessage } = require('./whatsapp-templates');
const { isEvolutionConfigured, sendViaEvolution } = require('./evolution');

const BATCH_SIZE = 10;

// Horário de silêncio — não manda mensagem não-urgente fora desse intervalo. Config única
// (não por usuário ainda); CRITICA sempre passa direto, é reservado a avisos de verdade urgentes.
const QUIET_HOURS_START = Number(process.env.WHATSAPP_QUIET_HOURS_START ?? 21); // 21h
const QUIET_HOURS_END = Number(process.env.WHATSAPP_QUIET_HOURS_END ?? 8); // 08h

function isQuietHoursNow(hour = new Date().getHours()) {
  if (QUIET_HOURS_START === QUIET_HOURS_END) return false;
  if (QUIET_HOURS_START < QUIET_HOURS_END) return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END; // intervalo que cruza a meia-noite
}

// Enfileira uma mensagem — nunca envia na hora (evita segurar a request do usuário esperando
// uma API externa). O processamento real acontece no sweep periódico (ver processQueue).
async function enqueueWhatsApp({ phone, templateKey, variables = {}, linkedEntity = null, linkedId = null, priority = 'NORMAL' }) {
  if (!prisma || !phone) return null;
  try {
    const content = buildMessage(templateKey, variables);
    const configured = isEvolutionConfigured();
    return await prisma.whatsAppMessage.create({
      data: {
        toPhone: phone, templateKey, variables, content, linkedEntity, linkedId, priority,
        status: configured ? 'PENDENTE' : 'FALHOU',
        error: configured ? null : 'Evolution API não configurada (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE)',
      },
    });
  } catch (error) {
    console.error('[whatsapp-queue]', error);
    return null;
  }
}

// Processa um lote de mensagens PENDENTE — chamado pelo sweep periódico do servidor.
// Nunca deve derrubar o processo; erros ficam registrados na própria mensagem.
async function processQueue() {
  if (!prisma || !isEvolutionConfigured()) return;
  const quiet = isQuietHoursNow();
  const pending = await prisma.whatsAppMessage.findMany({
    where: quiet ? { status: 'PENDENTE', priority: 'CRITICA' } : { status: 'PENDENTE' },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  }).catch(() => []);

  for (const message of pending) {
    if (message.attempts >= message.maxAttempts) {
      await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'FALHOU', error: 'Número máximo de tentativas excedido' } }).catch(() => {});
      continue;
    }
    await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'PROCESSANDO', attempts: { increment: 1 } } }).catch(() => {});
    const result = await sendViaEvolution({ phone: message.toPhone, message: message.content });
    if (result.ok) {
      await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'ENVIADO', sentAt: new Date(), externalId: result.externalId || null, error: null } }).catch(() => {});
    } else {
      const attempts = message.attempts + 1;
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: { status: attempts >= message.maxAttempts ? 'FALHOU' : 'PENDENTE', error: result.error },
      }).catch(() => {});
    }
  }
}

module.exports = { enqueueWhatsApp, processQueue, isQuietHoursNow };
