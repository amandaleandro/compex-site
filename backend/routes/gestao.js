const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Busboy = require('busboy');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken, canManageAccounts, sessions, persistSessions } = require('../lib/sessions');
const { SESSION_TTL_MS, LEGACY_TOKENS, INTERNAL_ROLES, uploadsDir, associatePhotosDir } = require('../lib/constants');
const { computeFinanceOverview } = require('../lib/finance');
const { loginSchema, validate, DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, isAllowedMime } = require('../lib/validation');
const { awardPoints } = require('../lib/gamification');

// Trata as rotas de autenticação, diretoria/advertências, enquetes, mural, check-ins,
// stats/dashboard e uploads de documentos/foto de perfil. Retorna `true` quando a rota
// bateu e a resposta já foi enviada (ou está em andamento); `false` quando nenhuma rota
// bateu, para o router seguir para o próximo grupo de handlers.
async function handleGestaoRoutes(url, req, res) {
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    await body(req).then(async credentials => {
      const check = validate(loginSchema, credentials);
      if (!check.ok) return send(res, 400, { error: check.message });
      const email = check.data.email.toLowerCase();
      const password = check.data.password;
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
    return true;
  }
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!session) { send(res, 401, { authenticated: false, error: 'Sessão inválida' }); return true; }
    let member = null;
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: session.email }, include: { member: true } });
      if (user?.member) member = { status: user.member.status.toLowerCase(), plan: user.member.plan, subscriptionStatus: user.member.subscriptionStatus, membershipKind: user.member.membershipKind };
    }
    send(res, 200, { authenticated: true, user: { name: session.name, role: session.role, rank: session.rank, email: session.email, member } });
    return true;
  }
  if (url.pathname === '/api/me/become-member' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!INTERNAL_ROLES.has(session.role)) { send(res, 403, { error: 'Disponível para contas da diretoria.' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
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
    return true;
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    sessions.delete(bearerToken(req));
    persistSessions();
    res.setHeader('Set-Cookie', 'compex_role=; Path=/; Max-Age=0');
    send(res, 200, { ok: true });
    return true;
  }
  if (url.pathname === '/api/auth/change-password' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (LEGACY_TOKENS[bearerToken(req)]) return send(res, 400, { error: 'Contas de demonstração não podem trocar senha por aqui.' });
      const user = await prisma.user.findUnique({ where: { email: session.email } });
      if (!user || !(await bcrypt.compare(item.currentPassword || '', user.password))) return send(res, 401, { error: 'Senha atual incorreta' });
      if (!item.newPassword || item.newPassword.length < 8) return send(res, 400, { error: 'A nova senha precisa ter ao menos 8 caracteres' });
      await prisma.user.update({ where: { email: session.email }, data: { password: await bcrypt.hash(item.newPassword, 10) } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
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
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 200, []); return true; }
    const where = session.role === 'PRESIDENCIA'
      ? { role: { not: 'ASSOCIADO' }, email: { not: session.email } }
      : { role: session.role, email: { not: session.email } };
    await prisma.user.findMany({ where, orderBy: { createdAt: 'asc' }, include: { member: true } })
      .then(users => send(res, 200, users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, rank: u.rank, phone: u.phone, birthDate: u.birthDate ? u.birthDate.toISOString() : null, member: u.member ? { course: u.member.course, plan: u.member.plan, status: u.member.status.toLowerCase() } : null }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/directors' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
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
        data: { name: item.name, email: (item.email || '').trim().toLowerCase(), password: hashed, role, rank, phone: item.phone || null, birthDate: item.birthDate ? new Date(item.birthDate) : null },
      });
      send(res, 201, { id: user.id, name: user.name, email: user.email, role: user.role, rank: user.rank, phone: user.phone, birthDate: user.birthDate ? user.birthDate.toISOString() : null, member: null });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/directors' && req.method === 'PUT') {
    const session = resolveSession(bearerToken(req));
    if (!session || session.role !== 'PRESIDENCIA') { send(res, 403, { error: 'Acesso restrito à Presidência' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (item.role && !INTERNAL_ROLES.has(item.role)) return send(res, 400, { error: 'Papel inválido' });
      if (item.rank && !['DIRETOR', 'COORDENADOR'].includes(item.rank)) return send(res, 400, { error: 'Nível inválido' });
      if (item.name !== undefined && !item.name.trim()) return send(res, 400, { error: 'Nome não pode ficar vazio' });
      if (item.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) return send(res, 400, { error: 'E-mail inválido' });
      const data = {};
      if (item.name !== undefined) data.name = item.name.trim();
      if (item.email !== undefined) data.email = item.email.trim().toLowerCase();
      if (item.role) data.role = item.role;
      if (item.birthDate !== undefined) data.birthDate = item.birthDate ? new Date(item.birthDate) : null;
      if (item.phone !== undefined) data.phone = item.phone || null;
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
      send(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role, rank: user.rank, phone: user.phone, birthDate: user.birthDate ? user.birthDate.toISOString() : null, member: user.member ? { course: user.member.course, plan: user.member.plan, status: user.member.status.toLowerCase() } : null });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/directors' && req.method === 'DELETE') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (session.role !== 'PRESIDENCIA') {
        const target = await prisma.user.findUnique({ where: { id: item.id } });
        if (!target || target.role !== session.role || target.rank !== 'COORDENADOR') return send(res, 403, { error: 'Só é possível remover coordenadores do seu próprio departamento' });
      }
      await prisma.directorWarning.deleteMany({ where: { userId: item.id } });
      await prisma.user.delete({ where: { id: item.id } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/warnings' && req.method === 'GET') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 200, []); return true; }
    const where = session.role === 'PRESIDENCIA' ? {} : { user: { role: session.role } };
    await prisma.directorWarning.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } })
      .then(rows => send(res, 200, rows.map(w => ({ id: w.id, type: w.type, reason: w.reason, createdAt: w.createdAt.toISOString(), userId: w.userId, userName: w.user.name, userRole: w.user.role }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/warnings' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      const target = await prisma.user.findUnique({ where: { id: item.userId } });
      if (!target) return send(res, 404, { error: 'Conta não encontrada' });
      if (session.role !== 'PRESIDENCIA' && target.role !== session.role) return send(res, 403, { error: 'Só é possível registrar advertências no seu próprio departamento' });
      if (!['ADVERTENCIA', 'SUSPENSAO', 'DESLIGAMENTO'].includes(item.type)) return send(res, 400, { error: 'Tipo inválido' });
      const warning = await prisma.directorWarning.create({ data: { userId: item.userId, type: item.type, reason: item.reason || '' } });
      send(res, 201, { id: warning.id, type: warning.type, reason: warning.reason, createdAt: warning.createdAt.toISOString(), userId: warning.userId, userName: target.name, userRole: target.role });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/warnings' && req.method === 'DELETE') {
    const session = resolveSession(bearerToken(req));
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Acesso restrito à Presidência e diretores' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      await prisma.directorWarning.delete({ where: { id: item.id } });
      send(res, 200, { ok: true });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  const internalSession = req => { const session = resolveSession(bearerToken(req)); return session && INTERNAL_ROLES.has(session.role) ? session : null; };
  // Rotas de /api/polls* foram movidas para routes/polls.js (fluxo completo de status/validação/empate).
  if (url.pathname === '/api/board' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 200, []); return true; }
    const type = url.searchParams.get('type');
    await prisma.boardPost.findMany({ where: type ? { type } : undefined, orderBy: { createdAt: 'desc' }, take: 50 })
      .then(rows => send(res, 200, rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/board' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (!['RECADO', 'ELOGIO'].includes(item.type) || !item.message) return send(res, 400, { error: 'Dados inválidos' });
      const post = await prisma.boardPost.create({ data: { type: item.type, authorName: session.name, message: item.message } });
      send(res, 201, { ...post, createdAt: post.createdAt.toISOString() });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/board' && req.method === 'DELETE') {
    const session = internalSession(req);
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir recados' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => { await prisma.boardPost.delete({ where: { id: item.id } }); send(res, 200, { ok: true }); }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/gamification/points' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    const allowedReasons = new Set(['MENSALIDADE_EM_DIA', 'EVENTO_PRESENCA', 'TREINO_INSCRICAO', 'COMPRA_LOJA', 'ENGAJAMENTO_SOCIAL', 'AJUSTE_ADMINISTRATIVO']);
    await body(req).then(async item => {
      const points = Number(item.points);
      const validAmount = item.reason === 'AJUSTE_ADMINISTRATIVO'
        ? Number.isInteger(points) && points !== 0 && points >= -1000 && points <= 1000
        : Number.isInteger(points) && points >= 1 && points <= 1000;
      if (!item.memberId || !allowedReasons.has(item.reason) || !validAmount || !String(item.note || '').trim()) {
        return send(res, 400, { error: 'Informe sócio, motivo, pontos e descrição válidos.' });
      }
      const entry = await awardPoints(item.memberId, item.reason, points, String(item.note).trim());
      if (!entry) return send(res, 400, { error: 'A pontuação é exclusiva para sócios.' });
      send(res, 201, entry);
    }).catch(error => { console.error('[gamificação]', error); return send(res, 400, { error: 'Não foi possível creditar os pontos.' }); });
    return true;
  }
  if (url.pathname === '/api/checkins' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 200, { event: null, total: 0, recent: [] }); return true; }
    await (async () => {
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
    return true;
  }
  if (url.pathname === '/api/checkins' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (!item.eventId) return send(res, 400, { error: 'Nenhum evento ativo' });
      const code = (item.code || '').trim();
      const qrParts = code.split(':');
      const qrMemberId = qrParts[0] === 'COMPEX' && qrParts[1] ? qrParts[1] : null;
      const member = await prisma.member.findFirst({ where: { OR: [{ registration: code }, { id: code }, ...(qrMemberId ? [{ id: qrMemberId }] : [])] }, include: { user: true } });
      if (!member) return send(res, 404, { error: 'Código não encontrado. Confira a carteirinha do associado.' });
      const existing = await prisma.eventCheckIn.findUnique({ where: { eventId_memberId: { eventId: item.eventId, memberId: member.id } } }).catch(() => null);
      if (existing) return send(res, 200, { alreadyCheckedIn: true, member: { name: member.user.name, course: member.course } });
      await prisma.eventCheckIn.create({ data: { eventId: item.eventId, memberId: member.id } });
      await awardPoints(member.id, 'EVENTO_PRESENCA', 80, `Check-in no evento ${item.eventId}`).catch(error => console.error('[gamificação]', error));
      send(res, 201, { alreadyCheckedIn: false, member: { name: member.user.name, course: member.course } });
    }).catch(error => { console.error('[api]', error); return send(res, 400, { error: 'Erro ao processar a solicitação.' }); });
    return true;
  }
  if (url.pathname === '/api/training-checkins' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!['PRESIDENCIA', 'ESPORTES'].includes(session.role)) { send(res, 403, { error: 'Somente a equipe de Esportes pode validar presença em treinos.' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await (async () => {
      const selectedId = url.searchParams.get('sessionId');
      const sessionsList = await prisma.teamSession.findMany({ where: { type: 'TREINO' }, include: { team: true }, orderBy: { date: 'desc' }, take: 40 });
      const activeTraining = (selectedId ? sessionsList.find(item => item.id === selectedId) : null) || sessionsList[0] || null;
      if (!activeTraining) return send(res, 200, { sessions: [], training: null, total: 0, confirmed: 0, waiting: 0, recent: [] });
      const [checkins, confirmed] = await Promise.all([
        prisma.trainingCheckIn.findMany({ where: { sessionId: activeTraining.id }, include: { member: { include: { user: true } } }, orderBy: { createdAt: 'desc' } }),
        prisma.teamEnrollment.count({ where: { teamId: activeTraining.teamId, status: 'APPROVED' } }),
      ]);
      send(res, 200, {
        sessions: sessionsList.map(item => ({ id: item.id, teamId: item.teamId, teamName: item.team.name, date: item.date.toISOString(), location: item.location })),
        training: { id: activeTraining.id, teamId: activeTraining.teamId, name: activeTraining.team.name, date: activeTraining.date.toISOString(), location: activeTraining.location },
        total: checkins.length,
        confirmed,
        waiting: Math.max(0, confirmed - checkins.length),
        recent: checkins.slice(0, 12).map(item => ({ name: item.member.user.name, course: item.member.course, createdAt: item.createdAt.toISOString(), checkedBy: item.checkedByName })),
      });
    })().catch(error => { console.error('[training-checkin]', error); return send(res, 500, { error: 'Não foi possível carregar o check-in do treino.' }); });
    return true;
  }
  if (url.pathname === '/api/training-checkins' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!['PRESIDENCIA', 'ESPORTES'].includes(session.role)) { send(res, 403, { error: 'Somente a equipe de Esportes pode validar presença em treinos.' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    await body(req).then(async item => {
      if (!item.sessionId) return send(res, 400, { error: 'Selecione o treino antes de ler o QR Code.' });
      const code = String(item.code || '').trim();
      const qrParts = code.split(':');
      const qrMemberId = qrParts[0] === 'COMPEX' && qrParts[1] ? qrParts[1] : null;
      const [training, member] = await Promise.all([
        prisma.teamSession.findFirst({ where: { id: item.sessionId, type: 'TREINO' }, include: { team: true } }),
        prisma.member.findFirst({ where: { OR: [{ registration: code }, { id: code }, ...(qrMemberId ? [{ id: qrMemberId }] : [])] }, include: { user: true } }),
      ]);
      if (!training) return send(res, 404, { error: 'Treino não encontrado.' });
      if (!member) return send(res, 404, { error: 'QR Code não pertence a um associado válido.' });
      const enrollment = await prisma.teamEnrollment.findFirst({ where: { memberId: member.id, teamId: training.teamId, status: 'APPROVED' } });
      if (!enrollment) return send(res, 403, { error: `${member.user.name} não possui participação aprovada em ${training.team.name}.` });
      const existing = await prisma.trainingCheckIn.findUnique({ where: { sessionId_memberId: { sessionId: training.id, memberId: member.id } } });
      if (existing) return send(res, 200, { alreadyCheckedIn: true, pointsAwarded: false, member: { name: member.user.name, course: member.course }, training: { name: training.team.name } });
      await prisma.$transaction([
        prisma.trainingCheckIn.create({ data: { sessionId: training.id, memberId: member.id, checkedByEmail: session.email, checkedByName: session.name } }),
        prisma.sessionAttendance.upsert({ where: { sessionId_memberId: { sessionId: training.id, memberId: member.id } }, update: { status: 'CONFIRMED', respondedAt: new Date() }, create: { sessionId: training.id, memberId: member.id, status: 'CONFIRMED', respondedAt: new Date() } }),
      ]);
      const points = await awardPoints(member.id, 'TREINO_PRESENCA', 50, `Treino ${training.id}`);
      send(res, 201, { alreadyCheckedIn: false, pointsAwarded: !!points, member: { name: member.user.name, course: member.course }, training: { name: training.team.name } });
    }).catch(error => { console.error('[training-checkin]', error); return send(res, 400, { error: 'Não foi possível confirmar a presença no treino.' }); });
    return true;
  }
  if (url.pathname === '/api/stats' && req.method === 'GET' && prisma) {
    await Promise.all([
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
    return true;
  }
  if (url.pathname === '/api/dashboard-extra' && req.method === 'GET') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 200, { birthdays: [], spotlight: null, upcomingGames: [], upcomingTrainings: [], todayTasks: [] }); return true; }
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const roleLabel = { PRESIDENCIA: 'Presidência', FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes', EVENTOS: 'Eventos', MARKETING: 'Marketing' };
    await Promise.all([
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
    return true;
  }
  if (url.pathname === '/api/documents/upload' && req.method === 'POST') {
    const session = internalSession(req);
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    const fields = {};
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 25 * 1024 * 1024 } });
    busboy.on('field', (name, value) => { fields[name] = value; });
    busboy.on('file', (name, stream, info) => {
      if (!isAllowedMime(info.mimeType, DOCUMENT_MIME_TYPES)) {
        fileError = 'Tipo de arquivo não permitido. Envie PDF, Word, Excel, PowerPoint, texto ou imagem.';
        stream.resume();
        return;
      }
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
    req.pipe(busboy);
    return true;
  }
  if (url.pathname === '/api/me/photo' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
    if (!prisma) { send(res, 503, { error: 'Banco de dados indisponível' }); return true; }
    const member = await prisma.member.findFirst({ where: { user: { email: session.email } } });
    if (!member) { send(res, 404, { error: 'Associado não encontrado' }); return true; }
    let savedPath = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      if (!isAllowedMime(info.mimeType, IMAGE_MIME_TYPES)) {
        fileError = 'Tipo de arquivo não permitido. Envie uma imagem png, jpg ou webp.';
        stream.resume();
        return;
      }
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
      const url2 = `/uploads/associates/${savedPath}`;
      await prisma.member.update({ where: { id: member.id }, data: { photoUrl: url2 } });
      return send(res, 200, { url: url2 });
    });
    req.pipe(busboy);
    return true;
  }
  return false;
}

module.exports = { handleGestaoRoutes };
