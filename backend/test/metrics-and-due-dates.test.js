'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');
const { resolveDueDates } = require('../lib/pendency-due-dates');

let server, baseUrl;
const ESPORTES_TOKEN = 'test-token-esportes-metrics';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste-metrics@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(ESPORTES_TOKEN);
  await stopServer(server);
});

test('GET /api/metrics é restrito à Presidência', async () => {
  const res = await fetch(`${baseUrl}/api/metrics`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  assert.equal(res.status, 403);
});

test('GET /api/metrics retorna estrutura esperada', async () => {
  const res = await fetch(`${baseUrl}/api/metrics`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.tasks.completedOnTime, 'number');
  assert.equal(typeof data.tasks.overdueOpen, 'number');
  assert.equal(typeof data.pendencies.open, 'number');
  assert.equal(typeof data.notifications.sentLast30d, 'number');
  assert.equal(typeof data.operational.requestsAwaitingApproval, 'number');
});

test('resolveDueDates resolve o prazo real a partir da entidade de origem (Request e Schedule)', async () => {
  const request = await prisma.request.create({
    data: { type: 'OUTRAS_DESPESAS', requesterName: 'Teste', requesterEmail: 'teste-due@compex.com.br', requesterRole: 'ESPORTES', department: 'Esportes', description: 'x', dueDate: new Date('2030-01-01') },
  });
  const schedule = await prisma.schedule.create({
    data: { referenceLabel: 'Jogo teste', function: 'SUMULA', assignedName: 'Teste', date: new Date('2030-02-01'), createdByName: 'Teste' },
  });
  try {
    const notifications = [
      { id: 'n1', entity: 'Request', entityId: request.id },
      { id: 'n2', entity: 'Schedule', entityId: schedule.id },
      { id: 'n3', entity: 'DepartureRequest', entityId: 'sem-suporte' },
      { id: 'n4', entity: null, entityId: null },
    ];
    const result = await resolveDueDates(notifications);
    assert.equal(result.get('n1').toISOString().slice(0, 10), '2030-01-01');
    assert.equal(result.get('n2').toISOString().slice(0, 10), '2030-02-01');
    assert.equal(result.get('n3'), null);
    assert.equal(result.get('n4'), null);
  } finally {
    await prisma.request.delete({ where: { id: request.id } }).catch(() => {});
    await prisma.schedule.delete({ where: { id: schedule.id } }).catch(() => {});
  }
});

test('GET /api/notifications expõe dueAt resolvido da entidade de origem', async () => {
  const request = await prisma.request.create({
    data: { type: 'OUTRAS_DESPESAS', requesterName: 'Teste', requesterEmail: 'esportes-teste-metrics@compex.com.br', requesterRole: 'ESPORTES', department: 'Esportes', description: 'Pedido com prazo', dueDate: new Date('2031-05-05') },
  });
  const notification = await prisma.notification.create({
    data: { userEmail: 'esportes-teste-metrics@compex.com.br', title: 'x', message: 'x', kind: 'ACIONAVEL', priority: 'ALTA', entity: 'Request', entityId: request.id },
  });
  try {
    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
    const data = await res.json();
    const item = data.items.find(i => i.id === notification.id);
    assert.ok(item);
    assert.equal(item.dueAt.slice(0, 10), '2031-05-05');
  } finally {
    await prisma.notification.delete({ where: { id: notification.id } }).catch(() => {});
    await prisma.request.delete({ where: { id: request.id } }).catch(() => {});
  }
});
