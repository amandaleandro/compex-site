const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

function internalSession(req) {
  const session = resolveSession(bearerToken(req));
  return session && INTERNAL_ROLES.has(session.role) ? session : null;
}

function toMinutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function toHHMM(minutes) { const h = Math.floor(minutes / 60).toString().padStart(2, '0'); const m = (minutes % 60).toString().padStart(2, '0'); return `${h}:${m}`; }
function dateKey(date) { return date.toISOString().slice(0, 10); }

// GET /api/meetings/directory — diretório leve (nome/e-mail/papel) para montar a lista de
// participantes de uma reunião. Diferente de /api/directors (restrito à Presidência/gestão
// de contas), qualquer sessão interna pode consultar para convidar gente de outros times.
async function handleDirectory(url, req, res) {
  if (url.pathname !== '/api/meetings/directory' || req.method !== 'GET') return false;
  const session = internalSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
  if (!prisma) { send(res, 200, []); return true; }
  const users = await prisma.user.findMany({ where: { role: { not: 'ASSOCIADO' }, active: true }, orderBy: { name: 'asc' }, select: { name: true, email: true, role: true } });
  send(res, 200, users);
  return true;
}

// GET /api/meetings/suggested-agenda — analisa pendências reais do sistema e sugere pautas,
// em vez de a Presidência ter que lembrar manualmente do que está parado.
async function handleSuggestedAgenda(url, req, res) {
  if (url.pathname !== '/api/meetings/suggested-agenda' || req.method !== 'GET') return false;
  const session = internalSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
  if (!prisma) { send(res, 200, []); return true; }

  const now = new Date();
  const suggestions = [];

  const pendingRequests = await prisma.request.findMany({
    where: { status: { in: ['SOLICITADO', 'FINANCEIRO', 'PRESIDENCIA'] } },
    orderBy: { createdAt: 'asc' }, take: 5,
  });
  for (const r of pendingRequests) {
    const overdue = r.dueDate && r.dueDate < now;
    suggestions.push({
      origin: 'Solicitação', reason: `"${r.description}" aguarda aprovação${overdue ? ' e está com prazo vencido' : ''} (${r.department}).`,
      priority: overdue ? 'ALTA' : 'NORMAL', responsible: r.requesterName, link: '/gestao/solicitacoes', refId: r.id,
    });
  }

  const unconfirmedSchedules = await prisma.schedule.findMany({ where: { status: 'AGUARDANDO' }, orderBy: { date: 'asc' }, take: 5 });
  for (const s of unconfirmedSchedules) {
    suggestions.push({
      origin: 'Escala', reason: `Convocação para "${s.referenceLabel}" (${s.function}) ainda sem resposta de ${s.assignedName}.`,
      priority: 'NORMAL', responsible: s.assignedName, link: '/gestao/escalas', refId: s.id,
    });
  }

  const pollsAwaitingValidation = await prisma.poll.findMany({ where: { status: 'ENCERRADA' }, orderBy: { createdAt: 'asc' }, take: 5 });
  for (const p of pollsAwaitingValidation) {
    suggestions.push({
      origin: 'Enquete', reason: `"${p.question}" encerrou${p.tied ? ' em empate' : ''} e precisa de validação do resultado.`,
      priority: p.tied ? 'ALTA' : 'NORMAL', responsible: p.createdBy, link: '/gestao/enquetes', refId: p.id,
    });
  }

  const latePlans = await prisma.departmentPlan.findMany({ where: { status: 'ATRASADO' }, orderBy: { dueDate: 'asc' }, take: 5 });
  for (const plan of latePlans) {
    suggestions.push({
      origin: 'Planejamento', reason: `Objetivo "${plan.objective}" do departamento ${plan.department} está atrasado.`,
      priority: 'ALTA', responsible: plan.responsible, link: '/gestao/departamentos', refId: plan.id,
    });
  }

  const priorityOrder = { CRITICA: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };
  suggestions.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  send(res, 200, suggestions);
  return true;
}

// Carrega, numa janela de datas, tudo que pode gerar conflito para os e-mails informados:
// outras reuniões, descanso da gestão, escalas e sessões de time (jogo/treino, casadas por
// nome do técnico — TeamSession não guarda e-mail do responsável).
async function loadConflictSources(emails, from, to) {
  const [meetings, rests, schedules, sessions, users] = await Promise.all([
    prisma.meeting.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.restRequest.findMany({ where: { requesterEmail: { in: emails }, status: { in: ['SOLICITADO', 'APROVADO'] }, startDate: { lte: to }, endDate: { gte: from } } }),
    prisma.schedule.findMany({ where: { assignedEmail: { in: emails }, date: { gte: from, lte: to } } }),
    prisma.teamSession.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true } }),
  ]);
  const nameByEmail = new Map(users.map(u => [u.email, u.name.trim().toLowerCase()]));
  return { meetings, rests, schedules, sessions, nameByEmail };
}

