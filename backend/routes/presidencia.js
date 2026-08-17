const { prisma } = require('../db');
const { send } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

// Central da Presidência: agrega tudo que precisa de atenção agora, num único payload,
// pra não obrigar a Presidência a abrir tela por tela procurando pendência.
async function handlePresidenciaSummary(url, req, res) {
  if (url.pathname !== '/api/presidencia-summary' || req.method !== 'GET') return false;
  if (!prisma) { send(res, 200, {}); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência' }); return true; }

  const now = new Date();
  const [
    pendingRequests, pendingDepartures, pendingRests, overdueTransactions,
    openTasks, incompleteSchedules, upcomingGames,
    overdueLoans, unpaidProofTransactions, overdueRequests, pendingAttendances,
    followUpNotifications, pendingRequestCount, pendingScheduleCount, pendingPollCount, latePlanCount,
  ] = await Promise.all([
    prisma.request.findMany({ where: { status: { in: ['PRESIDENCIA', 'SOLICITADO', 'APROVACAO_DIRETOR', 'FINANCEIRO'] } }, orderBy: { createdAt: 'asc' } }),
    prisma.departureRequest.findMany({ where: { status: { in: ['SOLICITADO', 'EM_ANALISE'] } }, orderBy: { createdAt: 'asc' } }),
    prisma.restRequest.findMany({ where: { status: 'SOLICITADO' }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({ where: { status: 'PENDING', dueDate: { lt: now } }, orderBy: { dueDate: 'asc' } }),
    prisma.task.findMany({ where: { status: { not: 'done' }, dueDate: { lt: now } } }),
    prisma.schedule.findMany({ where: { status: { in: ['AGUARDANDO', 'TROCA_SOLICITADA', 'RECUSADO'] }, date: { gte: now } }, orderBy: { date: 'asc' } }),
    prisma.teamSession.findMany({ where: { type: 'JOGO', date: { gte: now } }, orderBy: { date: 'asc' }, take: 5, include: { team: true } }),
    // Alertas: material retirado do patrimônio e não devolvido no prazo.
    prisma.assetLoan.findMany({ where: { status: { not: 'DEVOLVIDO' }, expectedReturn: { lt: now } }, orderBy: { expectedReturn: 'asc' }, take: 10, include: { asset: true } }),
    // Alertas: pagamento marcado como pago sem comprovante anexado.
    prisma.transaction.findMany({ where: { status: 'PAID', proofUrl: null }, orderBy: { createdAt: 'desc' }, take: 10 }),
    // Alertas: solicitação com vencimento passado e ainda não paga/finalizada.
    prisma.request.findMany({ where: { dueDate: { lt: now }, status: { notIn: ['FINALIZADO', 'REJEITADO', 'PAGO', 'RASCUNHO'] } }, orderBy: { dueDate: 'asc' }, take: 10 }),
    // Alertas: convocação (jogo publicado nos próximos 7 dias) com atletas sem resposta.
    prisma.sessionAttendance.findMany({
      where: { status: 'PENDING', session: { type: 'JOGO', published: true, date: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } } },
      include: { session: { include: { team: true } }, member: { include: { user: true } } },
      take: 20,
    }),
    // "Precisam de cobrança" — pendências acionáveis de alta prioridade, agrupadas por pessoa
    // (motor de pendências da Etapa 1: toda pendência real do sistema já vira Notification ACIONAVEL).
    prisma.notification.findMany({ where: { kind: 'ACIONAVEL', resolved: false, priority: { in: ['ALTA', 'CRITICA'] } }, orderBy: { createdAt: 'asc' } }),
    // Mesma contagem usada em /api/meetings/suggested-agenda — "existem N assuntos que podem
    // exigir uma reunião" (seção 43), sem duplicar a query de listagem completa aqui.
    prisma.request.count({ where: { status: { in: ['SOLICITADO', 'FINANCEIRO', 'PRESIDENCIA'] } } }),
    prisma.schedule.count({ where: { status: 'AGUARDANDO' } }),
    prisma.poll.count({ where: { status: 'ENCERRADA' } }),
    prisma.departmentPlan.count({ where: { status: 'ATRASADO' } }),
  ]);
  const suggestedAgendaCount = pendingRequestCount + pendingScheduleCount + pendingPollCount + latePlanCount;

  const followUpGrouped = Object.values(
    followUpNotifications.reduce((acc, n) => {
      if (!acc[n.userEmail]) acc[n.userEmail] = { email: n.userEmail, count: 0, sample: n.title };
      acc[n.userEmail].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);
  const followUpUsers = await prisma.user.findMany({ where: { email: { in: followUpGrouped.map(f => f.email) } }, select: { email: true, name: true } });
  const nameByEmail = new Map(followUpUsers.map(u => [u.email, u.name]));
  const followUpByPerson = followUpGrouped.map(f => ({ ...f, name: nameByEmail.get(f.email) || f.email }));

  send(res, 200, {
    approvals: {
      requests: pendingRequests.map(r => ({ id: r.id, description: r.description, department: r.department, status: r.status, valuePlanned: r.valuePlanned ? Number(r.valuePlanned) : null, createdAt: r.createdAt.toISOString() })),
      departures: pendingDepartures.map(d => ({ id: d.id, requesterName: d.requesterName, department: d.department, status: d.status, createdAt: d.createdAt.toISOString() })),
      rests: pendingRests.map(r => ({ id: r.id, requesterName: r.requesterName, department: r.department, days: r.days, createdAt: r.createdAt.toISOString() })),
    },
    finance: {
      overdueCount: overdueTransactions.length,
      overdue: overdueTransactions.slice(0, 10).map(t => ({ id: t.id, description: t.description, amount: Number(t.amount), dueDate: t.dueDate ? t.dueDate.toISOString() : null })),
    },
    departments: {
      overdueTasksCount: openTasks.length,
    },
    esportes: {
      incompleteSchedulesCount: incompleteSchedules.length,
      incompleteSchedules: incompleteSchedules.slice(0, 10).map(s => ({ id: s.id, referenceLabel: s.referenceLabel, function: s.function, status: s.status, date: s.date.toISOString() })),
      upcomingGames: upcomingGames.map(g => ({ id: g.id, teamName: g.team.name, date: g.date.toISOString(), location: g.location })),
    },
    alerts: {
      overdueLoans: overdueLoans.map(l => ({ id: l.id, assetName: l.asset.name, borrowerName: l.borrowerName, expectedReturn: l.expectedReturn ? l.expectedReturn.toISOString() : null })),
      overdueLoansCount: overdueLoans.length,
      unpaidProofTransactions: unpaidProofTransactions.map(t => ({ id: t.id, description: t.description, amount: Number(t.amount), favorecido: t.favorecido })),
      unpaidProofTransactionsCount: unpaidProofTransactions.length,
      overdueRequests: overdueRequests.map(r => ({ id: r.id, description: r.description, department: r.department, status: r.status, dueDate: r.dueDate ? r.dueDate.toISOString() : null })),
      overdueRequestsCount: overdueRequests.length,
      pendingConfirmations: Object.values(
        pendingAttendances.reduce((acc, a) => {
          const key = a.sessionId;
          if (!acc[key]) acc[key] = { sessionId: key, teamName: a.session.team.name, date: a.session.date.toISOString(), pendingCount: 0 };
          acc[key].pendingCount += 1;
          return acc;
        }, {})
      ),
      pendingConfirmationsCount: pendingAttendances.length,
    },
    // "Precisam de cobrança" (seção 42 do pedido): quem tem mais pendências acionáveis abertas.
    needsFollowUp: followUpByPerson.slice(0, 10),
    // "Existem N assuntos relevantes que podem exigir uma reunião" (seção 43) — mesma contagem
    // usada em /api/meetings/suggested-agenda, só o número, pra não duplicar a query aqui.
    meetingSuggestionCount: suggestedAgendaCount,
  });
  return true;
}

module.exports = { handlePresidenciaSummary };
