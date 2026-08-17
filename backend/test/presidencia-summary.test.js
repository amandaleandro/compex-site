'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');

let server, baseUrl;
const ESPORTES_TOKEN = 'test-token-esportes-presidencia-summary';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste-presidencia@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(ESPORTES_TOKEN);
  await stopServer(server);
});

test('GET /api/presidencia-summary é restrito à Presidência', async () => {
  const res = await fetch(`${baseUrl}/api/presidencia-summary`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  assert.equal(res.status, 403);
});

test('GET /api/presidencia-summary agrupa "precisa de cobrança" por pessoa e conta sugestão de reunião', async () => {
  const owner = await prisma.user.create({ data: { name: `Cobrança Teste ${Date.now()}`, email: `cobranca-teste-${Date.now()}@compex.com.br`, password: 'x', role: 'MARKETING' } });
  const notificationIds = [];
  try {
    for (let i = 0; i < 2; i += 1) {
      const n = await prisma.notification.create({ data: { userEmail: owner.email, title: `Pendência ${i}`, message: 'x', kind: 'ACIONAVEL', priority: 'ALTA', resolved: false } });
      notificationIds.push(n.id);
    }

    const res = await fetch(`${baseUrl}/api/presidencia-summary`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
    assert.equal(res.status, 200);
    const data = await res.json();

    const entry = data.needsFollowUp.find(f => f.email === owner.email);
    assert.ok(entry, 'deveria agrupar as pendências acionáveis dessa pessoa em needsFollowUp');
    assert.equal(entry.count, 2);
    assert.equal(entry.name, owner.name);

    assert.equal(typeof data.meetingSuggestionCount, 'number');
    assert.ok(data.meetingSuggestionCount >= 0);
  } finally {
    await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
  }
});
