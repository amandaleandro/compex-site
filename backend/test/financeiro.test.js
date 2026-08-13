'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;
const createdIds = [];

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  // Limpa qualquer transação criada durante os testes para manter a suíte repetível.
  for (const id of createdIds) {
    await fetch(`${baseUrl}/api/transactions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }
  await stopServer(server);
});

test('POST /api/transactions com valor negativo retorna 400', async () => {
  const res = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ description: 'Teste', amount: -10, type: 'income' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Valor deve ser um número positivo.');
});

test('POST /api/transactions sem descrição retorna 400', async () => {
  const res = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ amount: 10, type: 'income' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Descrição é obrigatória.');
});

test('POST /api/transactions com payload válido (autenticado) retorna 201', async () => {
  const res = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ description: 'Teste automatizado', amount: 42.5, type: 'income', category: 'Teste' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.description, 'Teste automatizado');
  assert.equal(data.amount, 42.5);
  assert.ok(data.id);
  createdIds.push(data.id);
});

test('GET /api/transactions sem autenticação retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/transactions`);
  assert.equal(res.status, 401);
});
