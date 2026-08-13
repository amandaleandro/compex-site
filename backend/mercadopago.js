const { MercadoPagoConfig, Preference, PreApproval, Payment } = require('mercadopago');

let client = null;
function getClient() {
  if (client) return client;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;
  client = new MercadoPagoConfig({ accessToken });
  return client;
}

function preferenceClient() { const c = getClient(); return c ? new Preference(c) : null; }
function preApprovalClient() { const c = getClient(); return c ? new PreApproval(c) : null; }
function paymentClient() { const c = getClient(); return c ? new Payment(c) : null; }

module.exports = { getClient, preferenceClient, preApprovalClient, paymentClient };
