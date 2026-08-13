const { URL } = require('url');
const QRCode = require('qrcode');
const { send } = require('./lib/http');
const { resolveSession, bearerToken } = require('./lib/sessions');
const { handleAssociateRoute } = require('./associate');
const { handleGestaoRoutes } = require('./routes/gestao');
const { databaseCollection } = require('./routes/collections');
const { serveUpload, servePage } = require('./routes/static');

// Reproduz, na mesma ordem, o dispatch original de server.js: health/qr → rotas de
// gestão (auth/diretoria/enquetes/mural/checkins/stats/uploads) → rotas de associado
// (teams/products/me/checkout/webhooks) → coleções via Prisma (/api/*) → uploads
// estáticos → páginas HTML do frontend.
async function requestHandler(req, res) {
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

  const handled = await handleGestaoRoutes(url, req, res);
  if (handled) return;

  const associateRoutes = ['/api/teams', '/api/products', '/api/me/', '/api/checkout/', '/api/webhooks/mercadopago'];
  if (associateRoutes.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix)) || /^\/api\/teams\/[^/]+\/enroll$/.test(url.pathname)) {
    req.associateSession = resolveSession(bearerToken(req));
    return handleAssociateRoute(url.pathname, req, res).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  }
  if (url.pathname.startsWith('/api/')) return databaseCollection(url.pathname.split('/')[2], req, res, url).catch(error => { console.error('[api]', error); return send(res, 500, { error: 'Erro ao processar a solicitação.' }); });
  if (url.pathname.startsWith('/uploads/') && req.method === 'GET') return serveUpload(req, res, url);
  return servePage(req, res, url);
}

module.exports = { requestHandler };
