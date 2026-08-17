const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

async function handleNotificationRoutes(url, req, res) {
  if (url.pathname !== '/api/notifications') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? { items: [], unreadCount: 0 } : { ok: true }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userEmail: session.email }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.notification.count({ where: { userEmail: session.email, read: false } }),
    ]);
    send(res, 200, { items: items.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })), unreadCount });
    return true;
  }

  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      if (item.markAll) {
        await prisma.notification.updateMany({ where: { userEmail: session.email, read: false }, data: { read: true } });
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
