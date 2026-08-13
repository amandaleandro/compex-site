const http = require('http');
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { prisma } = require('./db');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const Busboy = require('busboy');
const { handleAssociateRoute } = require('./associate');
const { paymentClient } = require('./mercadopago');

const root = path.join(__dirname, '..', 'frontend');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const associatePhotosDir = path.join(uploadsDir, 'associates');
if (!fs.existsSync(associatePhotosDir)) fs.mkdirSync(associatePhotosDir, { recursive: true });
const patrimonioDocsDir = path.join(uploadsDir, 'patrimonio');
if (!fs.existsSync(patrimonioDocsDir)) fs.mkdirSync(patrimonioDocsDir, { recursive: true });
const dataFile = path.join(__dirname, 'data.json');
const port = process.env.PORT || 3000;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const initialData = { 
  events: [], 
  members: [], 
  news: [], 
  transactions: [],
  benefits: [
    { id: 'b1', name: 'Café Byte', category: 'Alimentação', discount: '10% OFF', description: 'Café, lanches e encontros para recarregar.', icon: '☕' },
    { id: 'b2', name: 'Arena Sport', category: 'Esporte', discount: '15% OFF', description: 'Equipamentos, acessórios e materiais esportivos.', icon: '👟' },
    { id: 'b3', name: 'Gráfica Exatas', category: 'Serviços', discount: '20% OFF', description: 'Impressões, encadernações e materiais acadêmicos.', icon: '▣' },
    { id: 'b4', name: 'Pizza da Quadra', category: 'Alimentação', discount: 'R$ 10 OFF', description: 'Delivery especial para dias de treino e jogo.', icon: '🍕' }
  ],
  plans: [
    { id: 'p1', name: 'Plano Anual', price: '49,90', period: '/ano', slots: 1, icon: '☆', description: 'Carteirinha digital, benefícios e eventos durante 12 meses.' },
    { id: 'p2', name: 'Plano Semestral', price: '29,90', period: '/semestre', slots: 1, icon: '▦', description: 'Acesso completo por 6 meses com carteirinha digital.' }
  ]
};

// Sessões da gestão: tokens fixos de demonstração continuam funcionando (o portal do
// associado, em associate.js, ainda depende literalmente desses dois valores). Contas
// reais de diretoria (Financeiro, Esportes, Eventos, Marketing) recebem tokens gerados
// e validados contra o Role de cada User no Prisma.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessionsFile = path.join(__dirname, 'sessions.json');
const sessions = new Map();
try {
  const stored = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  Object.entries(stored).forEach(([token, session]) => { if (session.expiresAt > Date.now()) sessions.set(token, session); });
} catch {}
function persistSessions() { fs.writeFileSync(sessionsFile, JSON.stringify(Object.fromEntries(sessions))); }
const LEGACY_TOKENS = {
  'demo-session-compex': { name: 'Amanda Silva', role: 'PRESIDENCIA', rank: 'DIRETOR', email: 'diretoria@compex.com.br' },
  'demo-session-associado': { name: 'Lucas Associado', role: 'ASSOCIADO', rank: 'DIRETOR', email: 'associado@compex.com.br' }
};
const INTERNAL_ROLES = new Set(['PRESIDENCIA', 'FINANCEIRO', 'ESPORTES', 'EVENTOS', 'MARKETING', 'PRODUTOS', 'PATRIMONIO']);
const PAGE_ROLES = {
  'finance.html': new Set(['PRESIDENCIA', 'FINANCEIRO']),
  'sponsors.html': new Set(['PRESIDENCIA', 'FINANCEIRO', 'MARKETING']),
  'members.html': new Set(['PRESIDENCIA', 'FINANCEIRO', 'ESPORTES']),
  'sports.html': new Set(['PRESIDENCIA', 'ESPORTES']),
  'event-manager.html': new Set(['PRESIDENCIA', 'EVENTOS']),
  'checkin.html': new Set(['PRESIDENCIA', 'EVENTOS']),
  'communication.html': new Set(['PRESIDENCIA', 'MARKETING']),
  'produtos.html': new Set(['PRESIDENCIA', 'PRODUTOS']),
  'pedidos.html': new Set(['PRESIDENCIA', 'PRODUTOS']),
  'patrimonio.html': new Set(['PRESIDENCIA', 'PATRIMONIO']),
  'beneficios-gestao.html': new Set(['PRESIDENCIA', 'MARKETING', 'FINANCEIRO'])
};
function resolveSession(token) {
  if (!token) return null;
  if (LEGACY_TOKENS[token]) return LEGACY_TOKENS[token];
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return session;
}
function bearerToken(req) { return (req.headers.authorization || '').replace('Bearer ', '').trim(); }
const canManageAccounts = session => !!session && (session.role === 'PRESIDENCIA' || session.rank === 'DIRETOR');
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  header.split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index === -1) return;
    map[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return map;
}

