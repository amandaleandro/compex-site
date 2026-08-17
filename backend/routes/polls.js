const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { hasPermission } = require('../lib/permissions');
const { logAudit } = require('../lib/audit');
const { notify, resolvePendency } = require('../lib/notify');

function internalSession(req) {
  const session = resolveSession(bearerToken(req));
  return session && INTERNAL_ROLES.has(session.role) ? session : null;
}

function canSeePoll(poll, session) {
  if (!Array.isArray(poll.audience) || !poll.audience.length) return true;
  return poll.audience.includes(session.role);
}

function computeResults(poll) {
  const options = poll.options;
  const results = options.map((option, index) => ({ option, votes: poll.votes.filter(v => v.optionIndex === index).length }));
  const totalVotes = poll.votes.length;
  const sorted = [...results].sort((a, b) => b.votes - a.votes);
  const tied = sorted.length >= 2 && sorted[0].votes > 0 && sorted[0].votes === sorted[1].votes;
  const winnerIndex = tied ? null : (totalVotes > 0 ? results.findIndex(r => r.votes === sorted[0].votes) : null);
  return { results, totalVotes, tied, winnerIndex };
}

function mapPoll(poll, session) {
  const now = new Date();
  const { results, totalVotes, tied, winnerIndex } = computeResults(poll);
  const mine = poll.votes.find(v => v.voterEmail === session.email);
  const isExpired = poll.expiresAt ? new Date(poll.expiresAt) <= now : false;
  return {
    id: poll.id, title: poll.title, question: poll.question, description: poll.description, rules: poll.rules,
    options: poll.options, audience: poll.audience || null, status: poll.status,
    closed: poll.closed, isExpired, effectiveClosed: poll.status !== 'ABERTA',
    startAt: poll.startAt ? poll.startAt.toISOString() : null,
    expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
    createdBy: poll.createdBy, createdAt: poll.createdAt.toISOString(),
    results, totalVotes, tied, winnerIndex,
    officialWinnerIndex: poll.officialWinnerIndex, validatedByName: poll.validatedByName,
    validatedAt: poll.validatedAt ? poll.validatedAt.toISOString() : null, validationNote: poll.validationNote,
    tieBreakMethod: poll.tieBreakMethod, myVote: mine ? mine.optionIndex : null,
  };
}

