const { prisma } = require('../db');

// Registra uma ação administrativa relevante. Nunca deve derrubar a request principal
// se a gravação da auditoria falhar — loga o erro e segue.
async function logAudit({ session, action, entity, entityId = null, before = null, after = null, note = null }) {
  if (!prisma) return;
  try {
    await prisma.auditLog.create({
      data: {
        actorId: session?.email || null,
        actorName: session?.name || 'Sistema',
        actorRole: session?.role || null,
        action,
        entity,
        entityId,
        before: before === null ? undefined : before,
        after: after === null ? undefined : after,
        note,
      },
    });
  } catch (error) {
    console.error('[audit]', error);
  }
}

module.exports = { logAudit };
