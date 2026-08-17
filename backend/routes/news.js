const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { hasPermission } = require('../lib/permissions');
const { logAudit } = require('../lib/audit');
const { notify } = require('../lib/notify');

const TYPES = new Set(['NOTICIA', 'COMUNICADO', 'NOVIDADE', 'RESULTADO', 'EVENTO', 'CAMPANHA', 'CHAMADA', 'AVISO_IMPORTANTE']);
const CHANNELS = new Set(['HOME', 'PORTAL', 'GESTAO']);

const mapNews = n => ({
  ...n,
  publishAt: n.publishAt ? n.publishAt.toISOString() : null,
  expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

function slugify(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(title) {
  const base = slugify(title) || 'noticia';
  let slug = base;
  let attempt = 1;
  while (await prisma.news.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

// Rotas públicas (sem sessão): usadas pela Home e pelo Portal do Associado.
async function handlePublicNews(url, req, res) {
  if (req.method !== 'GET') return false;
  const match = url.pathname.match(/^\/api\/public-news(?:\/([a-z0-9-]+))?$/);
  if (!match) return false;
  if (!prisma) { send(res, 200, match[1] ? null : []); return true; }

  const now = new Date();
  const baseWhere = { status: 'PUBLICADO', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  if (match[1]) {
    const item = await prisma.news.findFirst({ where: { slug: match[1], ...baseWhere } });
    send(res, item ? 200 : 404, item ? mapNews(item) : { error: 'Notícia não encontrada' });
    return true;
  }

  const channel = url.searchParams.get('channel'); // 'HOME' | 'PORTAL' | null (qualquer canal público)
  const list = await prisma.news.findMany({
    where: { ...baseWhere, ...(channel ? { channels: { array_contains: channel } } : {}) },
    orderBy: [{ highlighted: 'desc' }, { publishAt: 'desc' }],
  });
  send(res, 200, list.map(mapNews));
  return true;
}

// Rotas administrativas (Marketing/Presidência): CRUD completo + workflow de status.
async function handleNewsRoutes(url, req, res) {
  if (url.pathname !== '/api/news') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }
  if (!hasPermission(session, 'conteudo.criar') && req.method !== 'GET') {
    send(res, 403, { error: 'Você não tem permissão para gerenciar conteúdo.' });
    return true;
  }

  if (req.method === 'GET') {
    if (!hasPermission(session, 'conteudo.criar')) { send(res, 403, { error: 'Você não tem permissão para ver o conteúdo administrativo.' }); return true; }
    const list = await prisma.news.findMany({ orderBy: { createdAt: 'desc' } });
    send(res, 200, list.map(mapNews));
    return true;
  }

  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.title || !item.content) { send(res, 400, { error: 'Informe título e conteúdo.' }); return true; }
      const channels = Array.isArray(item.channels) ? item.channels.filter(c => CHANNELS.has(c)) : [];
      if (!channels.length) { send(res, 400, { error: 'Selecione ao menos um canal de exibição.' }); return true; }
      const slug = await uniqueSlug(item.title);
      const status = item.status === 'PUBLICADO' ? 'PUBLICADO' : (item.status === 'AGENDADO' && item.publishAt ? 'AGENDADO' : 'RASCUNHO');
      const created = await prisma.news.create({
        data: {
          slug, title: item.title, type: TYPES.has(item.type) ? item.type : 'NOTICIA',
          category: item.category || 'Comunicado', summary: item.summary || null, content: item.content,
          imageUrl: item.imageUrl || null, videoUrl: item.videoUrl || null,
          authorName: session.name, department: item.department || null,
          status, highlighted: !!item.highlighted, channels,
          publishAt: item.publishAt ? new Date(item.publishAt) : (status === 'PUBLICADO' ? new Date() : null),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          published: status === 'PUBLICADO',
        },
      });
      await logAudit({ session, action: 'news.create', entity: 'News', entityId: created.id, after: mapNews(created) });
      send(res, 201, mapNews(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.news.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Notícia não encontrada' }); return true; }

      if (item.action) {
        const data = {};
        if (item.action === 'submit_review') {
          if (current.status !== 'RASCUNHO') { send(res, 400, { error: 'Só é possível enviar para revisão a partir de rascunho.' }); return true; }
          data.status = 'EM_REVISAO';
        } else if (item.action === 'schedule') {
          if (!hasPermission(session, 'conteudo.agendar')) { send(res, 403, { error: 'Sem permissão para agendar.' }); return true; }
          if (!item.publishAt) { send(res, 400, { error: 'Informe a data/hora de publicação.' }); return true; }
          data.status = 'AGENDADO';
          data.publishAt = new Date(item.publishAt);
        } else if (item.action === 'publish') {
          if (!hasPermission(session, 'conteudo.publicar')) { send(res, 403, { error: 'Sem permissão para publicar.' }); return true; }
          data.status = 'PUBLICADO';
          data.published = true;
          data.publishAt = current.publishAt || new Date();
        } else if (item.action === 'archive') {
          if (!hasPermission(session, 'conteudo.arquivar')) { send(res, 403, { error: 'Sem permissão para arquivar.' }); return true; }
          data.status = 'ARQUIVADO';
          data.published = false;
        } else { send(res, 400, { error: 'Ação inválida.' }); return true; }

        const updated = await prisma.news.update({ where: { id: item.id }, data });
        await logAudit({ session, action: `news.${item.action}`, entity: 'News', entityId: item.id, before: mapNews(current), after: mapNews(updated) });

        if (item.action === 'publish' && Array.isArray(updated.channels) && updated.channels.includes('GESTAO')) {
          notify({ email: session.email, title: 'Comunicado publicado', message: updated.title, kind: 'INFORMATIVA', link: '/gestao/comunicacao' }).catch(() => {});
        }

        send(res, 200, mapNews(updated));
        return true;
      }

      // Edição livre de campos — só antes de publicar. Depois disso, qualquer mudança de
      // conteúdo tem que passar por uma ação explícita (publish/archive/schedule), preservando
      // o que já foi divulgado publicamente.
      if (!['RASCUNHO', 'EM_REVISAO'].includes(current.status)) {
        send(res, 400, { error: 'Só é possível editar o conteúdo enquanto estiver em rascunho ou revisão.' });
        return true;
      }
      const data = {};
      if (item.title !== undefined) data.title = item.title;
      if (item.type !== undefined && TYPES.has(item.type)) data.type = item.type;
      if (item.category !== undefined) data.category = item.category;
      if (item.summary !== undefined) data.summary = item.summary || null;
      if (item.content !== undefined) data.content = item.content;
      if (item.imageUrl !== undefined) data.imageUrl = item.imageUrl || null;
      if (item.videoUrl !== undefined) data.videoUrl = item.videoUrl || null;
      if (item.department !== undefined) data.department = item.department || null;
      if (item.highlighted !== undefined) data.highlighted = !!item.highlighted;
      if (item.channels !== undefined) {
        const channels = Array.isArray(item.channels) ? item.channels.filter(c => CHANNELS.has(c)) : [];
        if (!channels.length) { send(res, 400, { error: 'Selecione ao menos um canal de exibição.' }); return true; }
        data.channels = channels;
      }
      if (item.expiresAt !== undefined) data.expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
      const updated = await prisma.news.update({ where: { id: item.id }, data });
      await logAudit({ session, action: 'news.update', entity: 'News', entityId: item.id, before: mapNews(current), after: mapNews(updated) });
      send(res, 200, mapNews(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'DELETE') {
    try {
      const item = await body(req);
      const current = await prisma.news.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Notícia não encontrada' }); return true; }
      if (!['RASCUNHO', 'ARQUIVADO'].includes(current.status)) {
        send(res, 400, { error: 'Só é possível excluir rascunhos ou conteúdo arquivado.' });
        return true;
      }
      await prisma.news.delete({ where: { id: item.id } });
      await logAudit({ session, action: 'news.delete', entity: 'News', entityId: item.id, before: mapNews(current) });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Informe o id da notícia' }); }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

module.exports = { handleNewsRoutes, handlePublicNews };
