// Permissões granulares além do Role: cada Role já libera um conjunto padrão de ações;
// permissões extras podem ser concedidas por usuário via User.permissions (array de strings).
const ROLE_PERMISSIONS = {
  PRESIDENCIA: [
    'solicitacoes.criar', 'solicitacoes.aprovar', 'solicitacoes.aprovar_presidencia',
    'financeiro.visualizar', 'financeiro.aprovar', 'financeiro.pagar',
    'departamentos.gerenciar', 'presidencia.aprovar', 'documentos.visualizar',
    'conteudo.criar', 'conteudo.editar', 'conteudo.publicar', 'conteudo.agendar', 'conteudo.arquivar',
    'enquetes.validar',
  ],
  FINANCEIRO: [
    'solicitacoes.criar', 'solicitacoes.aprovar', 'solicitacoes.aprovar_financeiro',
    'financeiro.visualizar', 'financeiro.aprovar', 'financeiro.pagar', 'documentos.visualizar',
  ],
  ESPORTES: ['solicitacoes.criar', 'solicitacoes.aprovar', 'esportes.convocar', 'esportes.publicar_convocacao', 'documentos.visualizar'],
  EVENTOS: ['solicitacoes.criar', 'solicitacoes.aprovar', 'documentos.visualizar'],
  MARKETING: [
    'solicitacoes.criar', 'solicitacoes.aprovar', 'documentos.visualizar',
    'conteudo.criar', 'conteudo.editar', 'conteudo.publicar', 'conteudo.agendar', 'conteudo.arquivar',
  ],
  PRODUTOS: ['solicitacoes.criar', 'solicitacoes.aprovar', 'documentos.visualizar'],
  PATRIMONIO: ['solicitacoes.criar', 'solicitacoes.aprovar', 'documentos.visualizar'],
  ASSOCIADO: ['solicitacoes.criar'],
};

function hasPermission(session, permission) {
  if (!session) return false;
  const rolePerms = ROLE_PERMISSIONS[session.role] || [];
  if (rolePerms.includes(permission)) return true;
  const extra = Array.isArray(session.permissions) ? session.permissions : [];
  return extra.includes(permission);
}

module.exports = { ROLE_PERMISSIONS, hasPermission };
