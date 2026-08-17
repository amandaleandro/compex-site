const fs = require('fs');
const path = require('path');
const { prisma } = require('../db');
const { send } = require('../lib/http');
const { resolveSession, bearerToken, parseCookies } = require('../lib/sessions');
const { uploadsDir, mime, INTERNAL_ROLES } = require('../lib/constants');

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

module.exports = { serveUpload };
