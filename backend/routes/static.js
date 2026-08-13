const fs = require('fs');
const path = require('path');
const { prisma } = require('../db');
const { send } = require('../lib/http');
const { resolveSession, bearerToken, parseCookies } = require('../lib/sessions');
const { root, uploadsDir, mime, INTERNAL_ROLES, PAGE_ROLES } = require('../lib/constants');

// GET /uploads/* — arquivos enviados via busboy (documentos, fotos, etc). Documentos
// privados (isPublic=false no Prisma) exigem sessão de diretoria.
async function serveUpload(req, res, url) {
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

// Serve páginas estáticas do frontend, injetando CSS/JS por nome de arquivo (ver
// server-injects-css-by-pagename na memória) e checando role-gating de páginas internas
// (gestão) via cookie de sessão.
function servePage(req, res, url) {
  let requested = url.pathname === '/' ? '/public/index.html' : url.pathname;
  const file = path.normalize(path.join(root, requested));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'PÃ¡gina nÃ£o encontrada', 'text/plain; charset=utf-8');
  let contents = fs.readFileSync(file);
  const contentType = mime[path.extname(file)] || 'application/octet-stream';
  if (contentType.startsWith('text/html')) {
    const pageName = path.basename(file);
    const internalPages = new Set(['dashboard.html','portal.html','event-manager.html','finance.html','members.html','sports.html','documents.html','permissions.html','warnings.html','communication.html','tasks.html','sponsors.html','checkin.html','produtos.html','patrimonio.html','associar-se.html','beneficios-gestao.html','campeonatos.html']);
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
    const eventsVivid = pageName === 'events-public.html' ? '<link rel="stylesheet" href="/public/events-vivid.css">' : '';
    const sportsPublicFix = pageName === 'sports-public.html' ? '<link rel="stylesheet" href="/public/sports-public-fix.css"><link rel="stylesheet" href="/public/sports-public-agenda.css"><link rel="stylesheet" href="/public/sports-equipment.css">' : '';
    const sportsEquipmentScript = pageName === 'sports-public.html' ? '<script src="/public/sports-equipment.js"></script>' : '';
    const benefitsPublicFix = pageName === 'beneficios.html' ? '<link rel="stylesheet" href="/public/benefits-public-fix.css"><link rel="stylesheet" href="/public/benefits-access.css"><link rel="stylesheet" href="/public/benefits-header-final.css">' : '';
    const associatePages = new Set(['portal-associado.html','agenda.html','carteirinha.html','events-public.html','beneficios.html','beneficios-associado.html','notificacoes.html','configuracoes.html','mensalidade.html','modalidade.html','loja.html','indicar.html','cobrancas.html','convocacoes.html']);
    const associateNav = associatePages.has(pageName) ? '<script src="/associado/associate-nav.js?v=2"></script>' : '';
    const associateProfile = associatePages.has(pageName) ? '<script src="/associado/associate-profile.js"></script>' : '';
    const birthdayCelebration = associatePages.has(pageName) ? '<link rel="stylesheet" href="/associado/birthday-celebration.css"><script src="/associado/birthday-celebration.js"></script>' : '';
    const associateEventsFix = associatePages.has(pageName) ? '<script src="/associado/associate-events-fix.js"></script>' : '';
    const associateEventsScript = pageName === 'agenda.html' ? '<script src="/associado/associate-events.js"></script>' : '';
    const associatePortalLineFix = associatePages.has(pageName) ? '<link rel="stylesheet" href="/associado/portal-line-fix.css?v=5">' : '';
    const adminShellScript = internalPages.has(pageName) ? '<script src="/shared/admin-shell.js"></script>' : '';
    // Páginas internas (gestão) têm design system próprio (admin.css) e não usam a
    // pilha de patches !important do site público/associado (theme.css/navigation-fix.css/brand-assets.css).
    const responsiveCss = '<link rel="stylesheet" href="/shared/responsive.css">';
    const legacyGlobalCss = internalPages.has(pageName) ? '' : '<link rel="stylesheet" href="/shared/theme.css"><link rel="stylesheet" href="/shared/navigation-fix.css">';
    const legacyBrandCss = internalPages.has(pageName) ? '' : '<link rel="stylesheet" href="/shared/brand-assets.css">';
    let pageMarkup = contents.toString().replace('</head>', `${responsiveCss}${legacyGlobalCss}${homeReference}${eventsVivid}${sportsPublicFix}${benefitsPublicFix}${publicHeaderActions}${loginHeaderWhite}${signupHeaderWhite}${adminLink}${birthdayCelebration}${legacyBrandCss}${associatePortalLineFix}</head>`).replace('</header>', `${publicJoin}</header>`).replace('</body>', `${sportsEquipmentScript}${associateNav}${associateProfile}${associateEventsFix}${associateEventsScript}${adminShellScript}<script src="/shared/api-bridge.js"></script></body>`);
    contents = Buffer.from(pageMarkup);
  }
  send(res, 200, contents, contentType);
}

module.exports = { serveUpload, servePage };
