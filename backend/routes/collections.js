const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const Busboy = require('busboy');
const { prisma } = require('../db');
const { uploadsDir, patrimonioDocsDir } = require('../lib/constants');
const { readData, writeData, send, body } = require('../lib/http');
const { resolveSession, bearerToken, canManageAccounts } = require('../lib/sessions');
const { INTERNAL_ROLES } = require('../lib/constants');
const { teamSlotWeight, chargeSessionParticipants, computeFinanceOverview } = require('../lib/finance');

function collection(name, req, res) {
  const data = readData();
  if (!data[name]) return send(res, 404, { error: 'ColeÃ§Ã£o nÃ£o encontrada' });
  if (req.method === 'GET') return send(res, 200, data[name]);
  if (req.method === 'POST') return body(req).then(item => { const record = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...item }; data[name].unshift(record); writeData(data); send(res, 201, record); }).catch(() => send(res, 400, { error: 'JSON invÃ¡lido' }));
  if (req.method === 'PUT') return body(req).then(item => { const index = data[name].findIndex(record => record.id === item.id); if (index < 0) return send(res, 404, { error: 'Registro nÃ£o encontrado' }); data[name][index] = { ...data[name][index], ...item, updatedAt: new Date().toISOString() }; writeData(data); send(res, 200, data[name][index]); }).catch(() => send(res, 400, { error: 'Informe o registro para atualizar' }));
  if (req.method === 'DELETE') return body(req).then(item => { const index = data[name].findIndex(record => record.id === item.id); if (index < 0) return send(res, 404, { error: 'Registro nÃ£o encontrado' }); const [removed] = data[name].splice(index, 1); writeData(data); send(res, 200, removed); }).catch(() => send(res, 400, { error: 'Informe o id do registro' }));
  send(res, 405, { error: 'MÃ©todo nÃ£o permitido' });
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
  if (name === 'benefits') {
    if (req.method === 'GET') return send(res, 200, (await prisma.benefit.findMany({ orderBy: { createdAt: 'asc' } })).map(item => ({ ...item, updatedAt: item.updatedAt.toISOString(), createdAt: item.createdAt.toISOString() })));
    if (req.method === 'POST') return body(req).then(async item => {
      const benefit = await prisma.benefit.create({ data: { name: item.name, category: item.category, discount: item.discount, description: item.description || null, icon: item.icon || null } });
      send(res, 201, { ...benefit, updatedAt: benefit.updatedAt.toISOString(), createdAt: benefit.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const data = {};
      if (item.name !== undefined) data.name = item.name;
      if (item.category !== undefined) data.category = item.category;
      if (item.discount !== undefined) data.discount = item.discount;
      if (item.description !== undefined) data.description = item.description || null;
      if (item.icon !== undefined) data.icon = item.icon || null;
      const benefit = await prisma.benefit.update({ where: { id: item.id }, data });
      send(res, 200, { ...benefit, updatedAt: benefit.updatedAt.toISOString(), createdAt: benefit.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Registro não encontrado' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.benefit.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Informe o id do registro' }); });
  }
  if (name === 'plans') {
    if (req.method === 'GET') return send(res, 200, (await prisma.plan.findMany({ orderBy: { createdAt: 'asc' } })).map(item => ({ ...item, updatedAt: item.updatedAt.toISOString(), createdAt: item.createdAt.toISOString() })));
    if (req.method === 'POST') return body(req).then(async item => {
      const plan = await prisma.plan.create({ data: { name: item.name, price: item.price, period: item.period || '/ano', slots: item.slots !== undefined ? Number(item.slots) : 1, icon: item.icon || null, description: item.description || null } });
      send(res, 201, { ...plan, updatedAt: plan.updatedAt.toISOString(), createdAt: plan.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const data = {};
      if (item.name !== undefined) data.name = item.name;
      if (item.price !== undefined) data.price = item.price;
      if (item.period !== undefined) data.period = item.period;
      if (item.slots !== undefined) data.slots = Number(item.slots);
      if (item.icon !== undefined) data.icon = item.icon || null;
      if (item.description !== undefined) data.description = item.description || null;
      const plan = await prisma.plan.update({ where: { id: item.id }, data });
      send(res, 200, { ...plan, updatedAt: plan.updatedAt.toISOString(), createdAt: plan.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Registro não encontrado' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.plan.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Informe o id do registro' }); });
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

module.exports = { collection, databaseCollection };
