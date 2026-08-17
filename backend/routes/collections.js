const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const Busboy = require('busboy');
const { prisma } = require('../db');
const { uploadsDir, patrimonioDocsDir } = require('../lib/constants');
const { readData, writeData, send, body } = require('../lib/http');
const { resolveSession, bearerToken, canManageAccounts, canManagePlans } = require('../lib/sessions');
const { INTERNAL_ROLES } = require('../lib/constants');
const { teamSlotWeight, chargeSessionParticipants, computeFinanceOverview, createAttendanceCalls } = require('../lib/finance');
const { transactionCreateSchema, transactionUpdateSchema, validate, IMAGE_MIME_TYPES, NEWS_MEDIA_MIME_TYPES, isAllowedMime } = require('../lib/validation');
const { normalizeCpf, isValidCpf } = require('../lib/cpf');
const { logAudit } = require('../lib/audit');
const { resolvePendency } = require('../lib/notify');

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
  if (url.pathname === '/api/news/upload' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const newsMediaDir = path.join(uploadsDir, 'news');
    if (!fs.existsSync(newsMediaDir)) fs.mkdirSync(newsMediaDir, { recursive: true });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      if (!isAllowedMime(info.mimeType, NEWS_MEDIA_MIME_TYPES)) {
        fileError = 'Tipo de arquivo não permitido. Envie uma imagem (png/jpg/webp) ou vídeo (mp4/webm/mov/ogg).';
        stream.resume();
        return;
      }
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
    const productPhotosDir = path.join(uploadsDir, 'products');
    if (!fs.existsSync(productPhotosDir)) fs.mkdirSync(productPhotosDir, { recursive: true });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      if (!isAllowedMime(info.mimeType, IMAGE_MIME_TYPES)) {
        fileError = 'Tipo de arquivo não permitido. Envie uma imagem png, jpg ou webp.';
        stream.resume();
        return;
      }
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
  if (url.pathname === '/api/championships/upload-logo' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const logosDir = path.join(uploadsDir, 'championships');
    if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      if (!isAllowedMime(info.mimeType, IMAGE_MIME_TYPES)) {
        fileError = 'Tipo de arquivo não permitido. Envie uma imagem png, jpg ou webp.';
        stream.resume();
        return;
      }
      const extension = (path.extname(info.filename || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
      const safeName = `opponent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
      const destination = path.join(logosDir, safeName);
      stream.pipe(fs.createWriteStream(destination));
      stream.on('limit', () => { fileError = 'A imagem deve ter no máximo 5 MB'; });
      savedPath = safeName;
    });
    busboy.on('finish', () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhuma imagem enviada' });
      return send(res, 200, { url: `/uploads/championships/${savedPath}` });
    });
    return req.pipe(busboy);
  }
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
    if (req.method === 'GET') {
      const session = resolveSession(bearerToken(req));
      const canSeeFinancials = !!session && INTERNAL_ROLES.has(session.role);
      return send(res, 200, (await prisma.event.findMany({ orderBy: { createdAt: 'desc' } })).map(event => {
        const link = event.ticketUrl || event.boraFestUrl || '';
        const revenue = event.revenue ? Number(event.revenue) : 0;
        const expenses = event.expenses ? Number(event.expenses) : 0;
        const profit = revenue - expenses;
        const base = {
          ...event,
          date: event.date.toISOString(),
          platform: event.platform || 'BORAFEST',
          ticketUrl: link,
          link: link,
          boraFestUrl: event.boraFestUrl || link,
          isOwnOrganization: event.isOwnOrganization !== false,
        };
        if (!canSeeFinancials) {
          delete base.revenue;
          delete base.expenses;
          delete base.financialNotes;
          return base;
        }
        return { ...base, revenue, expenses, profit, financialNotes: event.financialNotes || '' };
      }));
    }
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
    const mapTransaction = item => ({ ...item, amount: Number(item.amount), type: item.type === 'INCOME' ? 'income' : 'expense', dueDate: item.dueDate ? item.dueDate.toISOString() : null });
    if (req.method === 'GET') return send(res, 200, (await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } })).map(mapTransaction));
    if (req.method === 'POST') return body(req).then(async item => {
      const check = validate(transactionCreateSchema, item);
      if (!check.ok) return send(res, 400, { error: check.message });
      const valid = check.data;
      const transaction = await prisma.transaction.create({
        data: {
          description: valid.description, amount: valid.amount, type: valid.type === 'income' ? 'INCOME' : 'EXPENSE', category: valid.category || 'Operação',
          status: valid.status || 'PAID', dueDate: valid.dueDate ? new Date(valid.dueDate) : null, favorecido: valid.favorecido || null,
          paymentMethod: valid.paymentMethod || null, responsibleName: valid.responsibleName || null, proofUrl: valid.proofUrl || null, requestId: valid.requestId || null,
        },
      });
      const mapped = mapTransaction(transaction);
      logAudit({ session: resolveSession(bearerToken(req)), action: 'transaction.create', entity: 'Transaction', entityId: transaction.id, after: mapped });
      send(res, 201, mapped);
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const check = validate(transactionUpdateSchema, item);
      if (!check.ok) return send(res, 400, { error: check.message });
      const valid = check.data;
      const before = await prisma.transaction.findUnique({ where: { id: valid.id } });
      if (valid.status === 'PAID' && before?.status !== 'PAID' && !valid.proofUrl && !before?.proofUrl) {
        return send(res, 400, { error: 'Anexe o comprovante antes de marcar como pago.' });
      }
      const data = {};
      if (valid.description !== undefined) data.description = valid.description;
      if (valid.amount !== undefined) data.amount = valid.amount;
      if (valid.category !== undefined) data.category = valid.category;
      if (valid.type !== undefined) data.type = valid.type === 'income' ? 'INCOME' : 'EXPENSE';
      if (valid.status !== undefined) data.status = valid.status;
      if (valid.dueDate !== undefined) data.dueDate = new Date(valid.dueDate);
      if (valid.favorecido !== undefined) data.favorecido = valid.favorecido;
      if (valid.paymentMethod !== undefined) data.paymentMethod = valid.paymentMethod;
      if (valid.responsibleName !== undefined) data.responsibleName = valid.responsibleName;
      if (valid.proofUrl !== undefined) data.proofUrl = valid.proofUrl;
      const transaction = await prisma.transaction.update({ where: { id: valid.id }, data });
      const mapped = mapTransaction(transaction);
      logAudit({ session: resolveSession(bearerToken(req)), action: 'transaction.update', entity: 'Transaction', entityId: transaction.id, before: before ? mapTransaction(before) : null, after: mapped });
      send(res, 200, mapped);
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => {
      const removed = await prisma.transaction.delete({ where: { id: item.id } });
      logAudit({ session: resolveSession(bearerToken(req)), action: 'transaction.delete', entity: 'Transaction', entityId: item.id, before: { ...removed, amount: Number(removed.amount) } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
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
    const planSession = resolveSession(bearerToken(req));
    const isPlanManager = canManagePlans(planSession);
    if (req.method === 'GET') {
      const plans = await prisma.plan.findMany({
        where: isPlanManager ? undefined : { active: true },
        orderBy: { createdAt: 'asc' },
        include: isPlanManager ? { _count: { select: { members: true } } } : undefined,
      });
      return send(res, 200, plans.map(item => ({
        ...item,
        memberCount: isPlanManager ? item._count.members : undefined,
        _count: undefined,
        updatedAt: item.updatedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })));
    }
    if (req.method === 'POST') {
      if (!isPlanManager) return send(res, 403, { error: 'Somente Presidência ou Financeiro podem cadastrar planos.' });
      return body(req).then(async item => {
        const priceCents = Math.round(Number(item.priceCents));
        if (!item.name || !Number.isFinite(priceCents) || priceCents < 0) return send(res, 400, { error: 'Informe nome e valor (priceCents) válidos.' });
        const plan = await prisma.plan.create({
          data: {
            name: item.name,
            price: item.price !== undefined ? String(item.price) : (priceCents / 100).toFixed(2),
            priceCents,
            period: item.period || '/ano',
            periodicity: item.periodicity || 'ANUAL',
            durationMonths: item.durationMonths !== undefined ? Number(item.durationMonths) : 12,
            slots: item.slots !== undefined ? Number(item.slots) : 1,
            icon: item.icon || null,
            description: item.description || null,
            benefits: item.benefits !== undefined ? item.benefits : undefined,
            active: item.active !== undefined ? Boolean(item.active) : true,
          },
        });
        logAudit({ session: planSession, action: 'plan.create', entity: 'Plan', entityId: plan.id, after: plan });
        send(res, 201, { ...plan, updatedAt: plan.updatedAt.toISOString(), createdAt: plan.createdAt.toISOString() });
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
    if (req.method === 'PUT') {
      if (!isPlanManager) return send(res, 403, { error: 'Somente Presidência ou Financeiro podem editar planos.' });
      return body(req).then(async item => {
        const before = await prisma.plan.findUnique({ where: { id: item.id } });
        const data = {};
        if (item.name !== undefined) data.name = item.name;
        if (item.price !== undefined) data.price = item.price;
        if (item.priceCents !== undefined) data.priceCents = Math.round(Number(item.priceCents));
        if (item.period !== undefined) data.period = item.period;
        if (item.periodicity !== undefined) data.periodicity = item.periodicity;
        if (item.durationMonths !== undefined) data.durationMonths = Number(item.durationMonths);
        if (item.slots !== undefined) data.slots = Number(item.slots);
        if (item.icon !== undefined) data.icon = item.icon || null;
        if (item.description !== undefined) data.description = item.description || null;
        if (item.benefits !== undefined) data.benefits = item.benefits;
        if (item.active !== undefined) data.active = Boolean(item.active);
        const plan = await prisma.plan.update({ where: { id: item.id }, data });
        logAudit({ session: planSession, action: 'plan.update', entity: 'Plan', entityId: plan.id, before, after: plan });
        send(res, 200, { ...plan, updatedAt: plan.updatedAt.toISOString(), createdAt: plan.createdAt.toISOString() });
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Registro não encontrado' }); });
    }
    if (req.method === 'DELETE') {
      if (!isPlanManager) return send(res, 403, { error: 'Somente Presidência ou Financeiro podem desativar planos.' });
      // Nunca apagar fisicamente: planos podem ter sócios/pagamentos vinculados. Exclusão real
      // só é permitida se não houver nenhum sócio referenciando o plano (planId).
      return body(req).then(async item => {
        const linked = await prisma.member.count({ where: { planId: item.id } });
        if (linked > 0) {
          const plan = await prisma.plan.update({ where: { id: item.id }, data: { active: false } });
          logAudit({ session: planSession, action: 'plan.deactivate', entity: 'Plan', entityId: plan.id, after: plan });
          return send(res, 200, { ...plan, updatedAt: plan.updatedAt.toISOString(), createdAt: plan.createdAt.toISOString(), deactivatedInstead: true });
        }
        await prisma.plan.delete({ where: { id: item.id } });
        logAudit({ session: planSession, action: 'plan.delete', entity: 'Plan', entityId: item.id });
        send(res, 200, { ok: true });
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Informe o id do registro' }); });
    }
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
      const name = String(item.name || '').trim();
      const email = String(item.email || '').trim().toLowerCase();
      const registration = String(item.registration || '').trim();
      const cpf = normalizeCpf(item.cpf);
      if (!name || !email || !item.password || !item.course || !registration || !cpf) {
        return send(res, 400, { error: 'Preencha nome, e-mail, curso, matrícula, CPF e senha.' });
      }
      if (!isValidCpf(cpf)) return send(res, 400, { error: 'Informe um CPF válido.' });
      if (String(item.password).length < 8) return send(res, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
      const [emailInUse, registrationInUse, cpfInUse] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        prisma.member.findUnique({ where: { registration }, select: { id: true } }),
        prisma.member.findUnique({ where: { cpf }, select: { id: true } }),
      ]);
      if (emailInUse) return send(res, 409, { error: 'Este e-mail já possui uma conta. Entre no portal ou use outro e-mail.' });
      if (registrationInUse) return send(res, 409, { error: 'Esta matrícula já está vinculada a uma conta.' });
      if (cpfInUse) return send(res, 409, { error: 'Este CPF já está vinculado a uma conta.' });
      const referrer = item.referralCode ? await prisma.member.findUnique({ where: { referralCode: item.referralCode } }) : null;
      const isAvulso = item.membershipKind === 'AVULSO';
      const chosenPlan = !isAvulso && item.planId ? await prisma.plan.findFirst({ where: { id: item.planId, active: true } }) : null;
      if (!isAvulso && item.planId && !chosenPlan) return send(res, 400, { error: 'Este plano não está disponível.' });
      const hashed = await bcrypt.hash(String(item.password), 10);
      const user = await prisma.user.create({ data: { name, email, password: hashed, role: 'ASSOCIADO', member: { create: {
        course: item.course, registration, cpf, socialName: String(item.socialName || '').trim() || null, nickname: String(item.nickname || '').trim() || null,
        plan: isAvulso ? 'Avulso' : (chosenPlan ? chosenPlan.name : (item.plan || 'Anual')),
        planId: chosenPlan ? chosenPlan.id : undefined,
        sex: item.sex || null, birthDate: item.birthDate ? new Date(item.birthDate) : null,
        phone: item.phone || null,
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
        const before = await prisma.member.findUnique({ where: { id: item.id }, include: { user: true } });
        const member = await prisma.member.update({ where: { id: item.id }, data, include: { user: true } });
        const mapped = { id: member.id, name: member.user.name, email: member.user.email, course: member.course, plan: member.plan, status: member.status.toLowerCase(), sportSlots: member.sportSlots };
        logAudit({
          session, action: 'member.update', entity: 'Member', entityId: member.id,
          before: before ? { name: before.user.name, email: before.user.email, course: before.course, plan: before.plan, status: before.status.toLowerCase(), sportSlots: before.sportSlots } : null,
          after: mapped,
        });
        send(res, 200, mapped);
      }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    }
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
  if (name === 'championships') {
    if (req.method === 'GET') return send(res, 200, (await prisma.championship.findMany({ orderBy: { createdAt: 'desc' }, include: { games: { orderBy: { date: 'asc' } } } })).map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), games: c.games.map(g => ({ ...g, date: g.date.toISOString(), createdAt: g.createdAt.toISOString() })) })));
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'POST') return body(req).then(async item => {
      const c = await prisma.championship.create({ data: { name: item.name, sport: item.sport, season: item.season || null, status: ['EM_ANDAMENTO', 'FINALIZADO', 'PROXIMO'].includes(item.status) ? item.status : 'EM_ANDAMENTO', placement: item.placement || null, isTitle: !!item.isTitle, notes: item.notes || null } });
      send(res, 201, { ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), games: [] });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const c = await prisma.championship.update({ where: { id: item.id }, data: { name: item.name, sport: item.sport, season: item.season || null, status: ['EM_ANDAMENTO', 'FINALIZADO', 'PROXIMO'].includes(item.status) ? item.status : 'EM_ANDAMENTO', placement: item.placement || null, isTitle: !!item.isTitle, notes: item.notes || null } });
      send(res, 200, { ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.championship.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'championship-games') {
    if (req.method === 'GET') return send(res, 200, (await prisma.championshipGame.findMany({ orderBy: { date: 'asc' } })).map(g => ({ ...g, date: g.date.toISOString(), createdAt: g.createdAt.toISOString() })));
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    if (req.method === 'POST') return body(req).then(async item => {
      const g = await prisma.championshipGame.create({ data: { championshipId: item.championshipId, opponentName: item.opponentName, opponentLogoUrl: item.opponentLogoUrl || null, date: new Date(item.date), location: item.location || null, status: item.status === 'REALIZADO' ? 'REALIZADO' : 'AGENDADO', ourScore: item.ourScore === '' || item.ourScore === undefined || item.ourScore === null ? null : Number(item.ourScore), opponentScore: item.opponentScore === '' || item.opponentScore === undefined || item.opponentScore === null ? null : Number(item.opponentScore), notes: item.notes || null } });
      send(res, 201, { ...g, date: g.date.toISOString(), createdAt: g.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const g = await prisma.championshipGame.update({ where: { id: item.id }, data: { opponentName: item.opponentName, opponentLogoUrl: item.opponentLogoUrl || null, date: new Date(item.date), location: item.location || null, status: item.status === 'REALIZADO' ? 'REALIZADO' : 'AGENDADO', ourScore: item.ourScore === '' || item.ourScore === undefined || item.ourScore === null ? null : Number(item.ourScore), opponentScore: item.opponentScore === '' || item.opponentScore === undefined || item.opponentScore === null ? null : Number(item.opponentScore), notes: item.notes || null } });
      send(res, 200, { ...g, date: g.date.toISOString(), createdAt: g.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.championshipGame.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
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
    const mapSession = s => ({ id: s.id, teamId: s.teamId, teamName: s.team.name, type: s.type, date: s.date.toISOString(), location: s.location, coachName: s.coachName, coachCost: s.coachCost === null ? null : Number(s.coachCost), refereeName: s.refereeName, refereePixKey: s.refereePixKey, refereeCost: s.refereeCost === null ? null : Number(s.refereeCost), notes: s.notes, published: s.published, createdAt: s.createdAt.toISOString() });
    if (req.method === 'GET') {
      const teamId = new URL(req.url, 'http://internal').searchParams.get('teamId');
      const sessions = await prisma.teamSession.findMany({ where: teamId ? { teamId } : undefined, include: { team: true }, orderBy: { date: 'desc' } });
      return send(res, 200, sessions.map(mapSession));
    }
    if (req.method === 'POST') return body(req).then(async item => {
      const type = item.type === 'JOGO' ? 'JOGO' : 'TREINO';
      // Jogo nasce não publicado por padrão — a gestão monta a convocação antes de anunciar.
      // Treino continua sempre visível (é a convocação automática de todo mundo vinculado).
      const published = type === 'TREINO' ? true : item.published === true;
      const created = await prisma.teamSession.create({ data: {
        teamId: item.teamId, type, date: new Date(`${String(item.date).slice(0, 10)}T12:00:00`), location: item.location || null,
        coachName: item.coachName || null, coachCost: item.coachCost === '' || item.coachCost === undefined || item.coachCost === null ? null : Number(item.coachCost),
        refereeName: item.refereeName || null, refereePixKey: item.refereePixKey || null, refereeCost: item.refereeCost === '' || item.refereeCost === undefined || item.refereeCost === null ? null : Number(item.refereeCost),
        notes: item.notes || null, published,
      }, include: { team: true } });
      chargeSessionParticipants(created).catch(error => console.error('Erro ao gerar cobranças da sessão:', error.message));
      send(res, 201, mapSession(created));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'PUT') return body(req).then(async item => {
      const data = {
        coachName: item.coachName || null, coachCost: item.coachCost === '' || item.coachCost === undefined || item.coachCost === null ? null : Number(item.coachCost),
        refereeName: item.refereeName || null, refereePixKey: item.refereePixKey || null, refereeCost: item.refereeCost === '' || item.refereeCost === undefined || item.refereeCost === null ? null : Number(item.refereeCost),
        notes: item.notes || null,
      };
      if (item.type !== undefined) data.type = item.type === 'JOGO' ? 'JOGO' : 'TREINO';
      if (item.date !== undefined) data.date = new Date(`${String(item.date).slice(0, 10)}T12:00:00`);
      if (item.location !== undefined) data.location = item.location || null;
      let publishing = false;
      if (item.published !== undefined) {
        const before = await prisma.teamSession.findUnique({ where: { id: item.id } });
        publishing = before && !before.published && item.published === true;
        data.published = !!item.published;
      }
      const updated = await prisma.teamSession.update({ where: { id: item.id }, data, include: { team: true } });
      if (publishing) {
        const enrollments = await prisma.teamEnrollment.findMany({ where: { teamId: updated.teamId }, include: { member: { include: { user: true } } } });
        await createAttendanceCalls(updated, enrollments);
      }
      send(res, 200, mapSession(updated));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.teamSession.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (name === 'session-attendances') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' });
    const mapAttendance = a => ({ id: a.id, sessionId: a.sessionId, memberId: a.memberId, memberName: a.member.user.name, status: a.status, createdAt: a.createdAt.toISOString(), respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null });
    if (req.method === 'GET') {
      const sessionId = new URL(req.url, 'http://internal').searchParams.get('sessionId');
      if (!sessionId) return send(res, 400, { error: 'Informe o treino/jogo.' });
      const attendances = await prisma.sessionAttendance.findMany({ where: { sessionId }, include: { member: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
      return send(res, 200, attendances.map(mapAttendance));
    }
    if (req.method === 'POST') return body(req).then(async item => {
      if (!item.sessionId || !item.memberId) return send(res, 400, { error: 'Informe o treino/jogo e o sócio.' });
      const [teamSession, enrollment] = await Promise.all([
        prisma.teamSession.findUnique({ where: { id: item.sessionId } }),
        prisma.teamEnrollment.findFirst({ where: { memberId: item.memberId, status: 'APPROVED' } }),
      ]);
      if (!teamSession) return send(res, 404, { error: 'Treino/jogo não encontrado.' });
      if (!enrollment) return send(res, 400, { error: 'Este sócio não está vinculado a nenhuma modalidade aprovada.' });
      const created = await prisma.sessionAttendance.upsert({
        where: { sessionId_memberId: { sessionId: item.sessionId, memberId: item.memberId } },
        update: {},
        create: { sessionId: item.sessionId, memberId: item.memberId, status: 'PENDING' },
        include: { member: { include: { user: true } } },
      });
      send(res, 201, mapAttendance(created));
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    if (req.method === 'DELETE') return body(req).then(async item => { await prisma.sessionAttendance.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
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
      if (item.status === 'done') await resolvePendency({ entity: 'Task', entityId: item.id });
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
