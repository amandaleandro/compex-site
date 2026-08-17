const { prisma } = require('../db');
const { notify, notifyByPermission } = require('./notify');

// Regras de lembrete/escalonamento por prazo. Chaveado por tipo para permitir prazos
// diferentes no futuro sem espalhar números mágicos pelo código.
const RULES = {
  Request: {
    dueSoonHours: 48, // lembrete quando faltar <= 48h para o prazo
    escalateAfterDays: 2, // após N dias de atraso, escala para a Presidência
  },
  Task: {
    dueSoonHours: 24,
    escalateAfterDays: 3,
  },
};

const ACTIVE_REQUEST_STATUS = ['SOLICITADO', 'FINANCEIRO', 'PRESIDENCIA', 'APROVADO', 'PAGO'];

// Cada estágio (DUE_SOON/OVERDUE/ESCALATED) só é disparado uma vez por entity+entityId:
// a própria notificação enviada carrega o remindStage, então basta checar se já existe.
async function alreadySent(entity, entityId, stage) {
  const found = await prisma.notification.findFirst({ where: { entity, entityId, remindStage: stage } });
  return !!found;
}

async function sweepRequestReminders() {
  const rule = RULES.Request;
  const now = Date.now();
  const dueSoonLimit = new Date(now + rule.dueSoonHours * 60 * 60 * 1000);
  const requests = await prisma.request.findMany({
    where: { status: { in: ACTIVE_REQUEST_STATUS }, dueDate: { not: null } },
  });

  for (const req of requests) {
    const overdue = req.dueDate < new Date(now);
    const dueSoon = !overdue && req.dueDate <= dueSoonLimit;

    if (dueSoon && !(await alreadySent('Request', req.id, 'DUE_SOON'))) {
      await notify({
        email: req.requesterEmail, title: 'Prazo próximo', link: '/gestao/solicitacoes',
        message: `"${req.description}" vence em breve.`, kind: 'INFORMATIVA', priority: 'ALTA',
        entity: 'Request', entityId: req.id, remindStage: 'DUE_SOON',
      });
    }

    if (overdue) {
      const overdueDays = Math.floor((now - req.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (!(await alreadySent('Request', req.id, 'OVERDUE'))) {
        await notify({
          email: req.requesterEmail, title: 'Solicitação atrasada', link: '/gestao/solicitacoes',
          message: `"${req.description}" está com o prazo vencido.`, kind: 'ACIONAVEL', priority: 'ALTA',
          entity: 'Request', entityId: req.id, remindStage: 'OVERDUE',
        });
      }
      if (overdueDays >= rule.escalateAfterDays && !(await alreadySent('Request', req.id, 'ESCALATED'))) {
        await notifyByPermission({
          permission: 'presidencia.aprovar', excludeEmail: req.requesterEmail,
          title: 'Solicitação atrasada há dias — atenção Presidência', link: '/gestao/solicitacoes',
          message: `"${req.description}" (${req.requesterName}) está atrasada há ${overdueDays} dia(s).`,
          kind: 'ACIONAVEL', priority: 'CRITICA', entity: 'Request', entityId: req.id, remindStage: 'ESCALATED',
          whatsapp: { templateKey: 'solicitacao_atrasada', variables: { descricao: req.description, solicitante: req.requesterName, dias: overdueDays } },
        });
      }
    }
  }
}

// Lembrete/escalonamento de Task (atividade atribuída, incluindo as geradas automaticamente
// a partir de decisões de reunião — ver routes/gestao-interna.js). `owner` só guarda o nome,
// então resolve o e-mail/telefone via User antes de notificar; sem User correspondente, ignora
// silenciosamente (não há como avisar quem não está cadastrado).
async function sweepTaskReminders() {
  const rule = RULES.Task;
  const now = Date.now();
  const dueSoonLimit = new Date(now + rule.dueSoonHours * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({ where: { status: { not: 'done' }, dueDate: { not: null } } });

  for (const task of tasks) {
    const owner = task.owner && task.owner !== '--' ? await prisma.user.findFirst({ where: { name: task.owner } }) : null;
    if (!owner) continue;

    const overdue = task.dueDate < new Date(now);
    const dueSoon = !overdue && task.dueDate <= dueSoonLimit;
    const prazo = task.dueDate.toLocaleDateString('pt-BR');

    if (dueSoon && !(await alreadySent('Task', task.id, 'DUE_SOON'))) {
      await notify({
        email: owner.email, title: 'Prazo próximo', link: '/gestao/tarefas',
        message: `"${task.title}" vence em breve.`, kind: 'INFORMATIVA', priority: 'NORMAL',
        entity: 'Task', entityId: task.id, remindStage: 'DUE_SOON',
      });
    }

    if (overdue) {
      const overdueDays = Math.floor((now - task.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (!(await alreadySent('Task', task.id, 'OVERDUE'))) {
        await notify({
          email: owner.email, title: 'Tarefa atrasada', link: '/gestao/tarefas',
          message: `"${task.title}" está com o prazo vencido.`, kind: 'ACIONAVEL', priority: 'ALTA',
          entity: 'Task', entityId: task.id, remindStage: 'OVERDUE',
          whatsapp: { templateKey: 'atividade_atrasada', variables: { atividade: task.title, prazo } },
        });
      }
      if (overdueDays >= rule.escalateAfterDays && !(await alreadySent('Task', task.id, 'ESCALATED'))) {
        await notifyByPermission({
          permission: 'presidencia.aprovar', excludeEmail: owner.email,
          title: 'Tarefa atrasada há dias — atenção Presidência', link: '/gestao/tarefas',
          message: `"${task.title}" (${task.owner}, ${task.team}) está atrasada há ${overdueDays} dia(s).`,
          kind: 'ACIONAVEL', priority: 'CRITICA', entity: 'Task', entityId: task.id, remindStage: 'ESCALATED',
          whatsapp: { templateKey: 'atividade_atrasada', variables: { atividade: `${task.title} (${task.owner})`, prazo } },
        });
      }
    }
  }
}

// Promove notícias AGENDADO -> PUBLICADO quando o horário definido é atingido.
async function sweepScheduledNews() {
  const due = await prisma.news.findMany({ where: { status: 'AGENDADO', publishAt: { lte: new Date() } } });
  for (const item of due) {
    await prisma.news.update({ where: { id: item.id }, data: { status: 'PUBLICADO', published: true } });
  }
}

// Promove enquetes AGENDADA -> ABERTA quando startAt é atingido, e ABERTA -> ENCERRADA
// quando expiresAt é atingido (calculando empate e cobrando validação de quem criou).
async function sweepPolls() {
  const now = new Date();

  const toOpen = await prisma.poll.findMany({ where: { status: 'AGENDADA', startAt: { lte: now } } });
  for (const poll of toOpen) {
    await prisma.poll.update({ where: { id: poll.id }, data: { status: 'ABERTA' } });
  }

  const toClose = await prisma.poll.findMany({ where: { status: 'ABERTA', expiresAt: { lte: now } }, include: { votes: true } });
  for (const poll of toClose) {
    const results = poll.options.map((_, index) => poll.votes.filter(v => v.optionIndex === index).length);
    const sorted = [...results].sort((a, b) => b - a);
    const tied = sorted.length >= 2 && sorted[0] > 0 && sorted[0] === sorted[1];
    await prisma.poll.update({ where: { id: poll.id }, data: { status: 'ENCERRADA', closed: true, tied } });
    if (poll.createdByEmail) {
      await notify({
        email: poll.createdByEmail, title: 'Enquete encerrada — validar resultado', link: '/gestao/enquetes',
        message: `"${poll.question}" encerrou${tied ? ' em empate' : ''} e aguarda validação do resultado.`,
        kind: 'ACIONAVEL', priority: tied ? 'ALTA' : 'NORMAL', entity: 'Poll', entityId: poll.id,
      });
    }
  }
}

// Varredura completa — chamada periodicamente pelo servidor (ver server.js).
// Nunca deve derrubar o processo se algo falhar.
async function runReminderSweep() {
  if (!prisma) return;
  try {
    await sweepRequestReminders();
    await sweepTaskReminders();
    await sweepScheduledNews();
    await sweepPolls();
  } catch (error) {
    console.error('[reminders]', error);
  }
}

module.exports = { runReminderSweep, sweepTaskReminders };
