const { prisma } = require('../db');
const { paymentClient } = require('../mercadopago');

// Vôlei ocupa 2 vagas de esporte do sócio; as demais modalidades ocupam 1.
function teamSlotWeight(team) { return /v[oô]lei/i.test(team.name) || /v[oô]lei/i.test(team.sport) ? 2 : 1; }

// Gera uma cobrança PIX (Payment API do Mercado Pago) para uma SessionCharge já criada.
// Se não houver credencial configurada (dev/local), a cobrança fica registrada como PENDING sem QR — sem erro.
async function tryGeneratePixForCharge(charge, member, description) {
  const client = paymentClient();
  if (!client) return;
  try {
    const payment = await client.create({
      body: {
        transaction_amount: charge.amountCents / 100,
        description,
        payment_method_id: 'pix',
        payer: { email: member.userEmail || member.user?.email },
        external_reference: `sessioncharge:${charge.id}`,
      },
    });
    const txData = payment?.point_of_interaction?.transaction_data;
    await prisma.sessionCharge.update({ where: { id: charge.id }, data: { mpPaymentId: String(payment.id), pixQrCode: txData?.qr_code || null, pixQrBase64: txData?.qr_code_base64 || null } });
  } catch (error) {
    console.error('Falha ao gerar PIX da cobrança de sessão:', error.message);
  }
}

// Cria as cobranças PIX de uma sessão (treino ou jogo):
// - Treino: só atletas avulsos pagam o valor de treino/jogo da modalidade.
// - Jogo com juiz cadastrado: o custo do juiz é dividido entre TODOS os vinculados à modalidade
//   (sócio paga só a parte do juiz; avulso paga a parte do juiz + o valor do jogo).
// Convocação: assim que um treino/jogo é lançado, todo mundo vinculado à modalidade
// recebe um pedido de confirmação de presença (independente de cobrança).
async function createAttendanceCalls(session, enrollments) {
  await Promise.all(enrollments.map(e =>
    prisma.sessionAttendance.create({ data: { sessionId: session.id, memberId: e.memberId } }).catch(() => {})
  ));
}

