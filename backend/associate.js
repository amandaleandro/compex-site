const { prisma } = require('./db');
const { preferenceClient, preApprovalClient } = require('./mercadopago');
const { normalizeCpf, isValidCpf } = require('./lib/cpf');
const { awardPoints, gamificationFor } = require('./lib/gamification');

const DEMO_EMAIL_BY_TOKEN = {
  'demo-session-compex': 'diretoria@compex.com.br',
  'demo-session-associado': 'associado@compex.com.br'
};

const MEMBERSHIP_PLANS = {
  semestral: { label: 'Plano Semestral', amount: 60, frequency: 6 },
  anual: { label: 'Plano Anual', amount: 100, frequency: 12 }
};

function tokenFromReq(req) {
  return (req.headers.authorization || '').replace('Bearer ', '');
}

async function memberFromReq(req) {
  if (!prisma) return null;
  const token = tokenFromReq(req);
  const email = req.associateSession?.email || DEMO_EMAIL_BY_TOKEN[token];
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, include: { member: true } });
  return user && user.member ? { ...user.member, userName: user.name, userEmail: user.email, userRole: user.role, userRank: user.rank } : null;
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => (value += chunk));
    req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (error) { reject(error); } });
  });
}

function ensureReferralCode(member) {
  if (member.referralCode) return member.referralCode;
  return `COMPEX-${member.id.slice(-6).toUpperCase()}`;
}

