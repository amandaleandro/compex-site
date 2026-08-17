'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');

let server, baseUrl;
const createdIds = [];

const ESPORTES_TOKEN = 'test-token-esportes-polls';
const MARKETING_TOKEN = 'test-token-marketing-polls';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
  sessions.set(MARKETING_TOKEN, { name: 'Marketing Teste', role: 'MARKETING', rank: 'DIRETOR', email: 'marketing-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(ESPORTES_TOKEN);
  sessions.delete(MARKETING_TOKEN);
  for (const id of createdIds) {
    await prisma.pollVote.deleteMany({ where: { pollId: id } }).catch(() => {});
    await prisma.poll.delete({ where: { id } }).catch(() => {});
  }
  await stopServer(server);
});

function futureIso(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

test('POST /api/polls sem encerramento retorna 400', async () => {
  const res = await fetch(`${baseUrl}/api/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ question: 'Sem prazo?', options: ['Sim', 'Não'] }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/polls sem autenticação retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'x', options: ['a', 'b'], expiresAt: futureIso(60) }),
  });
  assert.equal(res.status, 401);
});

test('fluxo completo: criar (aberta) -> votar -> encerrar -> empate exige decisão -> validar -> resultado oficial', async () => {
  const create = await fetch(`${baseUrl}/api/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ question: 'Qual modelo de camisa?', options: ['Modelo A', 'Modelo B'], expiresAt: futureIso(60), openNow: true }),
  });
  assert.equal(create.status, 201);
  const poll = await create.json();
  createdIds.push(poll.id);
  assert.equal(poll.status, 'ABERTA');

  // Empate: um voto em cada opção
  const voteA = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ optionIndex: 0 }),
  });
  assert.equal(voteA.status, 200);
  const voteB = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ optionIndex: 1 }),
  });
  assert.equal(voteB.status, 200);

  const close = await fetch(`${baseUrl}/api/polls/${poll.id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
  });
  assert.equal(close.status, 200);
  const closed = await close.json();
  assert.equal(closed.status, 'ENCERRADA');
  assert.equal(closed.tied, true);

  // Validar sem informar vencedor em caso de empate deve falhar
  const validateWithoutWinner = await fetch(`${baseUrl}/api/polls/${poll.id}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({}),
  });
  assert.equal(validateWithoutWinner.status, 400);

  // Sem permissão de validar (ESPORTES não tem enquetes.validar)
  const validateNoPerm = await fetch(`${baseUrl}/api/polls/${poll.id}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ officialWinnerIndex: 0, tieBreakMethod: 'Decisão da Presidência' }),
  });
  assert.equal(validateNoPerm.status, 403);

  const validate = await fetch(`${baseUrl}/api/polls/${poll.id}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ officialWinnerIndex: 0, tieBreakMethod: 'Decisão da Presidência' }),
  });
  assert.equal(validate.status, 200);
  const validated = await validate.json();
  assert.equal(validated.status, 'VALIDADA');
  assert.equal(validated.officialWinnerIndex, 0);
  assert.ok(validated.validatedByName);

  // Não permite votar depois de validada
  const voteAfterValidation = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ optionIndex: 1 }),
  });
  assert.equal(voteAfterValidation.status, 400);
});

test('DELETE /api/polls só permite excluir rascunho ou agendada', async () => {
  const create = await fetch(`${baseUrl}/api/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ question: 'Enquete aberta para excluir?', options: ['a', 'b'], expiresAt: futureIso(60), openNow: true }),
  });
  const poll = await create.json();
  createdIds.push(poll.id);

  const deleteAttempt = await fetch(`${baseUrl}/api/polls/${poll.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
  });
  assert.equal(deleteAttempt.status, 400);
});

test('enquete com audience restrita não aparece nem aceita voto de papel fora do público', async () => {
  const create = await fetch(`${baseUrl}/api/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ question: 'Só marketing vota', options: ['a', 'b'], expiresAt: futureIso(60), openNow: true, audience: ['MARKETING'] }),
  });
  const poll = await create.json();
  createdIds.push(poll.id);

  const listAsEsportes = await fetch(`${baseUrl}/api/polls`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  const listData = await listAsEsportes.json();
  assert.ok(!listData.some(p => p.id === poll.id));

  const voteAsEsportes = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ optionIndex: 0 }),
  });
  assert.equal(voteAsEsportes.status, 403);

  const voteAsMarketing = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ optionIndex: 0 }),
  });
  assert.equal(voteAsMarketing.status, 200);
});
