const { prisma } = require('../db');
const { ROLE_PERMISSIONS } = require('./permissions');

// Notificação interna — nunca deve derrubar a request principal se falhar.
// kind: 'INFORMATIVA' (padrão, desaparece ao visualizar) ou 'ACIONAVEL' (pendência
// que só some quando resolvePendency for chamado para a mesma entity/entityId).
// `whatsapp: { templateKey, variables }` é opcional — quando informado, busca o telefone do
// User pelo e-mail e enfileira o envio (ver lib/whatsapp-queue.js); nunca envia na hora.
async function notify({ email, title, message, link = null, kind = 'INFORMATIVA', priority = 'NORMAL', entity = null, entityId = null, remindStage = null, whatsapp = null }) {
  if (!prisma || !email) return;
  try {
    await prisma.notification.create({
      data: { userEmail: email, title, message, link, kind, priority, entity, entityId, remindStage },
    });
  } catch (error) {
    console.error('[notify]', error);
  }
  if (whatsapp) {
    try {
      // Associado tem telefone no próprio Member (campo já usado no cadastro); diretoria usa
      // User.phone. Prioriza o do Member quando existir os dois (é o que a pessoa de fato usa).
      const user = await prisma.user.findUnique({ where: { email }, select: { phone: true, whatsappOptOutInformativas: true, member: { select: { phone: true, preferences: true } } } });
      const phone = user?.member?.phone || user?.phone;
      // Só INFORMATIVA pode ser desligada pela preferência do usuário — ACIONAVEL (escala,
      // cobrança, aprovação) é operacional e sempre chega, conforme o pedido original. Associado
      // já tem essa preferência em Member.preferences.whatsapp (tela /associado/configuracoes);
      // diretoria (sem Member) usa o campo equivalente em User.
      const memberPrefs = user?.member?.preferences;
      const optedOut = kind === 'INFORMATIVA' && (
        user?.member ? memberPrefs?.whatsapp === false : user?.whatsappOptOutInformativas
      );
      if (phone && !optedOut) {
        // Import tardio para evitar ciclo (whatsapp-queue não depende de notify.js, mas
        // mantém o require perto do uso deixa claro que é um efeito colateral opcional).
        const { enqueueWhatsApp } = require('./whatsapp-queue');
        await enqueueWhatsApp({ phone, templateKey: whatsapp.templateKey, variables: whatsapp.variables, linkedEntity: entity, linkedId: entityId, priority });
      }
    } catch (error) {
      console.error('[notify:whatsapp]', error);
    }
  }
}

// Encerra a cobrança: marca como resolvidas todas as notificações acionáveis ainda
// abertas vinculadas ao mesmo registro de origem (ex: escala confirmada, tarefa concluída).
async function resolvePendency({ entity, entityId }) {
  if (!prisma || !entity || !entityId) return;
  try {
    await prisma.notification.updateMany({
      where: { entity, entityId, kind: 'ACIONAVEL', resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });
  } catch (error) {
    console.error('[notify]', error);
  }
}

// Notifica todos os usuários ativos cujo Role concede `permission` (avisa quem pode agir
// numa etapa de aprovação, sem precisar saber o e-mail de cada aprovador na hora de chamar).
// Não considera permissões extras concedidas individualmente (User.permissions) — cobre o caso padrão.
async function notifyByPermission({ permission, excludeEmail = null, ...rest }) {
  if (!prisma) return;
  const roles = Object.keys(ROLE_PERMISSIONS).filter(role => ROLE_PERMISSIONS[role].includes(permission));
  if (!roles.length) return;
  try {
    const users = await prisma.user.findMany({ where: { role: { in: roles }, active: true }, select: { email: true } });
    for (const user of users) {
      if (user.email === excludeEmail) continue;
      await notify({ email: user.email, ...rest });
    }
  } catch (error) {
    console.error('[notify]', error);
  }
}

module.exports = { notify, resolvePendency, notifyByPermission };
