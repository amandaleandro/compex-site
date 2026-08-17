const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');
const { prisma } = require('../db');
const { uploadsDir, INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');
const { hasPermission } = require('../lib/permissions');
const { logAudit } = require('../lib/audit');
const { notify } = require('../lib/notify');

const REQUEST_TYPES = new Set([
  'PAGAMENTO_TECNICO', 'PAGAMENTO_ARBITRAGEM', 'COMPRA_MATERIAIS', 'FERRAMENTA_SOFTWARE',
  'CONTRATACAO_FORNECEDOR', 'TRANSPORTE', 'ALIMENTACAO', 'INSCRICAO_CAMPEONATO', 'REEMBOLSO',
  'EVENTO', 'MATERIAL_ESPORTIVO', 'DESPESA_ADMINISTRATIVA', 'OUTRAS_DESPESAS',
]);
const PRIORITIES = new Set(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);
// Tipos que passam pelo fluxo de compras (cotação de fornecedores + confirmação de recebimento).
const PURCHASE_TYPES = new Set(['COMPRA_MATERIAIS', 'MATERIAL_ESPORTIVO', 'FERRAMENTA_SOFTWARE', 'CONTRATACAO_FORNECEDOR']);

const STATUS_LABEL_PT = {
  SOLICITADO: 'solicitada', FINANCEIRO: 'em aprovação do financeiro', PRESIDENCIA: 'em aprovação da presidência',
  APROVADO: 'aprovada', PAGO: 'paga', FINALIZADO: 'finalizada', REJEITADO: 'rejeitada',
};

const TYPE_LABEL_PT = {
  PAGAMENTO_TECNICO: 'Pagamento de técnico', PAGAMENTO_ARBITRAGEM: 'Pagamento de arbitragem',
  COMPRA_MATERIAIS: 'Compra de materiais', FERRAMENTA_SOFTWARE: 'Ferramenta/software',
  CONTRATACAO_FORNECEDOR: 'Contratação de fornecedor', TRANSPORTE: 'Transporte', ALIMENTACAO: 'Alimentação',
  INSCRICAO_CAMPEONATO: 'Inscrição em campeonato', REEMBOLSO: 'Reembolso', EVENTO: 'Evento',
  MATERIAL_ESPORTIVO: 'Material esportivo', DESPESA_ADMINISTRATIVA: 'Despesa administrativa', OUTRAS_DESPESAS: 'Outras despesas',
};

// Fluxo: RASCUNHO -> SOLICITADO -> APROVACAO_DIRETOR -> FINANCEIRO -> PRESIDENCIA -> APROVADO -> PAGO -> FINALIZADO
// (REJEITADO pode acontecer em qualquer etapa de aprovação). Cada transição exige a permissão da etapa.
const TRANSITIONS = {
  submit: { from: ['RASCUNHO'], to: 'SOLICITADO', permission: 'solicitacoes.criar' },
  approve_director: { from: ['SOLICITADO'], to: 'FINANCEIRO', permission: 'solicitacoes.aprovar' },
  approve_finance: { from: ['FINANCEIRO'], to: 'PRESIDENCIA', permission: 'financeiro.aprovar' },
  approve_presidency: { from: ['PRESIDENCIA'], to: 'APROVADO', permission: 'presidencia.aprovar' },
  pay: { from: ['APROVADO'], to: 'PAGO', permission: 'financeiro.pagar', requiresProof: true },
  finalize: { from: ['PAGO'], to: 'FINALIZADO', permission: 'financeiro.pagar' },
  reject: { from: ['SOLICITADO', 'APROVACAO_DIRETOR', 'FINANCEIRO', 'PRESIDENCIA'], to: 'REJEITADO', permission: 'solicitacoes.aprovar' },
};

const mapRequest = r => ({
  ...r,
  valuePlanned: r.valuePlanned === null ? null : Number(r.valuePlanned),
  valueFinal: r.valueFinal === null ? null : Number(r.valueFinal),
  dueDate: r.dueDate ? r.dueDate.toISOString() : null,
  receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

async function handleRequestRoutes(url, req, res) {
  if (url.pathname === '/api/requests/upload' && req.method === 'POST') {
    const session = resolveSession(bearerToken(req));
    if (!session || !INTERNAL_ROLES.has(session.role)) return send(res, 401, { error: 'Autenticação necessária' }), true;
    const dir = path.join(uploadsDir, 'solicitacoes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let savedPath = null;
    let originalName = null;
    let fileError = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
    busboy.on('file', (name, stream, info) => {
      const extension = (path.extname(info.filename || '').toLowerCase() || '.bin').replace(/[^.a-z0-9]/g, '');
      const safeName = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
      originalName = info.filename || safeName;
      stream.pipe(fs.createWriteStream(path.join(dir, safeName)));
      stream.on('limit', () => { fileError = 'O arquivo deve ter no máximo 15 MB'; });
      savedPath = safeName;
    });
    busboy.on('finish', () => {
      if (fileError) return send(res, 400, { error: fileError });
      if (!savedPath) return send(res, 400, { error: 'Nenhum arquivo enviado' });
      return send(res, 200, { url: `/uploads/solicitacoes/${savedPath}`, name: originalName });
    });
    req.pipe(busboy);
    return true;
  }

  if (url.pathname !== '/api/requests') return false;
  if (!prisma) return send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }), true;
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    try {
      const status = url.searchParams.get('status');
      const mine = url.searchParams.get('mine') === '1';
      const requests = await prisma.request.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(mine ? { requesterEmail: session.email } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      send(res, 200, requests.map(mapRequest));
    } catch (error) {
      console.error('[api]', error);
      send(res, 500, { error: 'Erro ao processar a solicitação.' });
    }
    return true;
  }

  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!REQUEST_TYPES.has(item.type)) return send(res, 400, { error: 'Tipo de solicitação inválido.' }), true;
      if (!item.department || !item.description) return send(res, 400, { error: 'Informe departamento e descrição.' }), true;
      const priority = PRIORITIES.has(item.priority) ? item.priority : 'MEDIA';
      const submit = item.submit === true;
      const created = await prisma.request.create({
        data: {
          type: item.type,
          requesterName: session.name,
          requesterEmail: session.email,
          requesterRole: session.role,
          department: item.department,
          description: item.description,
          justification: item.justification || null,
          valuePlanned: item.valuePlanned !== undefined && item.valuePlanned !== '' ? Number(item.valuePlanned) : null,
          favorecido: item.favorecido || null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          priority,
          attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
          observations: item.observations || null,
          items: Array.isArray(item.items) ? item.items : undefined,
          purchaseResponsibleName: item.purchaseResponsibleName || null,
          status: submit ? 'SOLICITADO' : 'RASCUNHO',
        },
      });
      await logAudit({ session, action: submit ? 'request.submit' : 'request.create', entity: 'Request', entityId: created.id, after: mapRequest(created) });
      send(res, 201, mapRequest(created));
    } catch (error) {
      console.error('[api]', error);
      send(res, 400, { error: 'Erro ao processar a solicitação.' });
    }
    return true;
  }

  if (req.method === 'PUT') {
    try {
      const item = await body(req);
      const current = await prisma.request.findUnique({ where: { id: item.id } });
      if (!current) return send(res, 404, { error: 'Solicitação não encontrada' }), true;

      // Cotação de fornecedores — só para solicitações de compra, só antes da aprovação final.
      // Não é uma transição de status: só acrescenta ao histórico de cotações da solicitação.
      if (item.action === 'add_quote') {
        if (!PURCHASE_TYPES.has(current.type)) return send(res, 400, { error: 'Cotação disponível apenas para solicitações de compra.' }), true;
        if (!['SOLICITADO', 'APROVACAO_DIRETOR', 'FINANCEIRO'].includes(current.status)) return send(res, 400, { error: 'Só é possível registrar cotação antes da aprovação final.' }), true;
        const canQuote = current.requesterEmail === session.email || hasPermission(session, 'solicitacoes.aprovar') || hasPermission(session, 'financeiro.aprovar');
        if (!canQuote) return send(res, 403, { error: 'Você não tem permissão para registrar cotação.' }), true;
        const quote = item.quotation || {};
        if (!quote.supplier || quote.value === undefined || quote.value === '') return send(res, 400, { error: 'Informe fornecedor e valor da cotação.' }), true;
        const quotations = Array.isArray(current.quotations) ? current.quotations : [];
        quotations.push({ supplier: quote.supplier, value: Number(quote.value), notes: quote.notes || null, addedBy: session.name, addedAt: new Date().toISOString() });
        const updated = await prisma.request.update({ where: { id: item.id }, data: { quotations } });
        await logAudit({ session, action: 'request.add_quote', entity: 'Request', entityId: item.id, before: mapRequest(current), after: mapRequest(updated) });
        send(res, 200, mapRequest(updated));
        return true;
      }

      if (item.action) {
        const transition = TRANSITIONS[item.action];
        if (!transition) return send(res, 400, { error: 'Ação inválida.' }), true;
        if (!transition.from.includes(current.status)) return send(res, 400, { error: `Não é possível executar essa ação a partir do status ${current.status}.` }), true;
        // Para solicitações de compra, quem pediu também pode confirmar o recebimento/finalizar
        // (fecha o ciclo "recebimento" do fluxo de compras sem depender só do financeiro).
        const canFinalizeAsRequester = item.action === 'finalize' && PURCHASE_TYPES.has(current.type) && current.requesterEmail === session.email;
        if (!hasPermission(session, transition.permission) && !canFinalizeAsRequester) return send(res, 403, { error: 'Você não tem permissão para esta ação.' }), true;
        if (transition.requiresProof && !item.proofUrl && !current.proofUrl) return send(res, 400, { error: 'Anexe o comprovante de pagamento antes de marcar como pago.' }), true;

        const data = { status: transition.to };
        if (item.action === 'reject') data.rejectedReason = item.rejectedReason || 'Não informado';
        if (item.action === 'pay') {
          if (item.proofUrl) data.proofUrl = item.proofUrl;
          if (item.valueFinal !== undefined && item.valueFinal !== '') data.valueFinal = Number(item.valueFinal);
        }
        if (item.action === 'finalize' && PURCHASE_TYPES.has(current.type)) {
          data.receivedByName = item.receivedByName || session.name;
          data.receivedAt = new Date();
          if (item.invoiceUrl) data.invoiceUrl = item.invoiceUrl;
        }
        const updated = await prisma.request.update({ where: { id: item.id }, data });
        await logAudit({ session, action: `request.${item.action}`, entity: 'Request', entityId: item.id, before: mapRequest(current), after: mapRequest(updated) });

        // Fecha o ciclo solicitação → financeiro: ao ser paga, a solicitação gera (ou atualiza)
        // o lançamento correspondente no caixa, já como despesa liquidada e com o comprovante anexado.
        if (item.action === 'pay') {
          const amount = updated.valueFinal !== null ? Number(updated.valueFinal) : Number(updated.valuePlanned || 0);
          const existing = await prisma.transaction.findFirst({ where: { requestId: updated.id } });
          const txData = {
            description: `${TYPE_LABEL_PT[updated.type] || updated.type} — ${updated.description}`,
            amount: amount > 0 ? amount : 0.01,
            type: 'EXPENSE',
            category: updated.department,
            status: 'PAID',
            favorecido: updated.favorecido,
            proofUrl: updated.proofUrl,
            responsibleName: session.name,
            requestId: updated.id,
          };
          if (existing) await prisma.transaction.update({ where: { id: existing.id }, data: txData });
          else await prisma.transaction.create({ data: txData });

          if (updated.proofUrl) {
            await prisma.document.create({
              data: {
                name: `Comprovante — ${updated.description}`, category: 'Comprovante', url: updated.proofUrl, isPublic: false,
                linkedEntity: 'Request', linkedId: updated.id,
              },
            }).catch(error => console.error('[api]', error));
          }
        }

        if (updated.requesterEmail !== session.email && STATUS_LABEL_PT[updated.status]) {
          notify({
            email: updated.requesterEmail,
            title: 'Solicitação atualizada',
            message: `Sua solicitação "${updated.description}" está ${STATUS_LABEL_PT[updated.status]}.`,
            link: '/gestao/solicitacoes',
          });
        }

        send(res, 200, mapRequest(updated));
        return true;
      }

      // Edição livre de campos só é permitida enquanto a solicitação está em rascunho, e só pelo autor.
      if (current.status !== 'RASCUNHO' || current.requesterEmail !== session.email) {
        return send(res, 403, { error: 'Só é possível editar a solicitação enquanto estiver em rascunho.' }), true;
      }
      const data = {};
      if (item.type !== undefined && REQUEST_TYPES.has(item.type)) data.type = item.type;
      if (item.department !== undefined) data.department = item.department;
      if (item.description !== undefined) data.description = item.description;
      if (item.justification !== undefined) data.justification = item.justification || null;
      if (item.valuePlanned !== undefined) data.valuePlanned = item.valuePlanned === '' ? null : Number(item.valuePlanned);
      if (item.favorecido !== undefined) data.favorecido = item.favorecido || null;
      if (item.dueDate !== undefined) data.dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (item.priority !== undefined && PRIORITIES.has(item.priority)) data.priority = item.priority;
      if (item.attachments !== undefined) data.attachments = item.attachments;
      if (item.observations !== undefined) data.observations = item.observations || null;
      if (item.items !== undefined) data.items = Array.isArray(item.items) ? item.items : null;
      if (item.purchaseResponsibleName !== undefined) data.purchaseResponsibleName = item.purchaseResponsibleName || null;
      const updated = await prisma.request.update({ where: { id: item.id }, data });
      await logAudit({ session, action: 'request.update', entity: 'Request', entityId: item.id, before: mapRequest(current), after: mapRequest(updated) });
      send(res, 200, mapRequest(updated));
    } catch (error) {
      console.error('[api]', error);
      send(res, 400, { error: 'Erro ao processar a solicitação.' });
    }
    return true;
  }

  if (req.method === 'DELETE') {
    try {
      const item = await body(req);
      const current = await prisma.request.findUnique({ where: { id: item.id } });
      if (!current) return send(res, 404, { error: 'Solicitação não encontrada' }), true;
      if (current.status !== 'RASCUNHO' || current.requesterEmail !== session.email) {
        return send(res, 403, { error: 'Só é possível excluir a solicitação enquanto estiver em rascunho.' }), true;
      }
      await prisma.request.delete({ where: { id: item.id } });
      await logAudit({ session, action: 'request.delete', entity: 'Request', entityId: item.id, before: mapRequest(current) });
      send(res, 200, { ok: true });
    } catch (error) {
      console.error('[api]', error);
      send(res, 400, { error: 'Informe o id da solicitação' });
    }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

module.exports = { handleRequestRoutes };
