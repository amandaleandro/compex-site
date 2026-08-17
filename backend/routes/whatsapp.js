const { prisma } = require('../db');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { isEvolutionConfigured, isWebhookConfigured, config } = require('../lib/evolution');

// Garante que sempre existe exatamente uma linha de status (singleton simples).
async function getOrCreateStatus() {
  const existing = await prisma.whatsAppInstanceStatus.findFirst();
  if (existing) return existing;
  return prisma.whatsAppInstanceStatus.create({ data: { connected: false } });
}

// GET /api/whatsapp/status — visão administrativa (Presidência), nunca expõe credenciais,
// só o que é observável: instância configurada, conectada, último evento, webhook ativo.
async function handleStatus(url, req, res) {
  if (url.pathname !== '/api/whatsapp/status' || req.method !== 'GET') return false;
  const session = resolveSession(bearerToken(req));
  if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência.' }); return true; }
  if (!prisma) { send(res, 200, { configured: false }); return true; }

  const cfg = config();
  const status = await getOrCreateStatus();
  const [pending, failed, sent] = await Promise.all([
    prisma.whatsAppMessage.count({ where: { status: 'PENDENTE' } }),
    prisma.whatsAppMessage.count({ where: { status: 'FALHOU' } }),
    prisma.whatsAppMessage.count({ where: { status: { in: ['ENVIADO', 'ENTREGUE'] } } }),
  ]);
  send(res, 200, {
    configured: isEvolutionConfigured(),
    instance: cfg.instance || null,
    webhookConfigured: isWebhookConfigured(),
    connected: status.connected,
    lastEventType: status.lastEventType,
    lastEventAt: status.lastEventAt ? status.lastEventAt.toISOString() : null,
    counts: { pending, failed, sent },
  });
  return true;
}

// GET /api/whatsapp/messages — histórico recente, pra auditoria/depuração (Presidência).
async function handleMessages(url, req, res) {
  if (url.pathname !== '/api/whatsapp/messages' || req.method !== 'GET') return false;
  const session = resolveSession(bearerToken(req));
  if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência.' }); return true; }
  if (!prisma) { send(res, 200, []); return true; }
  const list = await prisma.whatsAppMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  send(res, 200, list.map(m => ({
    id: m.id, toPhone: m.toPhone, templateKey: m.templateKey, content: m.content, status: m.status,
    attempts: m.attempts, maxAttempts: m.maxAttempts, error: m.error, linkedEntity: m.linkedEntity, linkedId: m.linkedId,
    createdAt: m.createdAt.toISOString(), sentAt: m.sentAt ? m.sentAt.toISOString() : null,
  })));
  return true;
}

// POST /api/webhooks/evolution — recebe eventos da Evolution API (status de conexão, status
// de envio/entrega). Validado por um token compartilhado (nunca por credencial de app).
async function handleWebhook(url, req, res) {
  if (url.pathname !== '/api/webhooks/evolution' || req.method !== 'POST') return false;
  if (!prisma) { send(res, 200, { ok: true }); return true; }

  const expectedToken = config().webhookToken;
  const providedToken = req.headers['x-webhook-token'] || url.searchParams.get('token');
  if (expectedToken && providedToken !== expectedToken) { send(res, 401, { error: 'Token de webhook inválido.' }); return true; }

  try {
    const payload = await body(req);
    const eventType = payload.event || payload.type || 'unknown';

    if (eventType.toLowerCase().includes('connection')) {
      const status = await getOrCreateStatus();
      const connected = payload.data?.state === 'open' || payload.state === 'open';
      await prisma.whatsAppInstanceStatus.update({ where: { id: status.id }, data: { connected, lastEventType: eventType, lastEventAt: new Date() } });
    } else {
      const status = await getOrCreateStatus();
      await prisma.whatsAppInstanceStatus.update({ where: { id: status.id }, data: { lastEventType: eventType, lastEventAt: new Date() } });
    }

    // Status de entrega/envio de mensagem — casa pelo id externo retornado no envio.
    const externalId = payload.data?.key?.id || payload.messageId || null;
    const messageStatus = (payload.data?.status || payload.status || '').toUpperCase();
    if (externalId && ['DELIVERED', 'READ'].includes(messageStatus)) {
      await prisma.whatsAppMessage.updateMany({ where: { externalId }, data: { status: 'ENTREGUE' } });
    }

    send(res, 200, { ok: true });
  } catch (error) {
    console.error('[whatsapp:webhook]', error);
    send(res, 400, { error: 'Payload inválido' });
  }
  return true;
}

async function handleWhatsAppRoutes(url, req, res) {
  if (await handleStatus(url, req, res)) return true;
  if (await handleMessages(url, req, res)) return true;
  if (await handleWebhook(url, req, res)) return true;
  return false;
}

module.exports = { handleWhatsAppRoutes };
