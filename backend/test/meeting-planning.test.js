'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');

let server, baseUrl;
const createdAvailabilityIds = [];
const createdMeetingIds = [];

const ESPORTES_TOKEN = 'test-token-esportes-meeting-planning';
const ESPORTES_EMAIL = 'esportes-teste-planning@compex.com.br';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: ESPORTES_EMAIL, expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(ESPORTES_TOKEN);
  for (const id of createdAvailabilityIds) await prisma.memberAvailability.delete({ where: { id } }).catch(() => {});
  for (const id of createdMeetingIds) await prisma.meeting.delete({ where: { id } }).catch(() => {});
  await stopServer(server);
});

test('POST /api/availability com horário inválido retorna 400', async () => {
  const res = await fetch(`${baseUrl}/api/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ weekday: 2, startTime: '20:00', endTime: '19:00' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/availability cria horário e GET retorna para o próprio usuário', async () => {
  const res = await fetch(`${baseUrl}/api/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ weekday: 2, startTime: '19:00', endTime: '21:00' }),
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  createdAvailabilityIds.push(created.id);

  const list = await fetch(`${baseUrl}/api/availability`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  const data = await list.json();
  assert.ok(data.some(s => s.id === created.id));
});

test('GET /api/meetings/directory retorna usuários internos', async () => {
  const res = await fetch(`${baseUrl}/api/meetings/directory`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});

test('GET /api/meetings/suggested-agenda sem autenticação retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/meetings/suggested-agenda`);
  assert.equal(res.status, 401);
});

test('GET /api/meetings/suggested-agenda retorna lista (pode ser vazia)', async () => {
  const res = await fetch(`${baseUrl}/api/meetings/suggested-agenda`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});

test('POST /api/meetings/suggest-times sem participantes retorna 400', async () => {
  const res = await fetch(`${baseUrl}/api/meetings/suggest-times`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ participantEmails: [] }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/meetings/suggest-times considera disponibilidade cadastrada e retorna o horário certo', async () => {
  // ESPORTES_EMAIL só está disponível terça (weekday 2) 19h-21h — criado no teste anterior.
  const res = await fetch(`${baseUrl}/api/meetings/suggest-times`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ participantEmails: [ESPORTES_EMAIL], durationMinutes: 60, windowDays: 14 }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  for (const slot of data) {
    const weekday = new Date(`${slot.date}T00:00:00`).getDay();
    assert.equal(weekday, 2);
    assert.ok(slot.time >= '19:00' && slot.time < '21:00');
    assert.equal(slot.availableCount, 1);
  }
});

test('POST /api/meetings/suggest-times evita horário com reunião conflitante já marcada', async () => {
  // Marca uma reunião na próxima terça-feira, 19:00, com o mesmo participante.
  const today = new Date();
  const nextTuesday = new Date(today);
  nextTuesday.setDate(today.getDate() + ((2 - today.getDay() + 7) % 7 || 7));
  const dateStr = nextTuesday.toISOString().slice(0, 10);

  const createMeeting = await fetch(`${baseUrl}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ title: 'Conflito de teste', date: dateStr, time: '19:00', participantEmails: [ESPORTES_EMAIL] }),
  });
  const meeting = await createMeeting.json();
  createdMeetingIds.push(meeting.id);

  const res = await fetch(`${baseUrl}/api/meetings/suggest-times`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ participantEmails: [ESPORTES_EMAIL], durationMinutes: 60, windowDays: 14 }),
  });
  const data = await res.json();
  assert.ok(!data.some(slot => slot.date === dateStr && slot.time === '19:00'));

  // POST /api/meetings/check-conflicts também detecta o mesmo conflito pontualmente
  // (usado na criação manual da reunião, fora do fluxo "Preparar reunião").
  const check = await fetch(`${baseUrl}/api/meetings/check-conflicts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ participantEmails: [ESPORTES_EMAIL], date: dateStr, time: '19:00', durationMinutes: 60 }),
  });
  assert.equal(check.status, 200);
  const checkData = await check.json();
  assert.ok(checkData.conflicts.some(c => c.email === ESPORTES_EMAIL));

  const checkFree = await fetch(`${baseUrl}/api/meetings/check-conflicts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ participantEmails: [ESPORTES_EMAIL], date: dateStr, time: '10:00', durationMinutes: 60 }),
  });
  const checkFreeData = await checkFree.json();
  assert.equal(checkFreeData.conflicts.length, 0);
});

test('finalizar ata cria tarefa a partir de decisão com responsável e notifica quem é', async () => {
  const responsibleUser = await prisma.user.findFirst({ where: { role: { not: 'ASSOCIADO' } } });
  assert.ok(responsibleUser, 'precisa de ao menos um usuário interno cadastrado para este teste');

  const create = await fetch(`${baseUrl}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ title: 'Reunião com decisão', date: new Date().toISOString().slice(0, 10) }),
  });
  const meeting = await create.json();
  createdMeetingIds.push(meeting.id);

  await fetch(`${baseUrl}/api/meetings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ id: meeting.id, decisions: [{ decision: 'Comprar novos uniformes', responsible: responsibleUser.name, dueDate: new Date(Date.now() + 7 * 86400000).toISOString() }] }),
  });

  const finalize = await fetch(`${baseUrl}/api/meetings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ id: meeting.id, action: 'finalize' }),
  });
  assert.equal(finalize.status, 200);

  const task = await prisma.task.findFirst({ where: { title: 'Comprar novos uniformes', owner: responsibleUser.name } });
  assert.ok(task, 'tarefa deveria ter sido criada a partir da decisão');
  assert.equal(task.team, 'Diretoria');
  await prisma.task.delete({ where: { id: task.id } }).catch(() => {});

  const notification = await prisma.notification.findFirst({ where: { userEmail: responsibleUser.email, entity: 'Task', kind: 'ACIONAVEL' }, orderBy: { createdAt: 'desc' } });
  assert.ok(notification, 'responsável deveria ter recebido notificação acionável da tarefa');
  await prisma.notification.delete({ where: { id: notification.id } }).catch(() => {});
});
