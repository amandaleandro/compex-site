'use strict';

const http = require('http');
const { requestHandler } = require('../router');

// Sobe um http.Server efêmero (porta aleatória) por arquivo de teste, envolvendo o
// requestHandler real do router.js. Usado por todos os testes desta suíte.
async function startServer() {
  const server = http.createServer(requestHandler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
}

// Token de demo fixo (LEGACY_TOKENS em backend/lib/constants.js) — cobre a conta de
// diretoria (PRESIDENCIA) usada nos smoke tests manuais deste projeto.
const DIRETORIA_EMAIL = 'diretoria@compex.com.br';
const DIRETORIA_PASSWORD = 'compex2026';
const DIRETORIA_TOKEN = 'demo-session-compex';

module.exports = { startServer, stopServer, DIRETORIA_EMAIL, DIRETORIA_PASSWORD, DIRETORIA_TOKEN };
