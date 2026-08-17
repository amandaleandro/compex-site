const { prisma } = require('../db');
const { send } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

// GET /api/metrics — indicadores operacionais básicos (seção 53 do pedido). Só números
// agregados a partir de dados reais, nada de ranking por pessoa — o objetivo é dar uma noção
// de saúde da operação pra Presidência, não apontar quem está "pior".
async function handleMetricsRoutes(url, req, res) {
  if (url.pathname !== '/api/metrics' || req.method !== 'GET') return false;
  const session = resolveSession(bearerToken(req));
  if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência.' }); return true; }
  if (!prisma) { send(res, 200, {}); return true; }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    tasksCompletedOnTime, tasksCompletedLate, tasksOverdueOpen,
    notificationsSent30d, openPendencies, resolvedPendencies,
    schedulesAwaiting, pollsAwaitingValidation, requestsAwaitingApproval,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS count FROM "Task" WHERE status = \'done\' AND "completedAt" IS NOT NULL AND "dueDate" IS NOT NULL AND "completedAt" <= "dueDate"'
    ).then(rows => rows[0]?.count ?? 0),
    prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS count FROM "Task" WHERE status = \'done\' AND "completedAt" IS NOT NULL AND "dueDate" IS NOT NULL AND "completedAt" > "dueDate"'
    ).then(rows => rows[0]?.count ?? 0),
    prisma.task.count({ where: { status: { not: 'done' }, dueDate: { lt: now } } }),
    prisma.notification.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notification.count({ where: { kind: 'ACIONAVEL', resolved: false } }),
    prisma.notification.findMany({ where: { kind: 'ACIONAVEL', resolved: true, resolvedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true, resolvedAt: true } }),
    prisma.schedule.count({ where: { status: 'AGUARDANDO' } }),
    prisma.poll.count({ where: { status: 'ENCERRADA' } }),
    prisma.request.count({ where: { status: { in: ['SOLICITADO', 'FINANCEIRO', 'PRESIDENCIA'] } } }),
  ]);

  const resolutionHours = resolvedPendencies.map(n => (n.resolvedAt.getTime() - n.createdAt.getTime()) / (60 * 60 * 1000));
  const avgResolutionHours = resolutionHours.length ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length : null;

  const totalTasksClosed = tasksCompletedOnTime + tasksCompletedLate;

  send(res, 200, {
    tasks: {
      completedOnTime: tasksCompletedOnTime,
      completedLate: tasksCompletedLate,
      onTimeRate: totalTasksClosed ? Math.round((tasksCompletedOnTime / totalTasksClosed) * 100) : null,
      overdueOpen: tasksOverdueOpen,
    },
    pendencies: {
      open: openPendencies,
      resolvedLast30d: resolvedPendencies.length,
      avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
    },
    notifications: { sentLast30d: notificationsSent30d },
    operational: {
      schedulesAwaitingConfirmation: schedulesAwaiting,
      pollsAwaitingValidation,
      requestsAwaitingApproval,
    },
  });
  return true;
}

module.exports = { handleMetricsRoutes };