async function handlePollRoutes(url, req, res) {
  if (url.pathname === '/api/polls') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, req.method === 'GET' ? 200 : 503, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }

    if (req.method === 'GET') {
      const polls = await prisma.poll.findMany({ include: { votes: true }, orderBy: { createdAt: 'desc' } });
      send(res, 200, polls.filter(p => canSeePoll(p, session)).map(p => mapPoll(p, session)));
      return true;
    }

    if (req.method === 'POST') {
      try {
        const item = await body(req);
        const options = (item.options || []).map(o => String(o).trim()).filter(Boolean);
        if (!item.question || options.length < 2) { send(res, 400, { error: 'Informe a pergunta e ao menos 2 opções.' }); return true; }
        if (!item.expiresAt) { send(res, 400, { error: 'Toda enquete precisa de uma data/hora de encerramento.' }); return true; }
        const expiresAt = new Date(item.expiresAt);
        if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) { send(res, 400, { error: 'O encerramento precisa ser uma data futura.' }); return true; }
        const startAt = item.startAt ? new Date(item.startAt) : null;
        if (startAt && (isNaN(startAt.getTime()) || startAt >= expiresAt)) { send(res, 400, { error: 'O início precisa ser antes do encerramento.' }); return true; }

        let status = 'RASCUNHO';
        if (item.openNow) status = 'ABERTA';
        else if (startAt && startAt > new Date()) status = 'AGENDADA';

        const audience = Array.isArray(item.audience) ? item.audience.filter(r => INTERNAL_ROLES.has(r)) : null;

        const poll = await prisma.poll.create({
          data: {
            title: item.title || item.question, question: item.question, description: item.description || null,
            rules: item.rules || null, options, audience: audience && audience.length ? audience : undefined,
            status, startAt: status === 'ABERTA' ? new Date() : startAt, expiresAt,
            closed: false, createdBy: session.name, createdByEmail: session.email,
          },
          include: { votes: true },
        });
        await logAudit({ session, action: 'poll.create', entity: 'Poll', entityId: poll.id, after: mapPoll(poll, session) });
        send(res, 201, mapPoll(poll, session));
      } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
      return true;
    }

    send(res, 405, { error: 'Método não permitido' });
    return true;
  }

  const actionMatch = url.pathname.match(/^\/api\/polls\/([^/]+)\/(vote|schedule|open|close|validate|correct)$/);
  if (actionMatch && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Indisponível' }); return true; }
    const [, pollId, action] = actionMatch;
    try {
      const current = await prisma.poll.findUnique({ where: { id: pollId }, include: { votes: true } });
      if (!current) { send(res, 404, { error: 'Enquete não encontrada' }); return true; }
      if (!canSeePoll(current, session)) { send(res, 403, { error: 'Esta enquete não é destinada ao seu papel.' }); return true; }
      const item = await body(req).catch(() => ({}));

      if (action === 'vote') {
        const isExpired = current.expiresAt ? new Date(current.expiresAt) <= new Date() : false;
        if (current.status !== 'ABERTA' || isExpired) { send(res, 400, { error: 'Enquete não está aberta para votação.' }); return true; }
        await prisma.pollVote.upsert({
          where: { pollId_voterEmail: { pollId: current.id, voterEmail: session.email } },
          update: { optionIndex: Number(item.optionIndex) },
          create: { pollId: current.id, voterEmail: session.email, optionIndex: Number(item.optionIndex) },
        });
        send(res, 200, { ok: true });
        return true;
      }

      if (action === 'schedule') {
        if (current.status !== 'RASCUNHO') { send(res, 400, { error: 'Só é possível agendar a partir de rascunho.' }); return true; }
        if (!item.startAt) { send(res, 400, { error: 'Informe a data/hora de início.' }); return true; }
        const startAt = new Date(item.startAt);
        if (isNaN(startAt.getTime()) || startAt >= current.expiresAt) { send(res, 400, { error: 'Início inválido ou posterior ao encerramento.' }); return true; }
        const updated = await prisma.poll.update({ where: { id: pollId }, data: { status: 'AGENDADA', startAt }, include: { votes: true } });
        await logAudit({ session, action: 'poll.schedule', entity: 'Poll', entityId: pollId, before: mapPoll(current, session), after: mapPoll(updated, session) });
        send(res, 200, mapPoll(updated, session));
        return true;
      }

      if (action === 'open') {
        if (!['RASCUNHO', 'AGENDADA'].includes(current.status)) { send(res, 400, { error: 'Só é possível abrir a partir de rascunho ou agendada.' }); return true; }
        if (new Date(current.expiresAt) <= new Date()) { send(res, 400, { error: 'O encerramento já passou — ajuste a data antes de abrir.' }); return true; }
        const updated = await prisma.poll.update({ where: { id: pollId }, data: { status: 'ABERTA', startAt: new Date() }, include: { votes: true } });
        await logAudit({ session, action: 'poll.open', entity: 'Poll', entityId: pollId, before: mapPoll(current, session), after: mapPoll(updated, session) });
        send(res, 200, mapPoll(updated, session));
        return true;
      }

      if (action === 'close') {
        if (current.status !== 'ABERTA') { send(res, 400, { error: 'Só é possível encerrar uma enquete aberta.' }); return true; }
        const { tied } = computeResults(current);
        const updated = await prisma.poll.update({ where: { id: pollId }, data: { status: 'ENCERRADA', closed: true, tied }, include: { votes: true } });
        await logAudit({ session, action: 'poll.close', entity: 'Poll', entityId: pollId, before: mapPoll(current, session), after: mapPoll(updated, session) });
        if (updated.createdByEmail) {
          notify({
            email: updated.createdByEmail, title: 'Enquete encerrada — validar resultado', link: '/gestao/enquetes',
            message: `"${updated.question}" encerrou${tied ? ' em empate' : ''} e aguarda validação do resultado.`,
            kind: 'ACIONAVEL', priority: tied ? 'ALTA' : 'NORMAL', entity: 'Poll', entityId: updated.id,
          }).catch(() => {});
        }
        send(res, 200, mapPoll(updated, session));
        return true;
      }

      if (action === 'validate' || action === 'correct') {
        if (!hasPermission(session, 'enquetes.validar')) { send(res, 403, { error: 'Sem permissão para validar resultados.' }); return true; }
        if (action === 'validate' && current.status !== 'ENCERRADA') { send(res, 400, { error: 'Só é possível validar uma enquete encerrada.' }); return true; }
        if (action === 'correct' && current.status !== 'VALIDADA') { send(res, 400, { error: 'Só é possível corrigir um resultado já validado.' }); return true; }
        const { tied, winnerIndex } = computeResults(current);
        let officialWinnerIndex = winnerIndex;
        if (tied || item.officialWinnerIndex !== undefined) {
          if (item.officialWinnerIndex === undefined || item.officialWinnerIndex === null) {
            send(res, 400, { error: 'Enquete empatada — informe a opção vencedora e o método de desempate.' });
            return true;
          }
          officialWinnerIndex = Number(item.officialWinnerIndex);
        }
        if (tied && !item.tieBreakMethod) { send(res, 400, { error: 'Informe como o empate foi resolvido.' }); return true; }
        if (action === 'correct' && !item.validationNote) { send(res, 400, { error: 'Toda correção precisa de uma justificativa.' }); return true; }

        const updated = await prisma.poll.update({
          where: { id: pollId },
          data: {
            status: 'VALIDADA', officialWinnerIndex, validatedByName: session.name, validatedAt: new Date(),
            validationNote: item.validationNote || null, tieBreakMethod: item.tieBreakMethod || current.tieBreakMethod || null,
          },
          include: { votes: true },
        });
        await logAudit({
          session, action: action === 'correct' ? 'poll.correct' : 'poll.validate', entity: 'Poll', entityId: pollId,
          before: mapPoll(current, session), after: mapPoll(updated, session), note: item.validationNote || null,
        });
        await resolvePendency({ entity: 'Poll', entityId: pollId });
        if (action === 'validate' && updated.createdByEmail) {
          notify({
            email: updated.createdByEmail, title: 'Resultado da enquete validado', link: '/gestao/enquetes',
            message: `"${updated.question}" — vencedora: ${updated.options[officialWinnerIndex]}.`,
            kind: 'INFORMATIVA', entity: 'Poll', entityId: updated.id,
            whatsapp: { templateKey: 'resultado_enquete', variables: { pergunta: updated.question, vencedora: updated.options[officialWinnerIndex] } },
          }).catch(() => {});
        }
        send(res, 200, mapPoll(updated, session));
        return true;
      }
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  const deleteMatch = url.pathname.match(/^\/api\/polls\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Indisponível' }); return true; }
    try {
      const current = await prisma.poll.findUnique({ where: { id: deleteMatch[1] } });
      if (!current) { send(res, 404, { error: 'Enquete não encontrada' }); return true; }
      if (!['RASCUNHO', 'AGENDADA'].includes(current.status)) {
        send(res, 400, { error: 'Só é possível excluir enquetes que ainda não abriram.' });
        return true;
      }
      await prisma.pollVote.deleteMany({ where: { pollId: deleteMatch[1] } });
      await prisma.poll.delete({ where: { id: deleteMatch[1] } });
      await logAudit({ session, action: 'poll.delete', entity: 'Poll', entityId: deleteMatch[1], before: current });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 500, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  return false;
}

module.exports = { handlePollRoutes };
