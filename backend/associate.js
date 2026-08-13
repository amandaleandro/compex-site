const { prisma } = require('./db');
const { preferenceClient, preApprovalClient } = require('./mercadopago');

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
    return send(res, 200, { id: member.id, name: member.userName, socialName: member.socialName, nickname: member.nickname, sex: member.sex, birthDate: member.birthDate, photoUrl: member.photoUrl, course: member.course, registration: member.registration, status: member.status, membershipKind: member.membershipKind, createdAt: member.createdAt, category: member.memberType || (enrollments.length ? 'ATLETA' : 'TORCEDOR'), sports: enrollments.length ? enrollments.map(item => item.team.name) : (member.selectedSports || []), management: managementRoles.has(member.userRole) ? { role: member.userRole, rank: member.userRank } : null });
  }

  if (pathname === '/api/me/profile' && req.method === 'PUT') {
    if (!member) return send(res, 401, { error: 'Sessão inválida' });
    const payload = await readBody(req).catch(() => ({}));
    const updated = await prisma.member.update({ where: { id: member.id }, data: { socialName: payload.socialName || null, nickname: payload.nickname || null, sex: payload.sex || null, birthDate: payload.birthDate ? new Date(payload.birthDate) : null, instagram: payload.instagram || null, shirtSize: payload.shirtSize || null, user: { update: { name: payload.name || member.userName } } } });
    return send(res, 200, updated);
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
      const enrollment = await prisma.teamEnrollment.upsert({
        where: { memberId_teamId: { memberId: member.id, teamId } },
        update: {},
        create: { memberId: member.id, teamId }
      });
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
          back_urls: { success: `${baseUrl}/associado/loja.html?status=success`, failure: `${baseUrl}/associado/loja.html?status=failure`, pending: `${baseUrl}/associado/loja.html?status=pending` },
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
          back_url: `${baseUrl}/associado/mensalidade.html?status=success`,
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
            await prisma.order.updateMany({ where: { id: reference }, data: { mpPaymentId: String(payment.id), status: payment.status === 'approved' ? 'PAID' : 'PENDING' } });
          }
        }
      }
      if (payload.type === 'subscription_preapproval' && payload.data && payload.data.id) {
        await prisma.member.updateMany({ where: { mpPreapprovalId: payload.data.id }, data: { subscriptionStatus: 'authorized' } });
      }
    } catch (error) { console.error('Erro no webhook do Mercado Pago:', error.message); }
    return send(res, 200, { received: true });
  }

  return send(res, 404, { error: 'Rota não encontrada' });
}

module.exports = { handleAssociateRoute };
