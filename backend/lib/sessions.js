const fs = require('fs');
const { SESSION_TTL_MS, sessionsFile, LEGACY_TOKENS } = require('./constants');

const sessions = new Map();
try {
  const stored = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  Object.entries(stored).forEach(([token, session]) => { if (session.expiresAt > Date.now()) sessions.set(token, session); });
} catch {}
function persistSessions() { fs.writeFileSync(sessionsFile, JSON.stringify(Object.fromEntries(sessions))); }

function resolveSession(token) {
  if (!token) return null;
  if (LEGACY_TOKENS[token]) return LEGACY_TOKENS[token];
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return session;
}
function bearerToken(req) { return (req.headers.authorization || '').replace('Bearer ', '').trim(); }
const canManageAccounts = session => !!session && (session.role === 'PRESIDENCIA' || session.rank === 'DIRETOR');
// Gestão de planos de sócio é restrita à Presidência e ao Financeiro (regra de negócio explícita,
// mais estreita que canManageAccounts — nem todo diretor pode mexer em preço de mensalidade).
const canManagePlans = session => !!session && (session.role === 'PRESIDENCIA' || session.role === 'FINANCEIRO');
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  header.split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index === -1) return;
    map[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return map;
}

module.exports = { sessions, persistSessions, resolveSession, bearerToken, canManageAccounts, canManagePlans, parseCookies };
