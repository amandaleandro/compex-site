const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const associatePhotosDir = path.join(uploadsDir, 'associates');
if (!fs.existsSync(associatePhotosDir)) fs.mkdirSync(associatePhotosDir, { recursive: true });
const patrimonioDocsDir = path.join(uploadsDir, 'patrimonio');
if (!fs.existsSync(patrimonioDocsDir)) fs.mkdirSync(patrimonioDocsDir, { recursive: true });
const dataFile = path.join(__dirname, '..', 'data.json');
const port = process.env.PORT || 3000;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
// events/members/news/transactions/benefits/plans agora vivem inteiramente no Prisma/Postgres
// (ver databaseCollection); data.json não guarda mais nenhuma dessas coleções.
const initialData = {};

// Sessões da gestão: tokens fixos de demonstração continuam funcionando (o portal do
// associado, em associate.js, ainda depende literalmente desses dois valores). Contas
// reais de diretoria (Financeiro, Esportes, Eventos, Marketing) recebem tokens gerados
// e validados contra o Role de cada User no Prisma.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessionsFile = path.join(__dirname, '..', 'sessions.json');
const LEGACY_TOKENS = {
  'demo-session-compex': { name: 'Amanda Silva', role: 'PRESIDENCIA', rank: 'DIRETOR', email: 'diretoria@compex.com.br' },
  'demo-session-associado': { name: 'Lucas Associado', role: 'ASSOCIADO', rank: 'DIRETOR', email: 'associado@compex.com.br' }
};
const INTERNAL_ROLES = new Set(['PRESIDENCIA', 'FINANCEIRO', 'ESPORTES', 'EVENTOS', 'MARKETING', 'PRODUTOS', 'PATRIMONIO']);

module.exports = {
  uploadsDir, associatePhotosDir, patrimonioDocsDir, dataFile, port, mime, initialData,
  SESSION_TTL_MS, sessionsFile, LEGACY_TOKENS, INTERNAL_ROLES,
};