async function chargeSessionParticipants(session) {
  const team = await prisma.team.findUnique({ where: { id: session.teamId } });
  if (!team) return;
  const enrollments = await prisma.teamEnrollment.findMany({ where: { teamId: session.teamId }, include: { member: { include: { user: true } } } });
  // Jogo não publicado: a gestão ainda está montando a convocação (roster) manualmente,
  // então não convoca todo mundo automaticamente — só quando published=true.
  if (session.type !== 'JOGO' || session.published !== false) await createAttendanceCalls(session, enrollments);
  const label = `${team.name} · ${session.type === 'JOGO' ? 'Jogo' : 'Treino'} de ${new Date(session.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
  const refereeCostCents = session.refereeCost ? Math.round(Number(session.refereeCost) * 100) : 0;
  const dropInCents = team.dropInPriceCents || 0;

  if (session.type === 'JOGO' && refereeCostCents > 0 && enrollments.length > 0) {
    const shareCents = Math.ceil(refereeCostCents / enrollments.length);
    for (const enrollment of enrollments) {
      const isAvulso = enrollment.member.membershipKind === 'AVULSO';
      const amountCents = shareCents + (isAvulso ? dropInCents : 0);
      if (amountCents <= 0) continue;
      const breakdown = isAvulso && dropInCents ? `Juiz: ${money(shareCents)} + Jogo: ${money(dropInCents)}` : `Juiz: ${money(shareCents)}`;
      const charge = await prisma.sessionCharge.create({ data: { sessionId: session.id, memberId: enrollment.memberId, amountCents, breakdown } });
      await tryGeneratePixForCharge(charge, { userEmail: enrollment.member.user.email }, `${label} — ${breakdown}`);
    }
    return;
  }

  // Sem juiz (ou é treino): só avulsos pagam o valor de treino/jogo da modalidade.
  if (!dropInCents) return;
  const avulsos = enrollments.filter(e => e.member.membershipKind === 'AVULSO');
  for (const enrollment of avulsos) {
    const charge = await prisma.sessionCharge.create({ data: { sessionId: session.id, memberId: enrollment.memberId, amountCents: dropInCents, breakdown: `${session.type === 'JOGO' ? 'Jogo' : 'Treino'}: ${money(dropInCents)}` } });
    await tryGeneratePixForCharge(charge, { userEmail: enrollment.member.user.email }, label);
  }
}
function money(cents) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Junta lançamentos manuais (Transaction) com receitas/despesas derivadas de outras telas
// (patrocínio fechado, cobrança de avulso paga, pedido de loja pago, custo de técnico/juiz).
// Usado tanto pelo Financeiro quanto pelos cards de caixa do Dashboard, pra nunca desencontrar.
async function computeFinanceOverview() {
  const parseSponsorValue = text => Number(String(text || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;

  const [manual, closedSponsors, paidCharges, sessionsWithCosts, paidOrders] = await Promise.all([
    prisma.transaction.findMany(),
    prisma.sponsor.findMany({ where: { status: 'Fechado' } }),
    prisma.sessionCharge.findMany({ where: { status: 'PAID' }, include: { session: { include: { team: true } }, member: { include: { user: true } } } }),
    prisma.teamSession.findMany({ where: { OR: [{ coachCost: { not: null } }, { refereeCost: { not: null } }] }, include: { team: true } }),
    prisma.order.findMany({ where: { status: 'PAID' }, include: { member: { include: { user: true } } } }),
  ]);

  const entries = [];
  const payables = [];
  const receivables = [];
  manual.forEach(t => {
    const mapped = {
      id: t.id, description: t.description, category: t.category, amount: Number(t.amount),
      type: t.type === 'INCOME' ? 'income' : 'expense', date: t.createdAt, source: 'manual',
      status: t.status, dueDate: t.dueDate, favorecido: t.favorecido, paymentMethod: t.paymentMethod,
      responsibleName: t.responsibleName, proofUrl: t.proofUrl, requestId: t.requestId,
    };
    // Contas em aberto (PENDING) não entram no caixa realizado — só aparecem nas listas de
    // contas a pagar/receber, até serem marcadas como pagas.
    if (t.status === 'PENDING') {
      if (mapped.type === 'expense') payables.push(mapped); else receivables.push(mapped);
      return;
    }
    entries.push(mapped);
  });
  closedSponsors.forEach(s => entries.push({ id: `sponsor:${s.id}`, description: `Patrocínio · ${s.company}`, category: 'Patrocínio', amount: parseSponsorValue(s.value), type: 'income', date: s.createdAt, source: 'auto' }));
  paidCharges.forEach(c => entries.push({ id: `charge:${c.id}`, description: `Cobrança avulso · ${c.member.user.name} · ${c.session.team.name}`, category: 'Treino/jogo avulso', amount: c.amountCents / 100, type: 'income', date: c.createdAt, source: 'auto' }));
  paidOrders.forEach(o => entries.push({ id: `order:${o.id}`, description: `Loja · ${o.member.user.name}`, category: 'Loja', amount: o.totalCents / 100, type: 'income', date: o.createdAt, source: 'auto' }));
  sessionsWithCosts.forEach(s => {
    const label = `${s.team.name} · ${s.type === 'JOGO' ? 'Jogo' : 'Treino'} de ${s.date.toLocaleDateString('pt-BR')}`;
    if (s.coachCost) entries.push({ id: `coach:${s.id}`, description: `Técnico${s.coachName ? ' · ' + s.coachName : ''} · ${label}`, category: 'Técnico', amount: Number(s.coachCost), type: 'expense', date: s.createdAt, source: 'auto' });
    if (s.refereeCost) entries.push({ id: `referee:${s.id}`, description: `Juiz${s.refereeName ? ' · ' + s.refereeName : ''} · ${label}`, category: 'Juiz', amount: Number(s.refereeCost), type: 'expense', date: s.createdAt, source: 'auto' });
  });

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  const monthly = {};
  entries.forEach(e => {
    const key = new Date(e.date).toISOString().slice(0, 7);
    monthly[key] ||= { income: 0, expense: 0 };
    monthly[key][e.type] += e.amount;
  });
  const months = Object.keys(monthly).sort().slice(-12).map(key => ({ month: key, ...monthly[key] }));

  return { entries, months, payables, receivables };
}

module.exports = { teamSlotWeight, tryGeneratePixForCharge, createAttendanceCalls, chargeSessionParticipants, money, computeFinanceOverview };