// Verifica, para um e-mail e um intervalo [t, slotEnd) num dia específico, se há conflito.
// Retorna { reason } se houver, ou null se estiver livre (não olha disponibilidade recorrente —
// isso é feito à parte, só para a busca de sugestões).
function findConflict(email, date, key, weekday, t, slotEnd, sources) {
  const { meetings, rests, schedules, sessions, nameByEmail } = sources;

  const conflictMeeting = meetings.find(m => Array.isArray(m.participantEmails) && m.participantEmails.includes(email) && dateKey(m.date) === key && m.time && (() => { const s = toMinutes(m.time); return s < slotEnd && s + 60 > t; })());
  if (conflictMeeting) return { reason: `Já tem outra reunião nesse horário (${conflictMeeting.title})` };

  const conflictRest = rests.find(r => r.requesterEmail === email && date >= r.startDate && date <= r.endDate);
  if (conflictRest) return { reason: 'Em descanso da gestão' };

  const conflictSchedule = schedules.find(s => s.assignedEmail === email && dateKey(s.date) === key && s.time && (() => { const st = toMinutes(s.time); return st < slotEnd && st + 60 > t; })());
  if (conflictSchedule) return { reason: `Escalado para ${conflictSchedule.referenceLabel}` };

  const name = nameByEmail.get(email);
  if (name) {
    const conflictSession = sessions.find(s => s.coachName && s.coachName.trim().toLowerCase() === name && dateKey(s.date) === key && (() => { const st = s.date.getHours() * 60 + s.date.getMinutes(); return st < slotEnd && st + 90 > t; })());
    if (conflictSession) return { reason: `Compromisso de ${conflictSession.type === 'JOGO' ? 'jogo' : 'treino'} como técnico` };
  }

  return null;
}

// POST /api/meetings/suggest-times — cruza disponibilidade recorrente + compromissos já
// marcados (reuniões, escalas, descansos, jogos/treinos) dos participantes e devolve os
// melhores horários. Nunca marca nada sozinho — só devolve sugestões para quem organiza decidir.
async function handleSuggestTimes(url, req, res) {
  if (url.pathname !== '/api/meetings/suggest-times' || req.method !== 'POST') return false;
  const session = internalSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
  if (!prisma) { send(res, 200, []); return true; }

  try {
    const item = await body(req);
    const emails = Array.isArray(item.participantEmails) ? [...new Set(item.participantEmails.filter(Boolean))] : [];
    if (!emails.length) { send(res, 400, { error: 'Informe ao menos um participante.' }); return true; }
    const duration = Number(item.durationMinutes) > 0 ? Number(item.durationMinutes) : 60;
    const windowDays = Number(item.windowDays) > 0 ? Math.min(Number(item.windowDays), 30) : 14;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today.getTime() + windowDays * 24 * 60 * 60 * 1000);

    const [availability, sources] = await Promise.all([
      prisma.memberAvailability.findMany({ where: { userEmail: { in: emails } } }),
      loadConflictSources(emails, today, windowEnd),
    ]);

    const availabilityByEmail = new Map(emails.map(e => [e, availability.filter(a => a.userEmail === e)]));
    const emailsWithNoData = new Set(emails.filter(e => availabilityByEmail.get(e).length === 0));

    const START_MIN = toMinutes('08:00');
    const END_MIN = toMinutes('21:00');
    const STEP = 30;

    const candidates = [];
    for (let dayOffset = 0; dayOffset < windowDays; dayOffset += 1) {
      const date = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const weekday = date.getDay();
      const key = dateKey(date);

      for (let t = START_MIN; t + duration <= END_MIN; t += STEP) {
        const slotEnd = t + duration;
        const unavailable = [];

        for (const email of emails) {
          const conflict = findConflict(email, date, key, weekday, t, slotEnd, sources);
          if (conflict) { unavailable.push({ email, reason: conflict.reason }); continue; }

          if (!emailsWithNoData.has(email)) {
            const slots = availabilityByEmail.get(email).filter(a => a.weekday === weekday);
            const fits = slots.some(a => toMinutes(a.startTime) <= t && toMinutes(a.endTime) >= slotEnd);
            if (!fits) { unavailable.push({ email, reason: 'Fora da disponibilidade cadastrada' }); continue; }
          }
        }

        const availableCount = emails.length - unavailable.length;
        if (availableCount > 0) candidates.push({ date: key, time: toHHMM(t), availableCount, totalCount: emails.length, unavailable });
      }
    }

    candidates.sort((a, b) => b.availableCount - a.availableCount || (a.date + a.time).localeCompare(b.date + b.time));
    send(res, 200, candidates.slice(0, 8));
  } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
  return true;
}

// POST /api/meetings/check-conflicts — checagem pontual pra uma data/hora já escolhida
// (usado também no formulário manual de criação de reunião, não só no fluxo "Preparar reunião").
async function handleCheckConflicts(url, req, res) {
  if (url.pathname !== '/api/meetings/check-conflicts' || req.method !== 'POST') return false;
  const session = internalSession(req);
  if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
  if (!prisma) { send(res, 200, { conflicts: [] }); return true; }

  try {
    const item = await body(req);
    const emails = Array.isArray(item.participantEmails) ? [...new Set(item.participantEmails.filter(Boolean))] : [];
    if (!emails.length || !item.date || !item.time) { send(res, 200, { conflicts: [] }); return true; }
    const duration = Number(item.durationMinutes) > 0 ? Number(item.durationMinutes) : 60;
    // Mesmo parsing usado ao criar Meeting/Schedule (string "YYYY-MM-DD" pura vira meia-noite UTC) —
    // misturar com horário local aqui faria o intervalo gte/lte da consulta perder o registro certo.
    const date = new Date(String(item.date).slice(0, 10));
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
    const key = dateKey(date);
    const weekday = date.getUTCDay();
    const t = toMinutes(item.time);
    const slotEnd = t + duration;

    const sources = await loadConflictSources(emails, date, dayEnd);
    const conflicts = [];
    for (const email of emails) {
      const conflict = findConflict(email, date, key, weekday, t, slotEnd, sources);
      if (conflict) conflicts.push({ email, reason: conflict.reason });
    }
    send(res, 200, { conflicts });
  } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
  return true;
}

async function handleMeetingPlanningRoutes(url, req, res) {
  if (await handleDirectory(url, req, res)) return true;
  if (await handleSuggestedAgenda(url, req, res)) return true;
  if (await handleSuggestTimes(url, req, res)) return true;
  if (await handleCheckConflicts(url, req, res)) return true;
  return false;
}

module.exports = { handleMeetingPlanningRoutes };
