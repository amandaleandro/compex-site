const { prisma } = require('../db');
const { send } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

// GET /api/audit-log — consulta a trilha de auditoria. Restrito à Presidência (é ela
// quem precisa responder "quem aprovou / quem alterou" quando algo é questionado).
async function handleAuditLogRoutes(url, req, res) {
  if (url.pathname !== '/api/audit-log' || req.method !== 'GET') return false;
  if (!prisma) { send(res, 200, []); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência' }); return true; }

  const params = url.searchParams;
  const entity = params.get('entity');
  const entityId = params.get('entityId');
  const list = await prisma.auditLog.findMany({
    where: { ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  send(res, 200, list.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  return true;
}

module.exports = { handleAuditLogRoutes };
