const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { resolveDueDates } = require('../lib/pendency-due-dates');

async function handleNotificationRoutes(url, req, res) {
  if (url.pathname !== '/api/notifications') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? { items: [], unreadCount: 0 } : { ok: true }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  const PRIORITY_ORDER = { CRITICA: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };

  if (req.method === 'GET') {
    const [items, unreadCount, pendingActionCount, popupCandidates] = await Promise.all([
      prisma.notification.findMany({ where: { userEmail: session.email }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.notification.count({ where: { userEmail: session.email, read: false } }),
      prisma.notification.count({ where: { userEmail: session.email, kind: 'ACIONAVEL', resolved: false } }),
      // Pop-up: só pendências acionáveis nunca exibidas — evita repetir o mesmo modal a cada navegação.
      prisma.notification.findMany({ where: { userEmail: session.email, kind: 'ACIONAVEL', resolved: false, popupShownAt: null }, orderBy: { createdAt: 'asc' }, take: 10 }),
    ]);
    const popup = popupCandidates.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0] || null;
    const dueDateById = await resolveDueDates(items);
    send(res, 200, {
      items: items.map(n => ({
        ...n, createdAt: n.createdAt.toISOString(), resolvedAt: n.resolvedAt ? n.resolvedAt.toISOString() : null,
        dueAt: dueDateById.get(n.id) ? dueDateById.get(n.id).toISOString() : null,
      })),
      unreadCount,
      pendingActionCount,
      popup: popup ? { ...popup, createdAt: popup.createdAt.toISOString() } : null,
    });
    return true;
  }

  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      if (item.markAll) {
        await prisma.notification.updateMany({ where: { userEmail: session.email, read: false }, data: { read: true } });
      } else if (item.resolveId) {
        await prisma.notification.updateMany({ where: { id: item.resolveId, userEmail: session.email }, data: { read: true, resolved: true, resolvedAt: new Date() } });
      } else if (item.ackPopupId) {
        await prisma.notification.updateMany({ where: { id: item.ackPopupId, userEmail: session.email, popupShownAt: null }, data: { popupShownAt: new Date() } });
      } else if (item.id) {
        await prisma.notification.updateMany({ where: { id: item.id, userEmail: session.email }, data: { read: true } });
      }
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

module.exports = { handleNotificationRoutes };
