const { prisma } = require('../db');

// Notification não guarda prazo próprio — o prazo real vive no registro de origem
// (Request.dueDate, Task.dueDate, Schedule.date, Poll.expiresAt...). Resolve em lote pra não
// fazer 1 query por notificação. Entidades sem noção de prazo (ex: DepartureRequest) ficam null.
const RESOLVERS = {
  Request: async ids => prisma.request.findMany({ where: { id: { in: ids } }, select: { id: true, dueDate: true } }),
  Task: async ids => prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, dueDate: true } }),
  Schedule: async ids => prisma.schedule.findMany({ where: { id: { in: ids } }, select: { id: true, date: true } }).then(rows => rows.map(r => ({ id: r.id, dueDate: r.date }))),
  Poll: async ids => prisma.poll.findMany({ where: { id: { in: ids } }, select: { id: true, expiresAt: true } }).then(rows => rows.map(r => ({ id: r.id, dueDate: r.expiresAt }))),
};

// Recebe as notificações (precisa de `entity`/`entityId`) e devolve um Map<notificationId, Date|null>.
async function resolveDueDates(notifications) {
  const byEntity = new Map();
  for (const n of notifications) {
    if (!n.entity || !n.entityId || !RESOLVERS[n.entity]) continue;
    if (!byEntity.has(n.entity)) byEntity.set(n.entity, new Set());
    byEntity.get(n.entity).add(n.entityId);
  }

  const dueDateByEntityId = new Map(); // `${entity}:${entityId}` -> Date|null
  await Promise.all(Array.from(byEntity.entries()).map(async ([entity, idSet]) => {
    const rows = await RESOLVERS[entity](Array.from(idSet)).catch(() => []);
    for (const row of rows) dueDateByEntityId.set(`${entity}:${row.id}`, row.dueDate);
  }));

  const result = new Map();
  for (const n of notifications) {
    const key = n.entity && n.entityId ? `${n.entity}:${n.entityId}` : null;
    result.set(n.id, key && dueDateByEntityId.has(key) ? dueDateByEntityId.get(key) : null);
  }
  return result;
}

module.exports = { resolveDueDates };
