const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { logAudit } = require('../lib/audit');
const { notify } = require('../lib/notify');

const FUNCTIONS = new Set([
  'SUMULA', 'APOIO_JOGO', 'BANDEIRAO', 'MATERIAL', 'TORCIDA', 'FOTOGRAFIA', 'SOCIAL_MEDIA',
  'EVENTOS', 'BARRACAS', 'RECEPCAO', 'VENDA_INGRESSOS', 'TRANSPORTE', 'ORGANIZACAO', 'OUTRA',
]);

const mapSchedule = s => ({ ...s, date: s.date.toISOString(), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() });

async function handleScheduleRoutes(url, req, res) {
  if (url.pathname !== '/api/schedules') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const list = await prisma.schedule.findMany({ orderBy: { date: 'asc' } });
    send(res, 200, list.map(mapSchedule));
    return true;
  }

  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.referenceLabel || !FUNCTIONS.has(item.function) || !item.assignedName || !item.date) {
        send(res, 400, { error: 'Informe evento/jogo, função, responsável e data.' });
        return true;
      }
      const created = await prisma.schedule.create({
        data: {
          referenceLabel: item.referenceLabel, function: item.function, assignedName: item.assignedName,
          assignedEmail: item.assignedEmail || null, date: new Date(item.date), time: item.time || null,
          location: item.location || null, instructions: item.instructions || null, createdByName: session.name,
        },
      });
      await logAudit({ session, action: 'schedule.create', entity: 'Schedule', entityId: created.id, after: mapSchedule(created) });
      if (created.assignedEmail) notify({ email: created.assignedEmail, title: 'Nova escala', message: `Você foi escalado(a) para ${created.referenceLabel} (${created.function}).`, link: '/gestao/escalas' });
      send(res, 201, mapSchedule(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.schedule.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Escala não encontrada' }); return true; }
      const data = {};
      if (item.action === 'confirm') data.status = 'CONFIRMADO';
      else if (item.action === 'request_swap') data.status = 'TROCA_SOLICITADA';
      else if (item.action === 'unavailable') data.status = 'RECUSADO';
      else if (item.action === 'substitute') { data.status = 'SUBSTITUIDO'; data.substituteName = item.substituteName || null; }
      else if (item.action === 'complete') data.status = 'CONCLUIDO';
      else {
        if (item.referenceLabel !== undefined) data.referenceLabel = item.referenceLabel;
        if (item.function !== undefined && FUNCTIONS.has(item.function)) data.function = item.function;
        if (item.assignedName !== undefined) data.assignedName = item.assignedName;
        if (item.assignedEmail !== undefined) data.assignedEmail = item.assignedEmail || null;
        if (item.date !== undefined) data.date = new Date(item.date);
        if (item.time !== undefined) data.time = item.time || null;
        if (item.location !== undefined) data.location = item.location || null;
        if (item.instructions !== undefined) data.instructions = item.instructions || null;
      }
      const updated = await prisma.schedule.update({ where: { id: item.id }, data });
      await logAudit({ session, action: item.action ? `schedule.${item.action}` : 'schedule.update', entity: 'Schedule', entityId: item.id, before: mapSchedule(current), after: mapSchedule(updated) });
      send(res, 200, mapSchedule(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'DELETE') {
    try {
      const item = await body(req);
      const removed = await prisma.schedule.delete({ where: { id: item.id } });
      await logAudit({ session, action: 'schedule.delete', entity: 'Schedule', entityId: item.id, before: mapSchedule(removed) });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Informe o id da escala' }); }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

module.exports = { handleScheduleRoutes };
