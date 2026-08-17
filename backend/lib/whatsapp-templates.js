// Templates de mensagem do WhatsApp — texto nunca fica solto nas rotas. Cada função recebe
// as variáveis e devolve o texto final; `{{var}}` nas strings de referência é só documentação.
const TEMPLATES = {
  nova_atividade: ({ nome, atividade, prazo, departamento }) =>
    `🐺 CompExatas\n\nUma nova atividade foi atribuída a você:\n\n*${atividade}*\n\nPrazo: ${prazo || 'a combinar'}${departamento ? `\nDepartamento: ${departamento}` : ''}\n\nConsulte os detalhes no Portal da Gestão.`,

  atividade_atrasada: ({ atividade, prazo }) =>
    `🐺 CompExatas\n\nVocê possui uma atividade pendente:\n\n*${atividade}*\n\nPrazo: ${prazo}\n\nAcesse o Portal da Gestão para atualizar a atividade.`,

  nova_escala: ({ nome, referencia, funcao, data, local }) =>
    `🐺 CompExatas\n\nVocê foi escalado(a) para:\n\n*${referencia}* (${funcao})${data ? `\nData: ${data}` : ''}${local ? `\nLocal: ${local}` : ''}\n\nConfirme sua disponibilidade pelo Portal CompExatas.`,

  convocacao: ({ evento, data, horario }) =>
    `🐺 CompExatas\n\nVocê recebeu uma convocação para:\n\n*${evento}*\n\nData: ${data}\nHorário: ${horario}\n\nConfirme sua disponibilidade pelo Portal CompExatas.`,

  reuniao: ({ titulo, data, horario }) =>
    `🐺 CompExatas\n\nReunião marcada:\n\n*${titulo}*\n\nData: ${data}${horario ? `\nHorário: ${horario}` : ''}\n\nConsulte a pauta no Portal da Gestão.`,

  pagamento: ({ descricao, status }) =>
    `🐺 CompExatas\n\nAtualização financeira:\n\n*${descricao}*\n\nStatus: ${status}\n\nConsulte os detalhes no Portal CompExatas.`,

  enquete: ({ pergunta }) =>
    `🐺 CompExatas\n\nUma nova enquete está aberta:\n\n*${pergunta}*\n\nVote pelo Portal da Gestão.`,

  resultado_enquete: ({ pergunta, vencedora }) =>
    `🐺 CompExatas\n\nResultado oficial da enquete:\n\n*${pergunta}*\n\nOpção vencedora: *${vencedora}*\n\nConsulte os detalhes no Portal CompExatas.`,

  solicitacao_pendente: ({ descricao, tipo }) =>
    `🐺 CompExatas\n\nSolicitação aguardando sua aprovação:\n\n*${descricao}* (${tipo})\n\nAcesse o Portal da Gestão para analisar.`,

  solicitacao_atrasada: ({ descricao, solicitante, dias }) =>
    `🐺 CompExatas\n\n⚠ Solicitação atrasada há ${dias} dia(s):\n\n*${descricao}*${solicitante ? `\nSolicitante: ${solicitante}` : ''}\n\nAcesse o Portal da Gestão para regularizar.`,
};

// Substitui {{chave}} pelo valor de variables[chave] — usado quando o texto vier de fora
// (ex: configuração futura), a maioria dos templates acima já monta a string diretamente.
function renderTemplate(text, variables = {}) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => (variables[key] !== undefined ? String(variables[key]) : ''));
}

function buildMessage(templateKey, variables = {}) {
  const builder = TEMPLATES[templateKey];
  if (!builder) throw new Error(`Template de WhatsApp desconhecido: ${templateKey}`);
  return builder(variables);
}

module.exports = { TEMPLATES, renderTemplate, buildMessage };
