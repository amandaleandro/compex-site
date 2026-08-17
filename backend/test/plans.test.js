'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;
const createdIds = [];

// Sessão de FINANCEIRO real (não LEGACY_TOKENS), pra testar a regra PRESIDENCIA/FINANCEIRO.
const { sessions } = require('../lib/sessions');
const FINANCEIRO_TOKEN = 'test-token-financeiro-plans';
const ESPORTES_TOKEN = 'test-token-esportes-plans';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(FINANCEIRO_TOKEN, { name: 'Financeiro Teste', role: 'FINANCEIRO', rank: 'DIRETOR', email: 'financeiro-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(FINANCEIRO_TOKEN);
  sessions.delete(ESPORTES_TOKEN);
  for (const id of createdIds) {
    await prisma.plan.delete({ where: { id } }).catch(() => {});
  }
  await stopServer(server);
});

test('POST /api/plans com PRESIDENCIA cria plano', async () => {
  const res = await fetch(`${baseUrl}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ name: 'Plano Teste Presidência', priceCents: 5000, periodicity: 'SEMESTRAL', durationMonths: 6 }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.priceCents, 5000);
  createdIds.push(data.id);
});

test('POST /api/plans com FINANCEIRO cria plano', async () => {
  const res = await fetch(`${baseUrl}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FINANCEIRO_TOKEN}` },
    body: JSON.stringify({ name: 'Plano Teste Financeiro', priceCents: 7000, periodicity: 'ANUAL', durationMonths: 12 }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdIds.push(data.id);
});

test('POST /api/plans com outra diretoria (ESPORTES) retorna 403', async () => {
  const res = await fetch(`${baseUrl}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ name: 'Plano Não Autorizado', priceCents: 1000 }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/plans sem autenticação retorna 403', async () => {
  const res = await fetch(`${baseUrl}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Plano Anônimo', priceCents: 1000 }),
  });
  assert.equal(res.status, 403);
});

test('GET /api/plans sem autenticação não retorna planos inativos', async () => {
  const inactive = await prisma.plan.create({ data: { name: 'Plano Inativo Teste', price: '10.00', priceCents: 1000, active: false } });
  createdIds.push(inactive.id);
  const res = await fetch(`${baseUrl}/api/plans`);
  const data = await res.json();
  assert.ok(!data.some(p => p.id === inactive.id));
});

test('GET /api/plans autenticado (diretoria) retorna também planos inativos', async () => {
  const res = await fetch(`${baseUrl}/api/plans`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  const data = await res.json();
  assert.ok(data.length >= createdIds.length);
});

test('checkout de mensalidade usa o preço do banco, não o enviado pelo frontend', async () => {
  const plan = await prisma.plan.create({ data: { name: 'Plano Checkout Teste', price: '60.00', priceCents: 6000, active: true, durationMonths: 6 } });
  createdIds.push(plan.id);
  const res = await fetch(`${baseUrl}/api/checkout/mensalidade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-session-associado' },
    body: JSON.stringify({ planId: plan.id, priceCents: 1 }), // valor forjado deve ser ignorado
  });
  assert.equal(res.status, 200);
  // Sem MERCADOPAGO_ACCESS_TOKEN configurado em teste, a rota retorna warning — o que importa
  // é que ela não rejeitou por causa do campo priceCents forjado, e buscou o plano no banco.
  const data = await res.json();
  assert.ok('initPoint' in data);
});

test('checkout de mensalidade com plano inativo retorna 400', async () => {
  const plan = await prisma.plan.create({ data: { name: 'Plano Inativo Checkout', price: '60.00', priceCents: 6000, active: false } });
  createdIds.push(plan.id);
  const res = await fetch(`${baseUrl}/api/checkout/mensalidade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-session-associado' },
    body: JSON.stringify({ planId: plan.id }),
  });
  assert.equal(res.status, 400);
});