const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3100}`;

async function handleAssociateRoute(pathname, req, res) {
  if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível nesta instância.' });

  // GET /api/teams — modalidades disponíveis para inscrição
  if (pathname === '/api/teams' && req.method === 'GET') {
    const teams = await prisma.team.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return send(res, 200, teams);
  }

  // GET /api/products — itens da loja
  if (pathname === '/api/products' && req.method === 'GET') {
    const products = await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
    return send(res, 200, products);
  }

  const member = await memberFromReq(req);

  if (pathname === '/api/me/profile' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const enrollments = await prisma.teamEnrollment.findMany({ where: { memberId: member.id, status: 'APPROVED' }, include: { team: true } });
    const managementRoles = new Set(['PRESIDENCIA', 'FINANCEIRO', 'ESPORTES', 'EVENTOS', 'MARKETING']);
    return send(res, 200, { id: member.id, name: member.userName, email: member.userEmail, cpf: member.cpf, socialName: member.socialName, nickname: member.nickname, sex: member.sex, birthDate: member.birthDate, photoUrl: member.photoUrl, course: member.course, registration: member.registration, instagram: member.instagram, phone: member.phone, shift: member.shift, preferences: member.preferences, plan: member.plan, status: member.status, membershipKind: member.membershipKind, createdAt: member.createdAt, category: member.memberType || (enrollments.length ? 'ATLETA' : 'TORCEDOR'), sports: enrollments.length ? enrollments.map(item => item.team.name) : (member.selectedSports || []), management: managementRoles.has(member.userRole) ? { role: member.userRole, rank: member.userRank } : null });
  }

  if (pathname === '/api/me/profile' && req.method === 'PUT') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => ({}));
    const cpf = payload.cpf !== undefined ? normalizeCpf(payload.cpf) : member.cpf;
    if (cpf && !isValidCpf(cpf)) return send(res, 400, { error: 'Informe um CPF válido.' });
    if (cpf) {
      const cpfInUse = await prisma.member.findFirst({ where: { cpf, id: { not: member.id } }, select: { id: true } });
      if (cpfInUse) return send(res, 409, { error: 'Este CPF já está vinculado a outra conta.' });
    }
    const updated = await prisma.member.update({ where: { id: member.id }, data: { course: payload.course || member.course, registration: payload.registration || member.registration, cpf: cpf || null, socialName: payload.socialName !== undefined ? (String(payload.socialName).trim() || null) : member.socialName, nickname: payload.nickname !== undefined ? (String(payload.nickname).trim() || null) : member.nickname, sex: payload.sex || null, birthDate: payload.birthDate ? new Date(payload.birthDate) : null, instagram: payload.instagram || null, phone: payload.phone || null, shift: payload.shift || null, preferences: payload.preferences || member.preferences, selectedSports: Array.isArray(payload.sports) ? payload.sports : member.selectedSports, shirtSize: payload.shirtSize || null, user: { update: { name: payload.name || member.userName, email: payload.email || member.userEmail } } } });
    return send(res, 200, updated);
  }

  if (pathname === '/api/me/gamification' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    if (member.membershipKind !== 'SOCIO') return send(res, 403, { error: 'A gamificação é exclusiva para sócios da CompExatas.' });
    return send(res, 200, await gamificationFor(member));
  }

  if (pathname === '/api/me/notifications' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const [enrollments, attendances, charges, orders, events] = await Promise.all([
      prisma.teamEnrollment.findMany({ where: { memberId: member.id }, include: { team: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.sessionAttendance.findMany({ where: { memberId: member.id }, include: { session: { include: { team: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.sessionCharge.findMany({ where: { memberId: member.id }, include: { session: { include: { team: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.order.findMany({ where: { memberId: member.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
      prisma.event.findMany({ where: { published: true, date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 12 }),
    ]);
    const preferences = member.preferences && typeof member.preferences === 'object' && !Array.isArray(member.preferences) ? member.preferences : {};
    const readIds = new Set(Array.isArray(preferences.notificationReadIds) ? preferences.notificationReadIds : []);
    const notifications = [];
    enrollments.forEach(item => {
      const status = item.status === 'APPROVED' ? 'approved' : item.status === 'REJECTED' ? 'rejected' : 'pending';
      notifications.push({ id: `enrollment:${item.id}:${item.status}`, type: 'MODALIDADE', title: item.status === 'APPROVED' ? 'Vaga aprovada na modalidade' : item.status === 'REJECTED' ? 'Atualização na solicitação' : 'Solicitação recebida', message: item.status === 'APPROVED' ? `Você agora faz parte de ${item.team.name}. Acompanhe as próximas convocações.` : item.status === 'REJECTED' ? `A solicitação para ${item.team.name} não foi aprovada. Você pode solicitar uma nova análise.` : `Sua solicitação para ${item.team.name} está aguardando análise da diretoria.`, href: item.status === 'APPROVED' ? '/associado/convocacoes' : '/associado/modalidade', status, createdAt: item.createdAt });
    });
    attendances.forEach(item => {
      notifications.push({ id: `attendance:${item.id}:${item.status}`, type: 'CONVOCACAO', title: item.status === 'PENDING' ? 'Nova convocação' : 'Resposta de presença registrada', message: `${item.session.team.name} · ${item.session.type === 'JOGO' ? 'Jogo' : 'Treino'} em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(item.session.date)}.`, href: '/associado/convocacoes', status: item.status.toLowerCase(), createdAt: item.createdAt });
    });
    charges.forEach(item => {
      notifications.push({ id: `charge:${item.id}:${item.status}`, type: 'COBRANCA', title: item.status === 'PAID' ? 'Pagamento confirmado' : item.status === 'FAILED' ? 'Pagamento não confirmado' : 'Nova cobrança avulsa', message: `${item.session.team.name} · ${(item.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, href: '/associado/cobrancas', status: item.status.toLowerCase(), createdAt: item.createdAt });
    });
    orders.forEach(item => {
      const labels = { PENDING: 'Pedido recebido', PAID: 'Pagamento do pedido confirmado', PREPARING: 'Pedido em preparação', READY_FOR_PICKUP: 'Pedido pronto para retirada', DELIVERED: 'Pedido entregue', CANCELED: 'Pedido cancelado' };
      notifications.push({ id: `order:${item.id}:${item.status}`, type: 'PEDIDO', title: labels[item.status] || 'Atualização do pedido', message: `Pedido ${item.id.slice(-6).toUpperCase()} · ${(item.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, href: '/associado/loja', status: item.status.toLowerCase(), createdAt: item.createdAt });
    });
    events.forEach(item => {
      notifications.push({ id: `event:${item.id}`, type: 'EVENTO', title: 'Evento na agenda', message: `${item.name} · ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' }).format(item.date)}${item.location ? ` · ${item.location}` : ''}.`, href: `/associado/agenda/${item.id}`, status: 'info', createdAt: item.createdAt });
    });
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return send(res, 200, notifications.slice(0, 60).map(item => ({ ...item, read: readIds.has(item.id) })));
  }

  if (pathname === '/api/me/notifications/read' && req.method === 'POST') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => ({}));
    const requestedIds = Array.isArray(payload.ids) ? payload.ids : payload.id ? [payload.id] : [];
    const safeIds = requestedIds.map(String).filter(id => id.length > 0 && id.length <= 180).slice(0, 100);
    if (!safeIds.length) return send(res, 400, { error: 'Informe ao menos uma notificação.' });
    const preferences = member.preferences && typeof member.preferences === 'object' && !Array.isArray(member.preferences) ? member.preferences : {};
    const currentIds = Array.isArray(preferences.notificationReadIds) ? preferences.notificationReadIds.map(String) : [];
    const notificationReadIds = [...new Set([...currentIds, ...safeIds])].slice(-250);
    await prisma.member.update({ where: { id: member.id }, data: { preferences: { ...preferences, notificationReadIds } } });
    return send(res, 200, { ok: true, readIds: safeIds });
  }

  // GET /api/me/enrollments — modalidades em que o associado logado está inscrito
  if (pathname === '/api/me/enrollments' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const enrollments = await prisma.teamEnrollment.findMany({ where: { memberId: member.id }, include: { team: true } });
    return send(res, 200, enrollments);
  }

  // GET /api/me/session-charges — cobranças PIX de treino/jogo do atleta avulso logado
  if (pathname === '/api/me/session-charges' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const charges = await prisma.sessionCharge.findMany({ where: { memberId: member.id }, include: { session: { include: { team: true } } }, orderBy: { createdAt: 'desc' } });
    return send(res, 200, charges.map(c => ({
      id: c.id, amountCents: c.amountCents, breakdown: c.breakdown, status: c.status.toLowerCase(), pixQrCode: c.pixQrCode, pixQrBase64: c.pixQrBase64, createdAt: c.createdAt,
      teamName: c.session.team.name, sessionType: c.session.type, sessionDate: c.session.date,
      chargeKind: member.membershipKind === 'AVULSO' ? 'AVULSO' : 'JUIZ',
    })));
  }

  // GET /api/me/session-calls — convocações (treino/jogo) do atleta logado, pra confirmar presença
  if (pathname === '/api/me/session-calls' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const calls = await prisma.sessionAttendance.findMany({ where: { memberId: member.id }, include: { session: { include: { team: true } } }, orderBy: { createdAt: 'desc' } });
    return send(res, 200, calls.map(c => ({
      id: c.id, status: c.status.toLowerCase(), createdAt: c.createdAt,
      teamName: c.session.team.name, sessionType: c.session.type, sessionDate: c.session.date, sessionLocation: c.session.location,
    })));
  }

  // POST /api/me/session-calls/:id — confirmar ou recusar presença
  const attendanceMatch = pathname.match(/^\/api\/me\/session-calls\/([^/]+)$/);
  if (attendanceMatch && req.method === 'POST') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => ({}));
    const status = payload.status === 'DECLINED' ? 'DECLINED' : 'CONFIRMED';
    const updated = await prisma.sessionAttendance.updateMany({ where: { id: attendanceMatch[1], memberId: member.id }, data: { status, respondedAt: new Date() } });
    if (updated.count === 0) return send(res, 404, { error: 'Convocação não encontrada' });
    return send(res, 200, { ok: true, status: status.toLowerCase() });
  }

  // POST /api/teams/:id/enroll — associado se inscreve numa modalidade
  const enrollMatch = pathname.match(/^\/api\/teams\/([^/]+)\/enroll$/);
  if (enrollMatch && req.method === 'POST') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const teamId = enrollMatch[1];
    try {
      const team = await prisma.team.findFirst({ where: { id: teamId, active: true } });
      if (!team) return send(res, 404, { error: 'Esta modalidade não está disponível para inscrição.' });
      const existing = await prisma.teamEnrollment.findUnique({ where: { memberId_teamId: { memberId: member.id, teamId } } });
      if (existing && existing.status !== 'REJECTED') return send(res, 200, existing);
      if (member.membershipKind === 'SOCIO') {
        const usedSlots = await prisma.teamEnrollment.count({ where: { memberId: member.id, status: { in: ['PENDING', 'APPROVED'] } } });
        if (usedSlots >= member.sportSlots) return send(res, 400, { error: `Seu plano permite ${member.sportSlots} modalidade(s). Fale com a diretoria para alterar seu limite.` });
      }
      const enrollment = existing
        ? await prisma.teamEnrollment.update({ where: { id: existing.id }, data: { status: 'PENDING' } })
        : await prisma.teamEnrollment.create({ data: { memberId: member.id, teamId, status: 'PENDING' } });
      return send(res, 201, enrollment);
    } catch (error) { return send(res, 400, { error: error.message }); }
  }

  // GET /api/me/referral — código de indicação do associado + quantos já indicou
  if (pathname === '/api/me/referral' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    let code = member.referralCode;
    if (!code) {
      code = ensureReferralCode(member);
      await prisma.member.update({ where: { id: member.id }, data: { referralCode: code } });
    }
    const referrals = await prisma.member.count({ where: { referredById: member.id } });
    return send(res, 200, { code, referrals });
  }

  // GET /api/me/subscription — status da mensalidade do associado
  if (pathname === '/api/me/subscription' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    return send(res, 200, {
      plan: member.plan,
      status: member.status,
      subscriptionStatus: member.subscriptionStatus,
      currentPeriodEnd: member.currentPeriodEnd
    });
  }

  // GET /api/me/orders — pedidos da loja do associado
  if (pathname === '/api/me/orders' && req.method === 'GET') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const orders = await prisma.order.findMany({ where: { memberId: member.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } });
    return send(res, 200, orders);
  }

  // POST /api/checkout/loja — cria pedido + preferência de pagamento único (Checkout Pro)
  if (pathname === '/api/checkout/loja' && req.method === 'POST') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => null);
    if (!payload || !Array.isArray(payload.items) || !payload.items.length) return send(res, 400, { error: 'Informe os itens do carrinho.' });
    const productIds = payload.items.map(item => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
    if (!products.length) return send(res, 400, { error: 'Produtos inválidos.' });
    const items = payload.items.map(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      const quantity = Math.max(1, Number(cartItem.quantity) || 1);
      return product ? {
        product,
        quantity,
        size: cartItem.size || null,
        customizationName: cartItem.customizationName || null,
        customizationNumber: cartItem.customizationNumber || null
      } : null;
    }).filter(Boolean);
    const totalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
    const order = await prisma.order.create({
      data: {
        memberId: member.id,
        totalCents,
        items: {
          create: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPriceCents: item.product.priceCents,
            size: item.size,
            customizationName: item.customizationName,
            customizationNumber: item.customizationNumber
          }))
        }
      }
    });
    const client = preferenceClient();
    if (!client) {
      return send(res, 200, { orderId: order.id, initPoint: null, warning: 'MERCADOPAGO_ACCESS_TOKEN não configurado — pedido criado como PENDING sem link de pagamento.' });
    }
    try {
      const preference = await client.create({
        body: {
          items: items.map(item => ({ id: item.product.id, title: item.product.name, quantity: item.quantity, unit_price: item.product.priceCents / 100, currency_id: 'BRL' })),
          external_reference: order.id,
          back_urls: { success: `${baseUrl}/associado/loja?status=success`, failure: `${baseUrl}/associado/loja?status=failure`, pending: `${baseUrl}/associado/loja?status=pending` },
          notification_url: `${baseUrl}/api/webhooks/mercadopago`
        }
      });
      await prisma.order.update({ where: { id: order.id }, data: { mpPreferenceId: preference.id } });
      return send(res, 200, { orderId: order.id, initPoint: preference.init_point });
    } catch (error) { return send(res, 500, { error: error.message }); }
  }

  // POST /api/checkout/mensalidade — cria assinatura recorrente (PreApproval)
  if (pathname === '/api/checkout/mensalidade' && req.method === 'POST') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => ({}));
    const plan = MEMBERSHIP_PLANS[payload.planId] || MEMBERSHIP_PLANS.anual;
    const client = preApprovalClient();
    if (!client) {
      return send(res, 200, { initPoint: null, warning: 'MERCADOPAGO_ACCESS_TOKEN não configurado — configure a chave para gerar o link de pagamento real.' });
    }
    try {
      const preapproval = await client.create({
        body: {
          reason: `COMPEX — ${plan.label}`,
          external_reference: member.id,
          payer_email: member.userEmail,
          auto_recurring: { frequency: plan.frequency, frequency_type: 'months', transaction_amount: plan.amount, currency_id: 'BRL' },
          back_url: `${baseUrl}/associado/mensalidade?status=success`,
          status: 'pending'
        }
      });
      await prisma.member.update({ where: { id: member.id }, data: { mpPreapprovalId: preapproval.id, subscriptionStatus: preapproval.status } });
      return send(res, 200, { initPoint: preapproval.init_point });
    } catch (error) { return send(res, 500, { error: error.message }); }
  }

  // POST /api/webhooks/mercadopago — notificações de pagamento/assinatura
  if (pathname === '/api/webhooks/mercadopago' && req.method === 'POST') {
    const payload = await readBody(req).catch(() => ({}));
    try {
      if (payload.type === 'payment' && payload.data && payload.data.id) {
        const { paymentClient } = require('./mercadopago');
        const client = paymentClient();
        if (client) {
          const payment = await client.get({ id: payload.data.id });
          const reference = payment.external_reference || '';
          if (reference.startsWith('sessioncharge:')) {
            const chargeId = reference.slice('sessioncharge:'.length);
            await prisma.sessionCharge.updateMany({ where: { id: chargeId }, data: { mpPaymentId: String(payment.id), status: payment.status === 'approved' ? 'PAID' : 'PENDING' } });
          } else if (reference) {
            const order = await prisma.order.findUnique({ where: { id: reference }, select: { memberId: true, totalCents: true } });
            await prisma.order.updateMany({ where: { id: reference }, data: { mpPaymentId: String(payment.id), status: payment.status === 'approved' ? 'PAID' : 'PENDING' } });
            if (order && payment.status === 'approved') {
              await awardPoints(order.memberId, 'COMPRA_LOJA', Math.max(20, Math.floor(order.totalCents / 100)), `Pedido ${reference}`);
            }
          }
        }
      }
      if (payload.type === 'subscription_preapproval' && payload.data && payload.data.id) {
        const subscribed = await prisma.member.findFirst({ where: { mpPreapprovalId: payload.data.id } });
        if (subscribed) {
          await prisma.member.update({ where: { id: subscribed.id }, data: { subscriptionStatus: 'authorized' } });
          const month = new Date().toISOString().slice(0, 7);
          await awardPoints(subscribed.id, 'MENSALIDADE_EM_DIA', 100, `Mensalidade ${month}`);
        }
      }
    } catch (error) { console.error('Erro no webhook do Mercado Pago:', error.message); }
    return send(res, 200, { received: true });
  }

  return send(res, 404, { error: 'Rota não encontrada' });
}

module.exports = { handleAssociateRoute };
