const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { hasPermission } = require('../lib/permissions');
const { logAudit } = require('../lib/audit');
const { notify, notifyByPermission, resolvePendency } = require('../lib/notify');

const REST_MAX_DAYS = 30;

function requireSession(req) {
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) return null;
  return session;
}

function semesterOf(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

// ---------- Desligamento formal ----------
const mapDeparture = d => ({ ...d, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() });

async function handleDepartures(url, req, res) {
  if (url.pathname !== '/api/departures') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = requireSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const list = await prisma.departureRequest.findMany({ orderBy: { createdAt: 'desc' } });
    send(res, 200, list.map(mapDeparture));
    return true;
  }
  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.department || !item.reason) { send(res, 400, { error: 'Informe departamento e motivo.' }); return true; }
      const created = await prisma.departureRequest.create({
        data: {
          requesterName: session.name, requesterEmail: session.email, requesterRole: session.role,
          department: item.department, reason: item.reason, observations: item.observations || null,
          attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
        },
      });
      await logAudit({ session, action: 'departure.create', entity: 'DepartureRequest', entityId: created.id, after: mapDeparture(created) });
      notifyByPermission({
        permission: 'presidencia.aprovar', excludeEmail: session.email,
        title: 'Desligamento aguardando análise', link: '/gestao/desligamento',
        message: `${session.name} solicitou desligamento do departamento ${created.department}.`,
        kind: 'ACIONAVEL', priority: 'ALTA', entity: 'DepartureRequest', entityId: created.id,
      });
      send(res, 201, mapDeparture(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.departureRequest.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Solicitação não encontrada' }); return true; }
      if (!item.action) { send(res, 400, { error: 'Informe a ação.' }); return true; }
      if (!hasPermission(session, 'presidencia.aprovar') && session.role !== 'PRESIDENCIA') {
        send(res, 403, { error: 'Somente a Presidência pode analisar desligamentos.' });
        return true;
      }
      const data = {};
      if (item.action === 'analyze') data.status = 'EM_ANALISE';
      else if (item.action === 'approve') data.status = 'APROVADO';
      else if (item.action === 'reject') { data.status = 'REJEITADO'; data.rejectedReason = item.rejectedReason || 'Não informado'; }
      else if (item.action === 'finalize') data.status = 'FINALIZADO';
      else { send(res, 400, { error: 'Ação inválida.' }); return true; }

      const updated = await prisma.departureRequest.update({ where: { id: item.id }, data });

      if (item.action === 'finalize') {
        const user = await prisma.user.findUnique({ where: { email: updated.requesterEmail } });
        if (user) await prisma.user.update({ where: { id: user.id }, data: { active: false, leftAt: new Date() } });
      }

      await logAudit({ session, action: `departure.${item.action}`, entity: 'DepartureRequest', entityId: item.id, before: mapDeparture(current), after: mapDeparture(updated) });
      if (['approve', 'reject', 'finalize'].includes(item.action)) {
        notify({ email: updated.requesterEmail, title: 'Desligamento atualizado', message: `Sua solicitação de desligamento foi ${updated.status.toLowerCase()}.`, link: '/gestao/desligamento' });
      }
      if (['approve', 'reject'].includes(item.action)) await resolvePendency({ entity: 'DepartureRequest', entityId: item.id });
      send(res, 200, mapDeparture(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  send(res, 405, { error: 'Método não permitido' });
  return true;
}

// ---------- Descanso da gestão ----------
const mapRest = r => ({ ...r, startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

async function handleRests(url, req, res) {
  if (url.pathname !== '/api/rests') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = requireSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const list = await prisma.restRequest.findMany({ orderBy: { createdAt: 'desc' } });
    send(res, 200, list.map(mapRest));
    return true;
  }
  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.department || !item.startDate || !item.endDate) { send(res, 400, { error: 'Informe departamento, data inicial e final.' }); return true; }
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
      if (!(days > 0)) { send(res, 400, { error: 'Período inválido.' }); return true; }
      if (days > REST_MAX_DAYS) { send(res, 400, { error: `O descanso não pode ultrapassar ${REST_MAX_DAYS} dias.` }); return true; }
      const semester = semesterOf(start);
      const existing = await prisma.restRequest.findFirst({
        where: { requesterEmail: session.email, semester, status: { in: ['SOLICITADO', 'APROVADO'] } },
      });
      if (existing) { send(res, 400, { error: `Você já possui um descanso ${existing.status === 'APROVADO' ? 'aprovado' : 'solicitado'} neste semestre (${semester}).` }); return true; }
      const overlap = await prisma.restRequest.findFirst({
        where: { requesterEmail: session.email, status: { in: ['SOLICITADO', 'APROVADO'] }, startDate: { lte: end }, endDate: { gte: start } },
      });
      if (overlap) { send(res, 400, { error: 'Este período conflita com outra solicitação de descanso.' }); return true; }
      const created = await prisma.restRequest.create({
        data: {
          requesterName: session.name, requesterEmail: session.email, requesterRole: session.role,
          department: item.department, startDate: start, endDate: end, days, semester,
          reason: item.reason || null, substituteName: item.substituteName || null,
        },
      });
      await logAudit({ session, action: 'rest.create', entity: 'RestRequest', entityId: created.id, after: mapRest(created) });
      notifyByPermission({
        permission: 'presidencia.aprovar', excludeEmail: session.email,
        title: 'Descanso aguardando aprovação', link: '/gestao/descanso',
        message: `${session.name} solicitou descanso de ${days} dia(s) (${item.department}).`,
        kind: 'ACIONAVEL', priority: 'NORMAL', entity: 'RestRequest', entityId: created.id,
      });
      send(res, 201, mapRest(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.restRequest.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Solicitação não encontrada' }); return true; }
      if (session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Somente a Presidência pode aprovar descansos.' }); return true; }
      const data = {};
      if (item.action === 'approve') data.status = 'APROVADO';
      else if (item.action === 'reject') { data.status = 'REJEITADO'; data.rejectedReason = item.rejectedReason || 'Não informado'; }
      else { send(res, 400, { error: 'Ação inválida.' }); return true; }
      const updated = await prisma.restRequest.update({ where: { id: item.id }, data });
      await logAudit({ session, action: `rest.${item.action}`, entity: 'RestRequest', entityId: item.id, before: mapRest(current), after: mapRest(updated) });
      notify({ email: updated.requesterEmail, title: 'Descanso da gestão', message: `Seu pedido de descanso foi ${updated.status.toLowerCase()}.`, link: '/gestao/descanso' });
      await resolvePendency({ entity: 'RestRequest', entityId: item.id });
      send(res, 200, mapRest(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  send(res, 405, { error: 'Método não permitido' });
  return true;
}

// ---------- Reuniões e atas ----------
const mapMeeting = m => ({ ...m, date: m.date.toISOString(), createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() });

async function handleMeetings(url, req, res) {
  if (url.pathname !== '/api/meetings') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = requireSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const list = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
    send(res, 200, list.map(mapMeeting));
    return true;
  }
  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.title || !item.date) { send(res, 400, { error: 'Informe título e data.' }); return true; }
      const created = await prisma.meeting.create({
        data: {
          title: item.title, type: item.type || 'Ordinária', date: new Date(item.date), time: item.time || null,
          participants: Array.isArray(item.participants) ? item.participants : undefined,
          participantEmails: Array.isArray(item.participantEmails) ? item.participantEmails : undefined,
          agenda: item.agenda || null, notes: item.notes || null,
          decisions: Array.isArray(item.decisions) ? item.decisions : undefined,
          attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
          createdByName: session.name,
        },
      });
      await logAudit({ session, action: 'meeting.create', entity: 'Meeting', entityId: created.id, after: mapMeeting(created) });
      send(res, 201, mapMeeting(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.meeting.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Reunião não encontrada' }); return true; }
      // Uma vez finalizada, a ata é definitiva.
      if (current.status === 'FINALIZADA' && !item.action) { send(res, 403, { error: 'Ata finalizada não pode ser editada.' }); return true; }
      const data = {};
      if (item.action === 'finalize') {
        data.status = 'FINALIZADA';
      } else {
        if (item.title !== undefined) data.title = item.title;
        if (item.type !== undefined) data.type = item.type;
        if (item.date !== undefined) data.date = new Date(item.date);
        if (item.time !== undefined) data.time = item.time || null;
        if (item.participants !== undefined) data.participants = item.participants;
        if (item.participantEmails !== undefined) data.participantEmails = item.participantEmails;
        if (item.agenda !== undefined) data.agenda = item.agenda || null;
        if (item.notes !== undefined) data.notes = item.notes || null;
        if (item.decisions !== undefined) data.decisions = item.decisions;
        if (item.attachments !== undefined) data.attachments = item.attachments;
      }
      const updated = await prisma.meeting.update({ where: { id: item.id }, data });
      await logAudit({ session, action: item.action === 'finalize' ? 'meeting.finalize' : 'meeting.update', entity: 'Meeting', entityId: item.id, before: mapMeeting(current), after: mapMeeting(updated) });

      // Ao virar ata oficial, cada decisão com responsável vira uma tarefa real — fecha o
      // ciclo Reunião → Ata → Decisão → Tarefa → Responsável → Prazo do pedido, em vez de a
      // decisão ficar só registrada em texto sem cobrança de ninguém.
      if (item.action === 'finalize' && Array.isArray(current.decisions)) {
        for (const decision of current.decisions) {
          if (!decision || !decision.decision || !decision.responsible) continue;
          const task = await prisma.task.create({
            data: {
              title: decision.decision, team: 'Diretoria', owner: decision.responsible, assigner: session.name,
              priority: 'media', dueDate: decision.dueDate ? new Date(decision.dueDate) : null, status: 'todo',
            },
          });
          const responsibleUser = await prisma.user.findFirst({ where: { name: decision.responsible } });
          if (responsibleUser) {
            notify({
              email: responsibleUser.email, title: 'Nova tarefa — decisão de reunião', link: '/gestao/tarefas',
              message: `"${decision.decision}" (decidido em "${updated.title}") ficou sob sua responsabilidade.`,
              kind: 'ACIONAVEL', priority: 'ALTA', entity: 'Task', entityId: task.id,
            }).catch(() => {});
          }
        }
      }

      send(res, 200, mapMeeting(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }
  if (req.method === 'DELETE') {
    try {
      const item = await body(req);
      const current = await prisma.meeting.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Reunião não encontrada' }); return true; }
      if (current.status === 'FINALIZADA') { send(res, 403, { error: 'Atas finalizadas não podem ser excluídas — fazem parte do histórico permanente.' }); return true; }
      await prisma.meeting.delete({ where: { id: item.id } });
      await logAudit({ session, action: 'meeting.delete', entity: 'Meeting', entityId: item.id, before: mapMeeting(current) });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Informe o id da reunião' }); }
    return true;
  }
  send(res, 405, { error: 'Método não permitido' });
  return true;
}

async function handleGestaoInternaRoutes(url, req, res) {
  if (await handleDepartures(url, req, res)) return true;
  if (await handleRests(url, req, res)) return true;
  if (await handleMeetings(url, req, res)) return true;
  return false;
}

module.exports = { handleGestaoInternaRoutes };