function readData() {
  try { return { ...initialData, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; }
  catch { fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2), 'utf8'); return { ...initialData }; }
}
function writeData(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8'); }
function send(res, status, body, type = 'application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type }); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
function body(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => value += chunk); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (error) { reject(error); } }); }); }
function collection(name, req, res) {
  const data = readData();
  if (!data[name]) return send(res, 404, { error: 'ColeÃ§Ã£o nÃ£o encontrada' });
  if (req.method === 'GET') return send(res, 200, data[name]);
  if (req.method === 'POST') return body(req).then(item => { const record = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...item }; data[name].unshift(record); writeData(data); send(res, 201, record); }).catch(() => send(res, 400, { error: 'JSON invÃ¡lido' }));
  if (req.method === 'PUT') return body(req).then(item => { const index = data[name].findIndex(record => record.id === item.id); if (index < 0) return send(res, 404, { error: 'Registro nÃ£o encontrado' }); data[name][index] = { ...data[name][index], ...item, updatedAt: new Date().toISOString() }; writeData(data); send(res, 200, data[name][index]); }).catch(() => send(res, 400, { error: 'Informe o registro para atualizar' }));
  if (req.method === 'DELETE') return body(req).then(item => { const index = data[name].findIndex(record => record.id === item.id); if (index < 0) return send(res, 404, { error: 'Registro nÃ£o encontrado' }); const [removed] = data[name].splice(index, 1); writeData(data); send(res, 200, removed); }).catch(() => send(res, 400, { error: 'Informe o id do registro' }));
  send(res, 405, { error: 'MÃ©todo nÃ£o permitido' });
}
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
  await createAttendanceCalls(session, enrollments);
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
  manual.forEach(t => entries.push({ id: t.id, description: t.description, category: t.category, amount: Number(t.amount), type: t.type === 'INCOME' ? 'income' : 'expense', date: t.createdAt, source: 'manual' }));
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

  return { entries, months };
}
async function databaseCollection(name, req, res, url) {
  if ((name === 'members' || name === 'transactions') && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
  }
  if (name === 'transactions' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
  }
  if (!prisma) return collection(name, req, res);
  if (name === 'events') {
    if (req.method === 'GET') return send(res, 200, (await prisma.event.findMany({ orderBy: { createdAt: 'desc' } })).map(event => {
      const link = event.ticketUrl || event.boraFestUrl || '';
      const revenue = event.revenue ? Number(event.revenue) : 0;
      const expenses = event.expenses ? Number(event.expenses) : 0;
      const profit = revenue - expenses;
      return {
        ...event,
        date: event.date.toISOString(),
        platform: event.platform || 'BORAFEST',
        ticketUrl: link,
        link: link,
        boraFestUrl: event.boraFestUrl || link,
        isOwnOrganization: event.isOwnOrganization !== false,
        revenue,
        expenses,
        profit,
        financialNotes: event.financialNotes || ''
      };
    }));
    if (req.method === 'POST') return body(req).then(async item => {
      const platform = item.platform || 'BORAFEST';
      const ticketUrl = item.ticketUrl || item.link || item.boraFestUrl || null;
      const isOwnOrganization = item.isOwnOrganization !== false && item.isOwnOrganization !== 'false';
      const revenue = isOwnOrganization && item.revenue !== undefined ? Number(item.revenue || 0) : 0;
      const expenses = isOwnOrganization && item.expenses !== undefined ? Number(item.expenses || 0) : 0;

      const event = await prisma.event.create({
        data: {
          name: item.name,
          type: item.type || 'Evento',
          date: new Date(item.date),
          time: item.time,
          location: item.location,
          description: item.description,
          platform: platform,
          ticketUrl: ticketUrl,
          boraFestUrl: platform === 'BORAFEST' ? ticketUrl : (item.boraFestUrl || ticketUrl),
          published: item.published !== false,
          isOwnOrganization: isOwnOrganization,
          revenue: revenue,
          expenses: expenses,
          financialNotes: item.financialNotes || null
        }
      });
      const link = event.ticketUrl || event.boraFestUrl || '';
      const rev = Number(event.revenue || 0);
      const exp = Number(event.expenses || 0);
      send(res, 201, {
        ...event,
        date: event.date.toISOString(),
        platform: event.platform,
        ticketUrl: link,
        link: link,
        boraFestUrl: event.boraFestUrl || link,
        isOwnOrganization: event.isOwnOrganization,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        financialNotes: event.financialNotes || ''
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode editar eventos' });
      return body(req).then(async item => {
      const platform = item.platform || 'BORAFEST';
      const ticketUrl = item.ticketUrl || item.link || item.boraFestUrl || null;
      const isOwnOrganization = item.isOwnOrganization !== undefined ? (item.isOwnOrganization !== false && item.isOwnOrganization !== 'false') : undefined;

      const data = {
        name: item.name,
        type: item.type,
        date: item.date ? new Date(item.date) : undefined,
        time: item.time,
        location: item.location,
        description: item.description,
        platform: platform,
        ticketUrl: ticketUrl,
        boraFestUrl: platform === 'BORAFEST' ? ticketUrl : (item.boraFestUrl || ticketUrl),
      };

      if (isOwnOrganization !== undefined) data.isOwnOrganization = isOwnOrganization;
      if (item.revenue !== undefined) data.revenue = Number(item.revenue || 0);
      if (item.expenses !== undefined) data.expenses = Number(item.expenses || 0);
      if (item.financialNotes !== undefined) data.financialNotes = item.financialNotes || null;

      const event = await prisma.event.update({
        where: { id: item.id },
        data: data
      });
      const link = event.ticketUrl || event.boraFestUrl || '';
      const rev = Number(event.revenue || 0);
      const exp = Number(event.expenses || 0);
      send(res, 200, {
        ...event,
        date: event.date.toISOString(),
        platform: event.platform,
        ticketUrl: link,
        link: link,
        boraFestUrl: event.boraFestUrl || link,
        isOwnOrganization: event.isOwnOrganization,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        financialNotes: event.financialNotes || ''
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
    if (req.method === 'DELETE') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir eventos' });
      return body(req).then(async item => { await prisma.event.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
  }
  if (name === 'transactions') {
    if (req.method === 'GET') return send(res, 200, (await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } })).map(item => ({ ...item, amount: Number(item.amount), type: item.type === 'INCOME' ? 'income' : 'expense' })));
    if (req.method === 'POST') return body(req).then(async item => { const transaction = await prisma.transaction.create({ data: { description: item.description, amount: Number(item.amount), type: item.type === 'income' ? 'INCOME' : 'EXPENSE', category: item.category || 'OperaÃ§Ã£o' } }); send(res, 201, { ...transaction, amount: Number(transaction.amount) }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const data = {};
      if (item.description !== undefined) data.description = item.description;
      if (item.amount !== undefined) data.amount = Number(item.amount);
      if (item.category !== undefined) data.category = item.category;
      if (item.type !== undefined) data.type = item.type === 'income' ? 'INCOME' : 'EXPENSE';
      const transaction = await prisma.transaction.update({ where: { id: item.id }, data });
      send(res, 200, { ...transaction, amount: Number(transaction.amount), type: transaction.type === 'INCOME' ? 'income' : 'expense' });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.transaction.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'finance-overview') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });
    return send(res, 200, await computeFinanceOverview());
  }
  if (name === 'members') {
    if (req.method === 'GET') {
      const url2 = new URL(req.url, 'http://internal');
      const detailId = url2.searchParams.get('id');
      if (detailId) {
        const session = resolveSession(bearerToken(req));
        if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
        const member = await prisma.member.findUnique({
          where: { id: detailId },
          include: { user: true, teamEnrollments: { include: { team: true } }, sessionCharges: { include: { session: { include: { team: true } } }, orderBy: { createdAt: 'desc' } } },
        });
        if (!member) return send(res, 404, { error: 'Associado não encontrado' });
        return send(res, 200, {
          id: member.id, name: member.user.name, email: member.user.email, course: member.course, plan: member.plan,
          status: member.status.toLowerCase(), membershipKind: member.membershipKind, sportSlots: member.sportSlots,
          sex: member.sex, birthDate: member.birthDate, socialName: member.socialName, nickname: member.nickname,
          shirtSize: member.shirtSize, instagram: member.instagram, createdAt: member.createdAt.toISOString(),
          teams: member.teamEnrollments.map(e => ({ teamId: e.teamId, teamName: e.team.name, gender: e.team.gender })),
          charges: member.sessionCharges.map(c => ({ id: c.id, amountCents: c.amountCents, breakdown: c.breakdown, status: c.status.toLowerCase(), teamName: c.session.team.name, sessionType: c.session.type, sessionDate: c.session.date.toISOString(), createdAt: c.createdAt.toISOString() })),
        });
      }
      const members = await prisma.member.findMany({ include: { user: true, teamEnrollments: { include: { team: true } }, sessionCharges: true }, orderBy: { createdAt: 'desc' } });
      return send(res, 200, members.map(member => ({
        id: member.id, name: member.user.name, email: member.user.email, course: member.course, plan: member.plan,
        status: member.status.toLowerCase(), membershipKind: member.membershipKind, createdAt: member.createdAt.toISOString(),
        teams: member.teamEnrollments.map(e => e.team.name),
        pendingCharges: member.sessionCharges.filter(c => c.status === 'PENDING').length,
      })));
    }
    if (req.method === 'POST') return body(req).then(async item => {
      const referrer = item.referralCode ? await prisma.member.findUnique({ where: { referralCode: item.referralCode } }) : null;
      const isAvulso = item.membershipKind === 'AVULSO';
      const hashed = await bcrypt.hash(item.password || crypto.randomBytes(6).toString('hex'), 10);
      const user = await prisma.user.create({ data: { name: item.name, email: item.email, password: hashed, role: 'ASSOCIADO', member: { create: {
        course: item.course, plan: isAvulso ? 'Avulso' : (item.plan || 'Anual'), sex: item.sex || null, birthDate: item.birthDate ? new Date(item.birthDate) : null,
        memberType: item.memberType === 'ATLETA' ? 'ATLETA' : 'TORCEDOR', selectedSports: Array.isArray(item.selectedSports) ? item.selectedSports : [],
        membershipKind: isAvulso ? 'AVULSO' : 'SOCIO',
        status: isAvulso ? 'ACTIVE' : (item.status === 'active' ? 'ACTIVE' : 'PENDING'),
        referredById: referrer ? referrer.id : undefined,
      } } }, include: { member: true } });
      send(res, 201, { id: user.member.id, name: user.name, email: user.email, course: user.member.course, plan: user.member.plan, status: user.member.status.toLowerCase(), membershipKind: user.member.membershipKind, referredBy: referrer ? referrer.id : null });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') {
      const session = resolveSession(bearerToken(req));
      if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
      return body(req).then(async item => {
        if (item.sportSlots !== undefined) {
          const slots = Number(item.sportSlots);
          if (!Number.isInteger(slots) || slots < 1) return send(res, 400, { error: 'Número de vagas inválido' });
        }
        const data = {};
        if (item.course !== undefined) data.course = item.course;
        if (item.plan !== undefined) data.plan = item.plan;
        if (item.status !== undefined) data.status = ['active', 'pending', 'expired'].includes(item.status) ? item.status.toUpperCase() : undefined;
        if (item.sportSlots !== undefined) data.sportSlots = Number(item.sportSlots);
        if (item.name !== undefined || item.email !== undefined) {
          data.user = { update: {} };
          if (item.name !== undefined) data.user.update.name = item.name;
          if (item.email !== undefined) data.user.update.email = item.email.trim().toLowerCase();
        }
        const member = await prisma.member.update({ where: { id: item.id }, data, include: { user: true } });
        send(res, 200, { id: member.id, name: member.user.name, email: member.user.email, course: member.course, plan: member.plan, status: member.status.toLowerCase(), sportSlots: member.sportSlots });
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
  }
  if (name === 'news') {
    if (req.method === 'GET') return send(res, 200, (await prisma.news.findMany({ orderBy: { createdAt: 'desc' } })).map(item => ({ id: item.id, title: item.title, category: item.category, text: item.content, imageUrl: item.imageUrl || null, videoUrl: item.videoUrl || null, date: item.createdAt.toISOString().slice(0, 10) })));
    if (req.method === 'POST') return body(req).then(async item => { const news = await prisma.news.create({ data: { title: item.title, category: item.category || 'Comunicado', content: item.text || item.content || '', imageUrl: item.imageUrl || null, videoUrl: item.videoUrl || null, published: item.published !== false } }); send(res, 201, { id: news.id, title: news.title, category: news.category, text: news.content, imageUrl: news.imageUrl, videoUrl: news.videoUrl, date: news.createdAt.toISOString().slice(0, 10) }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.news.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'athletes') {
    if (req.method === 'GET') return send(res, 200, await prisma.athlete.findMany({ orderBy: { createdAt: 'desc' } }));
    if (req.method === 'POST') return body(req).then(async item => send(res, 201, await prisma.athlete.create({ data: { name: item.name, course: item.course, sport: item.sport, position: item.position, attendance: Number(item.attendance || 0) } }))).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => send(res, 200, await prisma.athlete.update({ where: { id: item.id }, data: { name: item.name, course: item.course, sport: item.sport, position: item.position } }))).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.athlete.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'modalities') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'GET') return send(res, 200, (await prisma.team.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { sessions: true, enrollments: true } } } })).map(t => ({ id: t.id, name: t.name, sport: t.sport, gender: t.gender, description: t.description, trainingDay: t.trainingDay, active: t.active, dropInPriceCents: t.dropInPriceCents, sessionCount: t._count.sessions, enrollmentCount: t._count.enrollments, createdAt: t.createdAt.toISOString() })));
    if (req.method === 'POST') return body(req).then(async item => {
      const team = await prisma.team.create({ data: { name: item.name, sport: item.sport, gender: ['MASCULINO', 'FEMININO', 'MISTA'].includes(item.gender) ? item.gender : 'MISTA', description: item.description || null, trainingDay: item.trainingDay || null, dropInPriceCents: item.dropInPrice ? Math.round(Number(item.dropInPrice) * 100) : null } });
      send(res, 201, { ...team, createdAt: team.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const team = await prisma.team.update({ where: { id: item.id }, data: { name: item.name, sport: item.sport, gender: ['MASCULINO', 'FEMININO', 'MISTA'].includes(item.gender) ? item.gender : 'MISTA', description: item.description || null, trainingDay: item.trainingDay || null, dropInPriceCents: item.dropInPrice ? Math.round(Number(item.dropInPrice) * 100) : null } });
      send(res, 200, { ...team, createdAt: team.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.team.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'member-athletes') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });
    const params = new URL(req.url, 'http://internal').searchParams;
    const search = (params.get('search') || '').trim().toLowerCase();
    const teamId = params.get('teamId');
    const members = await prisma.member.findMany({
      where: teamId ? { teamEnrollments: { some: { teamId } } } : search ? { OR: [{ user: { name: { contains: search, mode: 'insensitive' } } }, { course: { contains: search, mode: 'insensitive' } }] } : undefined,
      include: { user: true, teamEnrollments: { include: { team: true } } },
      orderBy: { user: { name: 'asc' } },
      take: teamId ? undefined : 25,
    });
    return send(res, 200, members.map(m => {
      const usedSlots = m.teamEnrollments.reduce((sum, e) => sum + teamSlotWeight(e.team), 0);
      return { id: m.id, name: m.user.name, course: m.course, sportSlots: m.sportSlots, usedSlots, membershipKind: m.membershipKind, teams: m.teamEnrollments.map(e => ({ teamId: e.teamId, teamName: e.team.name, enrollmentId: e.id })) };
    }));
  }
  if (name === 'team-enrollments') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'POST') return body(req).then(async item => {
      const [team, member] = await Promise.all([
        prisma.team.findUnique({ where: { id: item.teamId } }),
        prisma.member.findUnique({ where: { id: item.memberId }, include: { teamEnrollments: { include: { team: true } } } }),
      ]);
      if (!team || !member) return send(res, 404, { error: 'Modalidade ou sócio não encontrado' });
      if (member.teamEnrollments.some(e => e.teamId === item.teamId)) return send(res, 400, { error: 'Este sócio já está vinculado a esta modalidade.' });
      const usedSlots = member.teamEnrollments.reduce((sum, e) => sum + teamSlotWeight(e.team), 0);
      const weight = teamSlotWeight(team);
      if (usedSlots + weight > member.sportSlots) return send(res, 400, { error: `Sócio já usou ${usedSlots} de ${member.sportSlots} vaga(s) — vincular a ${team.name} exigiria ${weight}.` });
      const enrollment = await prisma.teamEnrollment.create({ data: { memberId: item.memberId, teamId: item.teamId, status: 'APPROVED' } });
      send(res, 201, enrollment);
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.teamEnrollment.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'team-sessions') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const mapSession = s => ({ id: s.id, teamId: s.teamId, teamName: s.team.name, type: s.type, date: s.date.toISOString(), location: s.location, coachName: s.coachName, coachCost: s.coachCost === null ? null : Number(s.coachCost), refereeName: s.refereeName, refereePixKey: s.refereePixKey, refereeCost: s.refereeCost === null ? null : Number(s.refereeCost), notes: s.notes, createdAt: s.createdAt.toISOString() });
    if (req.method === 'GET') {
      const teamId = new URL(req.url, 'http://internal').searchParams.get('teamId');
      const sessions = await prisma.teamSession.findMany({ where: teamId ? { teamId } : undefined, include: { team: true }, orderBy: { date: 'desc' } });
      return send(res, 200, sessions.map(mapSession));
    }
    if (req.method === 'POST') return body(req).then(async item => {
      const created = await prisma.teamSession.create({ data: {
        teamId: item.teamId, type: item.type === 'JOGO' ? 'JOGO' : 'TREINO', date: new Date(`${String(item.date).slice(0, 10)}T12:00:00`), location: item.location || null,
        coachName: item.coachName || null, coachCost: item.coachCost === '' || item.coachCost === undefined || item.coachCost === null ? null : Number(item.coachCost),
        refereeName: item.refereeName || null, refereePixKey: item.refereePixKey || null, refereeCost: item.refereeCost === '' || item.refereeCost === undefined || item.refereeCost === null ? null : Number(item.refereeCost),
        notes: item.notes || null,
      }, include: { team: true } });
      chargeSessionParticipants(created).catch(error => console.error('Erro ao gerar cobranças da sessão:', error.message));
      send(res, 201, mapSession(created));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const updated = await prisma.teamSession.update({ where: { id: item.id }, data: {
        type: item.type === 'JOGO' ? 'JOGO' : 'TREINO', date: new Date(`${String(item.date).slice(0, 10)}T12:00:00`), location: item.location || null,
        coachName: item.coachName || null, coachCost: item.coachCost === '' || item.coachCost === undefined || item.coachCost === null ? null : Number(item.coachCost),
        refereeName: item.refereeName || null, refereePixKey: item.refereePixKey || null, refereeCost: item.refereeCost === '' || item.refereeCost === undefined || item.refereeCost === null ? null : Number(item.refereeCost),
        notes: item.notes || null,
      }, include: { team: true } });
      send(res, 200, mapSession(updated));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.teamSession.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'tasks') {
    if (req.method === 'GET') return send(res, 200, (await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })).map(t => ({
      ...t,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null
    })));
    if (req.method === 'POST') return body(req).then(async item => {
      const t = await prisma.task.create({
        data: {
          title: item.title,
          team: item.team,
          owner: item.owner || '--',
          assigner: item.assigner || null,
          priority: item.priority || 'media',
          dueDate: item.dueDate ? new Date(`${String(item.dueDate).slice(0, 10)}T12:00:00`) : null,
          status: item.status || 'todo',
          completedAt: item.status === 'done' ? new Date() : null
        }
      });
      send(res, 201, {
        ...t,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode editar tarefas' });
      return body(req).then(async item => {
      const current = await prisma.task.findUnique({ where: { id: item.id } });
      const data = {};
      if (item.status !== undefined) {
        data.status = item.status;
        if (item.status === 'done' && (!current || current.status !== 'done')) {
          data.completedAt = new Date();
        } else if (item.status !== 'done') {
          data.completedAt = null;
        }
      }
      if (item.title !== undefined) data.title = item.title;
      if (item.team !== undefined) data.team = item.team;
      if (item.owner !== undefined) data.owner = item.owner || '--';
      if (item.assigner !== undefined) data.assigner = item.assigner || null;
      if (item.priority !== undefined) data.priority = item.priority || 'media';
      if (item.dueDate !== undefined) data.dueDate = item.dueDate ? new Date(`${String(item.dueDate).slice(0, 10)}T12:00:00`) : null;
      const updated = await prisma.task.update({ where: { id: item.id }, data });
      send(res, 200, {
        ...updated,
        dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
    if (req.method === 'DELETE') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir tarefas' });
      return body(req).then(async item => { await prisma.task.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
  }
  if (name === 'sponsors') {
    if (req.method === 'GET') return send(res, 200, await prisma.sponsor.findMany({ orderBy: { createdAt: 'desc' } }));
    if (req.method === 'POST') return body(req).then(async item => send(res, 201, await prisma.sponsor.create({
      data: {
        company: item.company,
        contact: item.contact,
        value: item.value || 'A definir',
        status: item.status || 'Negociando',
        delivery: item.delivery || '—',
        category: item.category || 'PATROCINIO',
        responsibleName: item.responsibleName || null,
        responsibleEmail: item.responsibleEmail || null,
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
        notes: item.notes || null
      }
    }))).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode editar patrocinadores' });
      return body(req).then(async item => {
        const data = {};
        if (item.company !== undefined) data.company = item.company;
        if (item.contact !== undefined) data.contact = item.contact;
        if (item.value !== undefined) data.value = item.value || 'A definir';
        if (item.status !== undefined) data.status = item.status || 'Negociando';
        if (item.delivery !== undefined) data.delivery = item.delivery || '—';
        if (item.category !== undefined) data.category = item.category;
        if (item.responsibleName !== undefined) data.responsibleName = item.responsibleName || null;
        if (item.responsibleEmail !== undefined) data.responsibleEmail = item.responsibleEmail || null;
        if (item.startDate !== undefined) data.startDate = item.startDate ? new Date(item.startDate) : null;
        if (item.endDate !== undefined) data.endDate = item.endDate ? new Date(item.endDate) : null;
        if (item.notes !== undefined) data.notes = item.notes || null;
        send(res, 200, await prisma.sponsor.update({ where: { id: item.id }, data }));
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
    if (req.method === 'DELETE') {
      const session = resolveSession(bearerToken(req));
      if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir patrocinadores' });
      return body(req).then(async item => { await prisma.sponsor.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
  }
    const productPhotosDir = path.join(uploadsDir, 'products');
    if (!fs.existsSync(productPhotosDir)) fs.mkdirSync(productPhotosDir, { recursive: true });
    const newsMediaDir = path.join(uploadsDir, 'news');
    if (!fs.existsSync(newsMediaDir)) fs.mkdirSync(newsMediaDir, { recursive: true });

  if (url.pathname === '/api/news/upload' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      const extension = (path.extname(info.filename || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
      const safeName = `news_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
      const destination = path.join(newsMediaDir, safeName);
      stream.pipe(fs.createWriteStream(destination));
      stream.on('limit', () => { fileError = 'O arquivo deve ter no máximo 50 MB'; });
      savedPath = safeName;
    });
    busboy.on('finish', () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhum arquivo enviado' });
      return send(res, 200, { url: `/uploads/news/${savedPath}` });
    });
    return req.pipe(busboy);
  }

  if (url.pathname === '/api/products/upload' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      const extension = (path.extname(info.filename || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
      const safeName = `product_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
      const destination = path.join(productPhotosDir, safeName);
      stream.pipe(fs.createWriteStream(destination));
      stream.on('limit', () => { fileError = 'A imagem deve ter no máximo 10 MB'; });
      savedPath = safeName;
    });
    busboy.on('finish', () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhuma imagem enviada' });
      return send(res, 200, { url: `/uploads/products/${savedPath}` });
    });
    return req.pipe(busboy);
  }

  if (name === 'store-products') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'GET') return send(res, 200, (await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      price: p.priceCents / 100,
      category: p.category,
      stock: p.stock ?? 0,
      type: p.type || 'PRONTA_ENTREGA',
      allowSize: !!p.allowSize,
      allowCustomization: !!p.allowCustomization,
      active: p.active,
      createdAt: p.createdAt.toISOString()
    })));
    if (req.method === 'POST') return body(req).then(async item => {
      const p = await prisma.product.create({
        data: {
          name: item.name,
          description: item.description || null,
          imageUrl: item.imageUrl || null,
          priceCents: Math.round(Number(item.price || 0) * 100),
          category: item.category || 'Geral',
          stock: Number(item.stock || 0),
          type: item.type === 'ENCOMENDA' ? 'ENCOMENDA' : 'PRONTA_ENTREGA',
          allowSize: !!item.allowSize,
          allowCustomization: !!item.allowCustomization,
          active: item.active !== false
        }
      });
      send(res, 201, {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        price: p.priceCents / 100,
        category: p.category,
        stock: p.stock,
        type: p.type,
        allowSize: p.allowSize,
        allowCustomization: p.allowCustomization,
        active: p.active,
        createdAt: p.createdAt.toISOString()
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const data = {};
      if (item.active !== undefined) data.active = item.active;
      if (item.name !== undefined) data.name = item.name;
      if (item.category !== undefined) data.category = item.category;
      if (item.price !== undefined) data.priceCents = Math.round(Number(item.price || 0) * 100);
      if (item.stock !== undefined) data.stock = Number(item.stock || 0);
      if (item.type !== undefined) data.type = item.type === 'ENCOMENDA' ? 'ENCOMENDA' : 'PRONTA_ENTREGA';
      if (item.allowSize !== undefined) data.allowSize = !!item.allowSize;
      if (item.allowCustomization !== undefined) data.allowCustomization = !!item.allowCustomization;
      if (item.description !== undefined) data.description = item.description || null;
      if (item.imageUrl !== undefined) data.imageUrl = item.imageUrl || null;

      const p = await prisma.product.update({ where: { id: item.id }, data });
      send(res, 200, {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        price: p.priceCents / 100,
        category: p.category,
        stock: p.stock,
        type: p.type,
        allowSize: p.allowSize,
        allowCustomization: p.allowCustomization,
        active: p.active,
        createdAt: p.createdAt.toISOString()
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.product.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }

  // Rotas de gestão de Pedidos e Encomendas (Diretoria)
  if (url.pathname === '/api/admin/orders' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const orders = await prisma.order.findMany({
      include: {
        member: { include: { user: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return send(res, 200, orders.map(o => ({
      id: o.id,
      memberId: o.memberId,
      memberName: o.member.user.name,
      memberEmail: o.member.user.email,
      memberRegistration: o.member.registration || o.memberId,
      status: o.status,
      totalCents: o.totalCents,
      totalPrice: o.totalCents / 100,
      estimatedDelivery: o.estimatedDelivery ? o.estimatedDelivery.toISOString() : null,
      notifiedAt: o.notifiedAt ? o.notifiedAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      deliveredBy: o.deliveredBy,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map(i => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        productType: i.product.type,
        productImage: i.product.imageUrl,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        size: i.size,
        customizationName: i.customizationName,
        customizationNumber: i.customizationNumber
      }))
    })));
  }

  if (url.pathname === '/api/admin/orders/update-delivery' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    return body(req).then(async item => {
      if (!item.orderId || !item.estimatedDelivery) return send(res, 400, { error: 'Informe o ID do pedido e a data prevista.' });
      const order = await prisma.order.update({
        where: { id: item.orderId },
        data: {
          estimatedDelivery: new Date(item.estimatedDelivery),
          status: item.status || 'PREPARING'
        }
      });
      send(res, 200, { ok: true, estimatedDelivery: order.estimatedDelivery.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }

  if (url.pathname === '/api/admin/orders/notify' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    return body(req).then(async item => {
      const order = await prisma.order.findUnique({
        where: { id: item.orderId },
        include: { member: { include: { user: true } }, items: { include: { product: true } } }
      });
      if (!order) return send(res, 404, { error: 'Pedido não encontrado' });
      
      const now = new Date();
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'READY_FOR_PICKUP', notifiedAt: now }
      });

      // Simulação de envio de E-mail para o associado
      console.log(`[E-MAIL SIMULADO] Para: ${order.member.user.email} | Assunto: Seu produto COMPEX está disponível para retirada!`);
      
      send(res, 200, { ok: true, notifiedAt: now.toISOString(), emailSentTo: order.member.user.email });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }

  if (url.pathname === '/api/admin/orders/deliver' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    return body(req).then(async item => {
      const { orderId, qrCode } = item;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { member: { include: { user: true } } }
      });
      if (!order) return send(res, 404, { error: 'Pedido não encontrado' });
      
      // Validação da carteirinha (QR Code ou matrícula ou id do associado)
      const isQrValid = qrCode && (
        qrCode.trim() === order.member.id ||
        qrCode.trim() === order.member.registration ||
        qrCode.includes(order.member.id) ||
        (order.member.registration && qrCode.includes(order.member.registration))
      );

      if (!isQrValid && !item.forceDeliver) {
        return send(res, 400, { error: 'QR Code / Carteirinha não corresponde ao dono do pedido!' });
      }

      const now = new Date();
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED', deliveredAt: now, deliveredBy: session.name }
      });

      send(res, 200, { ok: true, deliveredAt: now.toISOString(), deliveredBy: session.name });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'assets') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'GET') return send(res, 200, (await prisma.asset.findMany({ orderBy: { createdAt: 'desc' } })).map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
    if (req.method === 'POST') return body(req).then(async item => {
      const a = await prisma.asset.create({
        data: {
          name: item.name,
          category: item.category || 'Geral',
          quantity: Number(item.quantity || 1),
          condition: ['OTIMO', 'BOM', 'REGULAR', 'RUIM'].includes(item.condition) ? item.condition : 'BOM',
          sport: item.sport || null,
          gender: ['MASCULINO', 'FEMININO', 'MISTA'].includes(item.gender) ? item.gender : null,
          location: item.location || null,
          notes: item.notes || null,
        },
      });
      send(res, 201, { ...a, createdAt: a.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const a = await prisma.asset.update({
        where: { id: item.id },
        data: {
          name: item.name,
          category: item.category || 'Geral',
          quantity: Number(item.quantity || 1),
          condition: ['OTIMO', 'BOM', 'REGULAR', 'RUIM'].includes(item.condition) ? item.condition : 'BOM',
          sport: item.sport || null,
          gender: ['MASCULINO', 'FEMININO', 'MISTA'].includes(item.gender) ? item.gender : null,
          location: item.location || null,
          notes: item.notes || null,
        },
      });
      send(res, 200, { ...a, createdAt: a.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.asset.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'asset-loans') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    
    if (req.method === 'GET') {
      const loans = await prisma.assetLoan.findMany({
        include: { asset: true },
        orderBy: { createdAt: 'desc' }
      });
      return send(res, 200, loans.map(l => ({
        ...l,
        loanDate: l.loanDate.toISOString(),
        expectedReturn: l.expectedReturn ? l.expectedReturn.toISOString() : null,
        returnDate: l.returnDate ? l.returnDate.toISOString() : null,
        createdAt: l.createdAt.toISOString()
      })));
    }

    if (req.method === 'POST') return body(req).then(async item => {
      const asset = await prisma.asset.findUnique({ where: { id: item.assetId } });
      if (!asset) return send(res, 404, { error: 'Item de patrimônio não encontrado' });
      if (asset.quantity < (Number(item.quantity) || 1)) {
        return send(res, 400, { error: `Quantidade solicitada (${item.quantity}) maior que o saldo em estoque (${asset.quantity})` });
      }

      const loanId = crypto.randomBytes(8).toString('hex');
      const filename = `termo_liberacao_${loanId}.json`;
      const termPath = path.join(patrimonioDocsDir, filename);
      const termUrl = `/uploads/patrimonio/${filename}`;

      const termData = {
        loanId,
        assetName: asset.name,
        assetCategory: asset.category,
        quantity: Number(item.quantity || 1),
        borrowerName: item.borrowerName,
        borrowerDocument: item.borrowerDocument || null,
        borrowerPhone: item.borrowerPhone || null,
        loanDate: new Date().toISOString(),
        expectedReturn: item.expectedReturn ? new Date(item.expectedReturn).toISOString() : null,
        acceptedTerms: true,
        signatureData: item.signatureData || null, // Assinatura digital base64
        issuedBy: session.name
      };

      fs.writeFileSync(termPath, JSON.stringify(termData, null, 2), 'utf8');

      const loan = await prisma.assetLoan.create({
        data: {
          assetId: item.assetId,
          borrowerName: item.borrowerName,
          borrowerDocument: item.borrowerDocument || null,
          borrowerPhone: item.borrowerPhone || null,
          quantity: Number(item.quantity || 1),
          expectedReturn: item.expectedReturn ? new Date(item.expectedReturn) : null,
          notes: item.notes || null,
          signatureData: item.signatureData || null,
          acceptedTerms: true,
          termDocumentUrl: termUrl
        },
        include: { asset: true }
      });

      send(res, 201, {
        ...loan,
        loanDate: loan.loanDate.toISOString(),
        expectedReturn: loan.expectedReturn ? loan.expectedReturn.toISOString() : null,
        createdAt: loan.createdAt.toISOString()
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });

    if (req.method === 'PUT') return body(req).then(async item => {
      // Registrar devolução
      const loan = await prisma.assetLoan.update({
        where: { id: item.id },
        data: {
          status: item.status === 'DEVOLVIDO' ? 'DEVOLVIDO' : 'EMPRESTADO',
          returnDate: item.status === 'DEVOLVIDO' ? new Date() : null,
          notes: item.notes || undefined
        },
        include: { asset: true }
      });
      send(res, 200, {
        ...loan,
        loanDate: loan.loanDate.toISOString(),
        expectedReturn: loan.expectedReturn ? loan.expectedReturn.toISOString() : null,
        returnDate: loan.returnDate ? loan.returnDate.toISOString() : null,
        createdAt: loan.createdAt.toISOString()
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }

  if (name === 'coaches') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const mapCoach = c => ({ id: c.id, name: c.name, hourlyRateCents: c.hourlyRateCents, hourlyRate: c.hourlyRateCents / 100, pixKey: c.pixKey, notes: c.notes, teamId: c.teamId, teamName: c.team ? c.team.name : null, createdAt: c.createdAt.toISOString() });
    if (req.method === 'GET') return send(res, 200, (await prisma.coach.findMany({ orderBy: { createdAt: 'desc' }, include: { team: true } })).map(mapCoach));
    if (req.method === 'POST') return body(req).then(async item => {
      const c = await prisma.coach.create({ data: { name: item.name, hourlyRateCents: Math.round(Number(item.hourlyRate || 0) * 100), pixKey: item.pixKey || null, notes: item.notes || null, teamId: item.teamId || null }, include: { team: true } });
      send(res, 201, mapCoach(c));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const c = await prisma.coach.update({ where: { id: item.id }, data: { name: item.name, hourlyRateCents: Math.round(Number(item.hourlyRate || 0) * 100), pixKey: item.pixKey || null, notes: item.notes || null, teamId: item.teamId || null }, include: { team: true } });
      send(res, 200, mapCoach(c));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.coach.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'documents') {
    if (req.method === 'GET') return send(res, 200, (await prisma.document.findMany({ orderBy: { createdAt: 'desc' } })).map(item => ({ ...item, access: item.isPublic ? 'public' : 'private' })));
    if (req.method === 'POST') return body(req).then(async item => { const document = await prisma.document.create({ data: { name: item.name, category: item.category, url: item.url || '', isPublic: item.access === 'public' } }); send(res, 201, { ...document, access: document.isPublic ? 'public' : 'private' }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => {
      const document = await prisma.document.delete({ where: { id: item.id } });
      if (document.url && document.url.startsWith('/uploads/')) fs.unlink(path.join(uploadsDir, path.basename(document.url)), () => {});
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  return collection(name, req, res);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, service: 'compex-portal', time: new Date().toISOString() });
  if (url.pathname === '/api/qr' && req.method === 'GET') return QRCode.toBuffer(url.searchParams.get('text') || 'COMPEX-2026-AS-428', {
    type: 'png',
    width: 512,
    margin: 4,
    errorCorrectionLevel: 'H',
    scale: 8,
    color: { dark: '#081220', light: '#ffffff' }
  }).then(buffer => send(res, 200, buffer, 'image/png')).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  if (url.pathname === '/api/auth/login' && req.method === 'POST') return body(req).then(async credentials => {
    const email = (credentials.email || '').trim().toLowerCase();
    const password = credentials.password || '';
    const respond = (user, token) => {
      res.setHeader('Set-Cookie', `compex_role=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`);
      send(res, 200, { user, token });
    };
    if (email === 'diretoria@compex.com.br' && password === 'compex2026') return respond({ name: 'Amanda Silva', role: 'PRESIDENCIA', email }, 'demo-session-compex');
    if (email === 'associado@compex.com.br' && password === 'compex2026') return respond({ name: 'Lucas Associado', role: 'ASSOCIADO', email }, 'demo-session-associado');
    if (!prisma) return send(res, 401, { error: 'E-mail ou senha inválidos' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) return send(res, 401, { error: 'E-mail ou senha inválidos' });
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { name: user.name, role: user.role, rank: user.rank, email: user.email, expiresAt: Date.now() + SESSION_TTL_MS });
    persistSessions();
    respond({ name: user.name, role: user.role, rank: user.rank, email: user.email }, token);
  }).catch(() => send(res, 400, { error: 'JSON invÃ¡lido' }));
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!session) return send(res, 401, { authenticated: false, error: 'Sessão inválida' });
    let member = null;
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: session.email }, include: { member: true } });
      if (user?.member) member = { status: user.member.status.toLowerCase(), plan: user.member.plan, subscriptionStatus: user.member.subscriptionStatus, membershipKind: user.member.membershipKind };
    }
    return send(res, 200, { authenticated: true, user: { name: session.name, role: session.role, rank: session.rank, email: session.email, member } });
  }
  if (url.pathname === '/api/me/become-member' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!INTERNAL_ROLES.has(session.role)) return send(res, 403, { error: 'Disponível para contas da diretoria.' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      const user = await prisma.user.findUnique({ where: { email: session.email }, include: { member: true } });
      if (!user) return send(res, 404, { error: 'Conta não encontrada' });
      if (user.member) return send(res, 400, { error: 'Você já é sócio da atlética.' });
      const member = await prisma.member.create({
        data: {
          userId: user.id, course: item.course || '—', plan: item.plan === 'Semestral' ? 'Semestral' : 'Anual',
          socialName: item.socialName || null, nickname: item.nickname || null, sex: item.sex || null,
          shirtSize: item.shirtSize || null, instagram: item.instagram || null,
          memberType: 'TORCEDOR', status: 'PENDING',
        },
      });
      send(res, 201, { id: member.id, status: member.status.toLowerCase() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    sessions.delete(bearerToken(req));
    persistSessions();
    res.setHeader('Set-Cookie', 'compex_role=; Path=/; Max-Age=0');
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/auth/change-password' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      if (LEGACY_TOKENS[bearerToken(req)]) return send(res, 400, { error: 'Contas de demonstração não podem trocar senha por aqui.' });
      const user = await prisma.user.findUnique({ where: { email: session.email } });
      if (!user || !(await bcrypt.compare(item.currentPassword || '', user.password))) return send(res, 401, { error: 'Senha atual incorreta' });
      if (!item.newPassword || item.newPassword.length < 8) return send(res, 400, { error: 'A nova senha precisa ter ao menos 8 caracteres' });
      await prisma.user.update({ where: { email: session.email }, data: { password: await bcrypt.hash(item.newPassword, 10) } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  const rankLimit = (role, rank) => {
    if (role === 'PRESIDENCIA') return rank === 'DIRETOR' ? 1 : 2;
    return rank === 'DIRETOR' ? 2 : Infinity;
  };
  const rankLimitError = (role, rank) => {
    if (role === 'PRESIDENCIA') return rank === 'DIRETOR' ? 'Já existe um(a) presidente cadastrado(a) — cadastre como vice-presidente.' : 'A presidência já tem 2 vice-presidentes — o máximo.';
    return `${role} já tem 2 diretores — o máximo por área. Cadastre como coordenador.`;
  };
  if (url.pathname === '/api/directors' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 200, []);
    const where = session.role === 'PRESIDENCIA'
      ? { role: { not: 'ASSOCIADO' }, email: { not: session.email } }
      : { role: session.role, email: { not: session.email } };
    return prisma.user.findMany({ where, orderBy: { createdAt: 'asc' }, include: { member: true } })
      .then(users => send(res, 200, users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, rank: u.rank, birthDate: u.birthDate ? u.birthDate.toISOString() : null, member: u.member ? { course: u.member.course, plan: u.member.plan, status: u.member.status.toLowerCase() } : null }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/directors' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      const isPresidencia = session.role === 'PRESIDENCIA';
      if (isPresidencia && !INTERNAL_ROLES.has(item.role)) return send(res, 400, { error: 'Papel inválido' });
      const role = isPresidencia ? item.role : session.role;
      const rank = isPresidencia ? (item.rank === 'COORDENADOR' ? 'COORDENADOR' : 'DIRETOR') : 'COORDENADOR';
      const limit = rankLimit(role, rank);
      if (limit !== Infinity) {
        const count = await prisma.user.count({ where: { role, rank } });
        if (count >= limit) return send(res, 400, { error: rankLimitError(role, rank) });
      }
      const hashed = await bcrypt.hash(item.password || crypto.randomBytes(6).toString('hex'), 10);
      const user = await prisma.user.create({
        data: { name: item.name, email: (item.email || '').trim().toLowerCase(), password: hashed, role, rank, birthDate: item.birthDate ? new Date(item.birthDate) : null },
      });
      send(res, 201, { id: user.id, name: user.name, email: user.email, role: user.role, rank: user.rank, birthDate: user.birthDate ? user.birthDate.toISOString() : null, member: null });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/directors' && req.method === 'PUT') {
    const session = resolveSession(bearerToken(req));
    if (!session || session.role !== 'PRESIDENCIA') return send(res, 403, { error: 'Acesso restrito à Presidência' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      if (item.role && !INTERNAL_ROLES.has(item.role)) return send(res, 400, { error: 'Papel inválido' });
      if (item.rank && !['DIRETOR', 'COORDENADOR'].includes(item.rank)) return send(res, 400, { error: 'Nível inválido' });
      if (item.name !== undefined && !item.name.trim()) return send(res, 400, { error: 'Nome não pode ficar vazio' });
      if (item.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) return send(res, 400, { error: 'E-mail inválido' });
      const data = {};
      if (item.name !== undefined) data.name = item.name.trim();
      if (item.email !== undefined) data.email = item.email.trim().toLowerCase();
      if (item.role) data.role = item.role;
      if (item.birthDate !== undefined) data.birthDate = item.birthDate ? new Date(item.birthDate) : null;
      if (item.rank) data.rank = item.rank;
      if (item.role || item.rank) {
        const current = await prisma.user.findUnique({ where: { id: item.id } });
        if (!current) return send(res, 404, { error: 'Conta não encontrada' });
        const targetRole = item.role || current.role;
        const targetRank = item.rank || current.rank;
        if (targetRole !== current.role || targetRank !== current.rank) {
          const limit = rankLimit(targetRole, targetRank);
          if (limit !== Infinity) {
            const count = await prisma.user.count({ where: { role: targetRole, rank: targetRank, id: { not: item.id } } });
            if (count >= limit) return send(res, 400, { error: rankLimitError(targetRole, targetRank) });
          }
        }
      }
      const user = await prisma.user.update({ where: { id: item.id }, data, include: { member: true } });
      send(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role, rank: user.rank, birthDate: user.birthDate ? user.birthDate.toISOString() : null, member: user.member ? { course: user.member.course, plan: user.member.plan, status: user.member.status.toLowerCase() } : null });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/directors' && req.method === 'DELETE') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      if (session.role !== 'PRESIDENCIA') {
        const target = await prisma.user.findUnique({ where: { id: item.id } });
        if (!target || target.role !== session.role || target.rank !== 'COORDENADOR') return send(res, 403, { error: 'Só é possível remover coordenadores do seu próprio departamento' });
      }
      await prisma.directorWarning.deleteMany({ where: { userId: item.id } });
      await prisma.user.delete({ where: { id: item.id } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/warnings' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 200, []);
    const where = session.role === 'PRESIDENCIA' ? {} : { user: { role: session.role } };
    return prisma.directorWarning.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } })
      .then(rows => send(res, 200, rows.map(w => ({ id: w.id, type: w.type, reason: w.reason, createdAt: w.createdAt.toISOString(), userId: w.userId, userName: w.user.name, userRole: w.user.role }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/warnings' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      const target = await prisma.user.findUnique({ where: { id: item.userId } });
      if (!target) return send(res, 404, { error: 'Conta não encontrada' });
      if (session.role !== 'PRESIDENCIA' && target.role !== session.role) return send(res, 403, { error: 'Só é possível registrar advertências no seu próprio departamento' });
      if (!['ADVERTENCIA', 'SUSPENSAO', 'DESLIGAMENTO'].includes(item.type)) return send(res, 400, { error: 'Tipo inválido' });
      const warning = await prisma.directorWarning.create({ data: { userId: item.userId, type: item.type, reason: item.reason || '' } });
      send(res, 201, { id: warning.id, type: warning.type, reason: warning.reason, createdAt: warning.createdAt.toISOString(), userId: warning.userId, userName: target.name, userRole: target.role });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/warnings' && req.method === 'DELETE') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Acesso restrito à Presidência e diretores' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      await prisma.directorWarning.delete({ where: { id: item.id } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  const internalSession = req => { const session = resolveSession(bearerToken(req)); return session && INTERNAL_ROLES.has(session.role) ? session : null; };
  if (url.pathname === '/api/polls' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 200, []);
    const now = new Date();
    return prisma.poll.findMany({ include: { votes: true }, orderBy: { createdAt: 'desc' } }).then(polls => send(res, 200, polls.map(poll => {
      const options = poll.options;
      const results = options.map((option, index) => ({ option, votes: poll.votes.filter(v => v.optionIndex === index).length }));
      const mine = poll.votes.find(v => v.voterEmail === session.email);
      const isExpired = poll.expiresAt ? new Date(poll.expiresAt) <= now : false;
      const effectiveClosed = poll.closed || isExpired;
      return {
        id: poll.id,
        question: poll.question,
        options,
        closed: poll.closed,
        isExpired,
        effectiveClosed,
        expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
        createdBy: poll.createdBy,
        createdAt: poll.createdAt.toISOString(),
        results,
        totalVotes: poll.votes.length,
        myVote: mine ? mine.optionIndex : null
      };
    }))).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/polls' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      const options = (item.options || []).map(o => String(o).trim()).filter(Boolean);
      if (!item.question || options.length < 2) return send(res, 400, { error: 'Informe a pergunta e ao menos 2 opções' });
      let expiresAt = null;
      if (item.expiresAt) {
        const parsedDate = new Date(item.expiresAt);
        if (!isNaN(parsedDate.getTime())) {
          expiresAt = parsedDate;
        }
      }
      const poll = await prisma.poll.create({ data: { question: item.question, options, expiresAt, createdBy: session.name } });
      const now = new Date();
      const isExpired = poll.expiresAt ? new Date(poll.expiresAt) <= now : false;
      send(res, 201, {
        id: poll.id,
        question: poll.question,
        options: poll.options,
        closed: poll.closed,
        isExpired,
        effectiveClosed: poll.closed || isExpired,
        expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
        createdBy: poll.createdBy,
        createdAt: poll.createdAt.toISOString(),
        results: options.map(option => ({ option, votes: 0 })),
        totalVotes: 0,
        myVote: null
      });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  const voteMatch = url.pathname.match(/^\/api\/polls\/([^/]+)\/vote$/);
  if (voteMatch && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      const poll = await prisma.poll.findUnique({ where: { id: voteMatch[1] } });
      if (!poll) return send(res, 404, { error: 'Enquete não encontrada' });
      const isExpired = poll.expiresAt ? new Date(poll.expiresAt) <= new Date() : false;
      if (poll.closed || isExpired) return send(res, 400, { error: isExpired ? 'Enquete expirada para votação' : 'Enquete encerrada para votação' });
      await prisma.pollVote.upsert({ where: { pollId_voterEmail: { pollId: poll.id, voterEmail: session.email } }, update: { optionIndex: Number(item.optionIndex) }, create: { pollId: poll.id, voterEmail: session.email, optionIndex: Number(item.optionIndex) } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  const closeMatch = url.pathname.match(/^\/api\/polls\/([^/]+)\/close$/);
  if (closeMatch && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return (async () => {
      const poll = await prisma.poll.update({ where: { id: closeMatch[1] }, data: { closed: true }, include: { votes: true } });
      const options = poll.options;
      const results = options.map((option, index) => `${option}: ${poll.votes.filter(v => v.optionIndex === index).length} voto(s)`).join(' · ');
      await prisma.document.create({ data: { name: `Enquete: ${poll.question}`, category: 'Enquetes', url: '', isPublic: false } }).catch(() => {});
      send(res, 200, { ok: true, summary: results });
    })().catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  const deleteMatch = url.pathname.match(/^\/api\/polls\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return (async () => {
      await prisma.pollVote.deleteMany({ where: { pollId: deleteMatch[1] } });
      await prisma.poll.delete({ where: { id: deleteMatch[1] } });
      send(res, 200, { ok: true });
    })().catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/board' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 200, []);
    const type = url.searchParams.get('type');
    return prisma.boardPost.findMany({ where: type ? { type } : undefined, orderBy: { createdAt: 'desc' }, take: 50 })
      .then(rows => send(res, 200, rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/board' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      if (!['RECADO', 'ELOGIO'].includes(item.type) || !item.message) return send(res, 400, { error: 'Dados inválidos' });
      const post = await prisma.boardPost.create({ data: { type: item.type, authorName: session.name, message: item.message } });
      send(res, 201, { ...post, createdAt: post.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/board' && req.method === 'DELETE') {
    const session = internalSession(req);
    if (!canManageAccounts(session)) return send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir recados' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => { await prisma.boardPost.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/checkins' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 200, { event: null, total: 0, recent: [] });
    return (async () => {
      const event = await prisma.event.findFirst({ where: { published: true }, orderBy: { date: 'asc' } });
      if (!event) return send(res, 200, { event: null, total: 0, recent: [] });
      const checkins = await prisma.eventCheckIn.findMany({ where: { eventId: event.id }, include: { member: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
      const confirmed = await prisma.member.count({ where: { status: 'ACTIVE' } });
      send(res, 200, {
        event: { id: event.id, name: event.name, date: event.date.toISOString(), location: event.location },
        total: checkins.length,
        confirmed,
        waiting: Math.max(0, confirmed - checkins.length),
        recent: checkins.slice(0, 10).map(c => ({ name: c.member.user.name, course: c.member.course, createdAt: c.createdAt.toISOString() }))
      });
    })().catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/checkins' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    return body(req).then(async item => {
      if (!item.eventId) return send(res, 400, { error: 'Nenhum evento ativo' });
      const code = (item.code || '').trim();
      const member = await prisma.member.findFirst({ where: { OR: [{ registration: code }, { id: code }] }, include: { user: true } });
      if (!member) return send(res, 404, { error: 'Código não encontrado. Confira a carteirinha do associado.' });
      const existing = await prisma.eventCheckIn.findUnique({ where: { eventId_memberId: { eventId: item.eventId, memberId: member.id } } }).catch(() => null);
      if (existing) return send(res, 200, { alreadyCheckedIn: true, member: { name: member.user.name, course: member.course } });
      await prisma.eventCheckIn.create({ data: { eventId: item.eventId, memberId: member.id } });
      send(res, 201, { alreadyCheckedIn: false, member: { name: member.user.name, course: member.course } });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/stats' && req.method === 'GET' && prisma) return Promise.all([
    prisma.member.count({ where: { status: 'ACTIVE' } }),
    prisma.event.count({ where: { published: true } }),
    prisma.athlete.count(),
    prisma.news.count({ where: { published: true } }),
    computeFinanceOverview(),
  ]).then(([members, events, athletes, news, finance]) => {
    const income = finance.entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const expense = finance.entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    send(res, 200, { members, events, athletes, news, income, expense, balance: income - expense, months: finance.months });
  }).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  if (url.pathname === '/api/dashboard-extra' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 200, { birthdays: [], spotlight: null, upcomingGames: [], upcomingTrainings: [], todayTasks: [] });
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const roleLabel = { PRESIDENCIA: 'Presidência', FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes', EVENTOS: 'Eventos', MARKETING: 'Marketing' };
    return Promise.all([
      prisma.user.findMany({ where: { role: { not: 'ASSOCIADO' }, birthDate: { not: null } } }),
      prisma.task.findMany({ where: { status: 'done' } }),
      prisma.user.findMany({ where: { role: { not: 'ASSOCIADO' } } }),
      prisma.teamSession.findMany({ where: { type: 'JOGO', date: { gte: now } }, orderBy: { date: 'asc' }, take: 3, include: { team: true } }),
      prisma.teamSession.findMany({ where: { type: 'TREINO', date: { gte: now } }, orderBy: { date: 'asc' }, take: 3, include: { team: true } }),
      prisma.task.findMany({ where: { status: { not: 'done' } } }),
    ]).then(([birthdayUsers, doneTasks, directors, games, trainings, openTasks]) => {
      const birthdays = birthdayUsers
        .filter(u => u.birthDate.getUTCMonth() === now.getUTCMonth())
        .map(u => ({ name: u.name, role: roleLabel[u.role] || u.role, day: u.birthDate.getUTCDate() }))
        .sort((a, b) => a.day - b.day);

      const tally = {};
      doneTasks.forEach(t => { if (t.owner) tally[t.owner] = (tally[t.owner] || 0) + 1; });
      let spotlight = null;
      let topCount = 0;
      Object.entries(tally).forEach(([owner, count]) => {
        if (count > topCount) {
          const match = directors.find(d => d.name.toLowerCase() === owner.toLowerCase());
          spotlight = { name: match ? match.name : owner, role: match ? (roleLabel[match.role] || match.role) : null, count };
          topCount = count;
        }
      });

      const mapSession = s => ({ id: s.id, teamName: s.team.name, date: s.date.toISOString(), location: s.location, coachName: s.coachName });
      const todayTasks = openTasks.filter(t => t.dueDate && t.dueDate.toISOString().slice(0, 10) === todayKey)
        .map(t => ({ id: t.id, title: t.title, team: t.team, owner: t.owner, status: t.status }));

      send(res, 200, { birthdays, spotlight, upcomingGames: games.map(mapSession), upcomingTrainings: trainings.map(mapSession), todayTasks });
    }).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/documents/upload' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    const fields = {};
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 25 * 1024 * 1024 } });
    busboy.on('field', (name, value) => { fields[name] = value; });
    busboy.on('file', (name, stream, info) => {
      const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(info.filename || '')}`;
      const dest = path.join(uploadsDir, safeName);
      stream.pipe(fs.createWriteStream(dest));
      stream.on('limit', () => { fileError = 'Arquivo maior que 25 MB'; });
      savedPath = { safeName, originalName: info.filename };
    });
    busboy.on('finish', async () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhum arquivo enviado' });
      try {
        const document = await prisma.document.create({ data: { name: fields.name || savedPath.originalName, category: fields.category || 'Geral', url: `/uploads/${savedPath.safeName}`, isPublic: fields.access === 'public' } });
        send(res, 201, { ...document, access: document.isPublic ? 'public' : 'private' });
      } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    });
    return req.pipe(busboy);
  }
  if (url.pathname === '/api/me/photo' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) return send(res, 401, { error: 'Autenticação necessária' });
    if (!prisma) return send(res, 503, { error: 'Banco de dados indisponível' });
    const member = await prisma.member.findFirst({ where: { user: { email: session.email } } });
    if (!member) return send(res, 404, { error: 'Associado não encontrado' });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      const extension = (path.extname(info.filename || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
      const safeName = `${member.id}${extension}`;
      const destination = path.join(associatePhotosDir, safeName);
      stream.pipe(fs.createWriteStream(destination));
      stream.on('limit', () => { fileError = 'A foto deve ter no máximo 8 MB'; });
      savedPath = safeName;
    });
    busboy.on('finish', async () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhuma foto enviada' });
      const url = `/uploads/associates/${savedPath}`;
      await prisma.member.update({ where: { id: member.id }, data: { photoUrl: url } });
      return send(res, 200, { url });
    });
    return req.pipe(busboy);
  }
  const associateRoutes = ['/api/teams', '/api/products', '/api/me/', '/api/checkout/', '/api/webhooks/mercadopago'];
  if (associateRoutes.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix)) || /^\/api\/teams\/[^/]+\/enroll$/.test(url.pathname)) {
    req.associateSession = resolveSession(bearerToken(req));
    return handleAssociateRoute(url.pathname, req, res).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname.startsWith('/api/')) return databaseCollection(url.pathname.split('/')[2], req, res, url).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  if (url.pathname.startsWith('/uploads/') && req.method === 'GET') {
    const relativePath = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    const filePath = path.resolve(uploadsDir, relativePath);
    const filename = path.basename(filePath);
    if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) return send(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
    return (async () => {
      const document = prisma ? await prisma.document.findFirst({ where: { url: `/uploads/${filename}` } }) : null;
      if (document && !document.isPublic) {
        const session = resolveSession(parseCookies(req).compex_role) || resolveSession(bearerToken(req));
        if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 403, 'Documento restrito à diretoria', 'text/plain; charset=utf-8');
      }
      const contents = fs.readFileSync(filePath);
      send(res, 200, contents, mime[path.extname(filePath)] || 'application/octet-stream');
    })().catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  let requested = url.pathname === '/' ? '/public/index.html' : url.pathname;
  const file = path.normalize(path.join(root, requested));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'PÃ¡gina nÃ£o encontrada', 'text/plain; charset=utf-8');
  let contents = fs.readFileSync(file);
  const contentType = mime[path.extname(file)] || 'application/octet-stream';
  if (contentType.startsWith('text/html')) {
    const pageName = path.basename(file);
    const internalPages = new Set(['dashboard.html','portal.html','event-manager.html','finance.html','members.html','sports.html','documents.html','permissions.html','warnings.html','communication.html','tasks.html','sponsors.html','checkin.html','produtos.html','patrimonio.html','associar-se.html','beneficios-gestao.html']);
    if (internalPages.has(pageName)) {
      const session = resolveSession(parseCookies(req).compex_role);
      if (!session || !INTERNAL_ROLES.has(session.role)) { res.writeHead(302, { Location: '/public/gestao-login.html' }); return res.end(); }
      if (pageName === 'permissions.html' || pageName === 'warnings.html') {
        const canManageAccounts = session.role === 'PRESIDENCIA' || session.rank === 'DIRETOR';
        if (!canManageAccounts) { res.writeHead(302, { Location: '/gestao/portal.html?denied=1' }); return res.end(); }
      } else {
        const allowed = PAGE_ROLES[pageName];
        if (allowed && !allowed.has(session.role)) { res.writeHead(302, { Location: '/gestao/portal.html?denied=1' }); return res.end(); }
      }
    }
    const adminLink = internalPages.has(pageName) ? '<link rel="stylesheet" href="/gestao/admin.css">' : '';
    const publicJoin = new Set(['index.html','events-public.html','sports-public.html','beneficios.html']).has(pageName) ? '<a class="join-button" href="/public/associate-signup.html">Associe-se</a>' : '';
    const homeReference = pageName === 'index.html' ? '<link rel="stylesheet" href="/public/home-reference.css"><link rel="stylesheet" href="/public/home-layout-fix.css"><link rel="stylesheet" href="/public/home-logo-cache.css">' : '';
    const publicHeaderActions = new Set(['index.html','events-public.html','sports-public.html','beneficios.html']).has(pageName) ? '<link rel="stylesheet" href="/public/public-header-actions.css">' : '';
    const loginHeaderWhite = pageName === 'login.html' ? '<link rel="stylesheet" href="/public/login-header-white.css"><link rel="stylesheet" href="/public/login-structure-fix.css"><link rel="stylesheet" href="/public/login-security-removal.css">' : '';
    const signupHeaderWhite = pageName === 'associate-signup.html' ? '<link rel="stylesheet" href="/public/signup-header-white.css">' : '';
    const associatePortalContrast = pageName === 'portal-associado.html' ? '<link rel="stylesheet" href="/associado/associate-portal-contrast.css"><link rel="stylesheet" href="/associado/associate-quick-fix.css">' : '';
    const notificationsFix = pageName === 'notificacoes.html' ? '<link rel="stylesheet" href="/associado/notifications-fix.css">' : '';
    const eventsVivid = pageName === 'events-public.html' ? '<link rel="stylesheet" href="/public/events-vivid.css">' : '';
    const sportsPublicFix = pageName === 'sports-public.html' ? '<link rel="stylesheet" href="/public/sports-public-fix.css"><link rel="stylesheet" href="/public/sports-public-agenda.css"><link rel="stylesheet" href="/public/sports-equipment.css">' : '';
    const sportsEquipmentScript = pageName === 'sports-public.html' ? '<script src="/public/sports-equipment.js"></script>' : '';
    const benefitsPublicFix = pageName === 'beneficios.html' ? '<link rel="stylesheet" href="/public/benefits-public-fix.css"><link rel="stylesheet" href="/public/benefits-access.css"><link rel="stylesheet" href="/public/benefits-header-final.css">' : '';
    const associatePages = new Set(['portal-associado.html','agenda.html','carteirinha.html','events-public.html','beneficios.html','notificacoes.html','configuracoes.html','mensalidade.html','modalidade.html','loja.html','indicar.html','cobrancas.html','convocacoes.html']);
    const associateNav = associatePages.has(pageName) ? '<script src="/associado/associate-nav.js"></script>' : '';
    const associateProfile = associatePages.has(pageName) ? '<script src="/associado/associate-profile.js"></script>' : '';
    const birthdayCelebration = associatePages.has(pageName) ? '<link rel="stylesheet" href="/associado/birthday-celebration.css"><script src="/associado/birthday-celebration.js"></script>' : '';
    const associateEventsFix = associatePages.has(pageName) ? '<script src="/associado/associate-events-fix.js"></script>' : '';
    const associateEventsScript = pageName === 'agenda.html' ? '<script src="/associado/associate-events.js"></script>' : '';
    const adminShellScript = internalPages.has(pageName) ? '<script src="/shared/admin-shell.js"></script>' : '';
    // Páginas internas (gestão) têm design system próprio (admin.css) e não usam a
    // pilha de patches !important do site público/associado (theme.css/navigation-fix.css/brand-assets.css).
    const legacyGlobalCss = internalPages.has(pageName) ? '' : '<link rel="stylesheet" href="/shared/theme.css"><link rel="stylesheet" href="/shared/navigation-fix.css">';
    const legacyBrandCss = internalPages.has(pageName) ? '' : '<link rel="stylesheet" href="/shared/brand-assets.css">';
    let pageMarkup = contents.toString().replace('</head>', `${legacyGlobalCss}${homeReference}${eventsVivid}${sportsPublicFix}${benefitsPublicFix}${publicHeaderActions}${loginHeaderWhite}${signupHeaderWhite}${associatePortalContrast}${notificationsFix}${adminLink}${birthdayCelebration}${legacyBrandCss}</head>`).replace('</header>', `${publicJoin}</header>`).replace('</body>', `${sportsEquipmentScript}${associateNav}${associateProfile}${associateEventsFix}${associateEventsScript}${adminShellScript}<script src="/shared/api-bridge.js"></script></body>`);
    contents = Buffer.from(pageMarkup);
  }
  send(res, 200, contents, contentType);
});
server.listen(port, () => console.log(`COMPEX disponÃ­vel em http://localhost:${port}`));
