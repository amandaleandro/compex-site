'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  await stopServer(server);
});

test('GET /api/events sem autenticação não retorna campos financeiros', async () => {
  const res = await fetch(`${baseUrl}/api/events`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  for (const event of data) {
    assert.equal(event.revenue, undefined);
    assert.equal(event.expenses, undefined);
    assert.equal(event.financialNotes, undefined);
    assert.equal(event.profit, undefined);
  }
});

test('GET /api/events autenticado (diretoria) continua retornando campos financeiros', async () => {
  const res = await fetch(`${baseUrl}/api/events`, {
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  if (data.length > 0) {
    assert.notEqual(data[0].revenue, undefined);
    assert.notEqual(data[0].expenses, undefined);
  }
});
