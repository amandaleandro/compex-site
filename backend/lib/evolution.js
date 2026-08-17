// Cliente HTTP mínimo da Evolution API. Credenciais só existem aqui (backend) e vêm de
// variáveis de ambiente — nunca são expostas ao frontend. Segue o mesmo padrão já usado
// para o Mercado Pago neste projeto: sem configuração, a funcionalidade some/avisa em vez
// de quebrar.
function config() {
  return {
    url: (process.env.EVOLUTION_API_URL || '').replace(/\/$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || '',
    webhookToken: process.env.EVOLUTION_WEBHOOK_TOKEN || '',
  };
}

function isEvolutionConfigured() {
  const { url, apiKey, instance } = config();
  return !!(url && apiKey && instance);
}

function isWebhookConfigured() {
  return !!config().webhookToken;
}

// Envia texto simples via Evolution API (endpoint padrão /message/sendText/{instance}).
// Retorna { ok, externalId, error }. Nunca lança — quem chama decide o que fazer com o erro.
async function sendViaEvolution({ phone, message }) {
  const { url, apiKey, instance } = config();
  if (!url || !apiKey || !instance) return { ok: false, error: 'Evolution API não configurada' };
  try {
    const response = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, text: message }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.message || `Evolution respondeu ${response.status}` };
    return { ok: true, externalId: data.key?.id || data.id || null };
  } catch (error) {
    return { ok: false, error: error.message || 'Falha de rede ao chamar a Evolution API' };
  }
}

module.exports = { isEvolutionConfigured, isWebhookConfigured, sendViaEvolution, config };
