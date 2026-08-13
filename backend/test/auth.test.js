'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, DIRETORIA_EMAIL, DIRETORIA_PASSWORD, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  await stopServer(server);
});

test('POST /api/auth/login sem senha retorna 400 com a mensagem de validação', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DIRETORIA_EMAIL }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Senha é obrigatória.');
});

test('POST /api/auth/login com credenciais erradas retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DIRETORIA_EMAIL, password: 'senha-errada' }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'E-mail ou senha inválidos');
});

test('POST /api/auth/login com credenciais demo válidas retorna 200 + token', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DIRETORIA_EMAIL, password: DIRETORIA_PASSWORD }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.token, DIRETORIA_TOKEN);
  assert.equal(data.user.role, 'PRESIDENCIA');
});

test('GET /api/members sem token retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/members`);
  assert.equal(res.status, 401);
});

test('GET /api/members com token demo válido retorna 200', async () => {
  const res = await fetch(`${baseUrl}/api/members`, {
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
});
