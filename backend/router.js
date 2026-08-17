const { URL } = require('url');
const QRCode = require('qrcode');
const { send } = require('./lib/http');
const { resolveSession, bearerToken } = require('./lib/sessions');
const { handleAssociateRoute } = require('./associate');
const { handleGestaoRoutes } = require('./routes/gestao');
const { handleRequestRoutes } = require('./routes/requests');
const { handleGestaoInternaRoutes } = require('./routes/gestao-interna');
const { handleScheduleRoutes } = require('./routes/schedules');
const { handlePresidenciaSummary } = require('./routes/presidencia');
const { handleNotificationRoutes } = require('./routes/notifications');
const { handleDepartmentRoutes } = require('./routes/departments');
const { handleAuditLogRoutes } = require('./routes/audit-log');
const { handleNewsRoutes, handlePublicNews } = require('./routes/news');
const { handlePollRoutes } = require('./routes/polls');
const { handleAvailabilityRoutes } = require('./routes/availability');
const { handleMeetingPlanningRoutes } = require('./routes/meeting-planning');
const { handleWhatsAppRoutes } = require('./routes/whatsapp');
const { handleMetricsRoutes } = require('./routes/metrics');
const { databaseCollection } = require('./routes/collections');
const { serveUpload } = require('./routes/static');
const { prisma } = require('./db');

// Reproduz, na mesma ordem, o dispatch original de server.js: health/qr → rotas de
// gestão (auth/diretoria/enquetes/mural/checkins/stats/uploads) → rotas de associado
// (teams/products/me/checkout/webhooks) → coleções via Prisma (/api/*) → uploads
// estáticos. Servir o frontend agora é responsabilidade do Next.js (frontend/public-next).
async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, service: 'compex-portal', time: new Date().toISOString() });
  // Contadores públicos exibidos na home — só o que pode ser mostrado sem autenticação
  // (nada de dados pessoais), calculado a partir do que está de fato cadastrado no sistema.
  if (url.pathname === '/api/public-stats' && req.method === 'GET') {
    if (!prisma) return send(res, 200, { eventsCount: 0, membersCount: 0 });
    return Promise.all([
      prisma.event.count({ where: { published: true } }),
      prisma.member.count({ where: { status: 'ACTIVE' } })
    ]).then(([eventsCount, membersCount]) => send(res, 200, { eventsCount, membersCount }))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  // Agenda pública de jogos/treinos (esportes.html) — só campos que fazem sentido
  // mostrar a um visitante; custo de técnico/árbitro e chave PIX ficam de fora.
  if (url.pathname === '/api/public-agenda' && req.method === 'GET') {
    if (!prisma) return send(res, 200, { games: [], trainings: [] });
    const now = new Date();
    const toPublicSession = (s) => ({ id: s.id, team: s.team.name, sport: s.team.sport, date: s.date.toISOString(), location: s.location || null });
    return Promise.all([
      prisma.teamSession.findMany({ where: { type: 'JOGO', date: { gte: now } }, orderBy: { date: 'asc' }, take: 3, include: { team: true } }),
      prisma.teamSession.findMany({ where: { type: 'TREINO', date: { gte: now } }, orderBy: { date: 'asc' }, take: 3, include: { team: true } })
    ]).then(([games, trainings]) => send(res, 200, { games: games.map(toPublicSession), trainings: trainings.map(toPublicSession) }))
      .catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname === '/api/qr' && req.method === 'GET') return QRCode.toBuffer(url.searchParams.get('text') || 'COMPEX-2026-AS-428', {
    type: 'png',
    width: 512,
    margin: 4,
    errorCorrectionLevel: 'H',
    scale: 8,
    color: { dark: '#081220', light: '#ffffff' }
  }).then(buffer => send(res, 200, buffer, 'image/png')).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });

  const pollsHandled = await handlePollRoutes(url, req, res);
  if (pollsHandled) return;

  const meetingPlanningHandled = await handleMeetingPlanningRoutes(url, req, res);
  if (meetingPlanningHandled) return;

  const whatsappHandled = await handleWhatsAppRoutes(url, req, res);
  if (whatsappHandled) return;

  const metricsHandled = await handleMetricsRoutes(url, req, res);
  if (metricsHandled) return;

  const availabilityHandled = await handleAvailabilityRoutes(url, req, res);
  if (availabilityHandled) return;

  const handled = await handleGestaoRoutes(url, req, res);
  if (handled) return;

  const requestsHandled = await handleRequestRoutes(url, req, res);
  if (requestsHandled) return;

  const gestaoInternaHandled = await handleGestaoInternaRoutes(url, req, res);
  if (gestaoInternaHandled) return;

  const schedulesHandled = await handleScheduleRoutes(url, req, res);
  if (schedulesHandled) return;

  const presidenciaHandled = await handlePresidenciaSummary(url, req, res);
  if (presidenciaHandled) return;

  const notificationsHandled = await handleNotificationRoutes(url, req, res);
  if (notificationsHandled) return;

  const departmentsHandled = await handleDepartmentRoutes(url, req, res);
  if (departmentsHandled) return;

  const auditLogHandled = await handleAuditLogRoutes(url, req, res);
  if (auditLogHandled) return;

  const publicNewsHandled = await handlePublicNews(url, req, res);
  if (publicNewsHandled) return;

  const newsHandled = await handleNewsRoutes(url, req, res);
  if (newsHandled) return;

  const associateRoutes = ['/api/teams', '/api/products', '/api/me/', '/api/checkout/', '/api/webhooks/mercadopago'];
  if (url.pathname !== '/api/products/upload' && (associateRoutes.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix)) || /^\/api\/teams\/[^/]+\/enroll$/.test(url.pathname))) {
    req.associateSession = resolveSession(bearerToken(req));
    return handleAssociateRoute(url.pathname, req, res).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname.startsWith('/api/')) return databaseCollection(url.pathname.split('/')[2], req, res, url).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  if (url.pathname.startsWith('/uploads/') && req.method === 'GET') return serveUpload(req, res, url);
  return send(res, 404, { error: 'Rota não encontrada' });
}

module.exports = { requestHandler };
