'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');
const { buildMessage } = require('../lib/whatsapp-templates');
const { enqueueWhatsApp, isQuietHoursNow } = require('../lib/whatsapp-queue');
const { notify } = require('../lib/notify');

let server, baseUrl;
const createdMessageIds = [];
const ESPORTES_TOKEN = 'test-token-esportes-whatsapp';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste-whatsapp@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(ESPORTES_TOKEN);
  for (const id of createdMessageIds) await prisma.whatsAppMessage.delete({ where: { id } }).catch(() => {});
  await stopServer(server);
});

test('buildMessage renderiza template conhecido com variáveis', () => {
  const text = buildMessage('nova_escala', { referencia: 'CompExatas x Rival', funcao: 'SUMULA', data: '20/08/2026', local: 'Ginásio' });
  assert.match(text, /CompExatas x Rival/);
  assert.match(text, /SUMULA/);
});

test('buildMessage com template desconhecido lança erro', () => {
  assert.throws(() => buildMessage('template_inexistente', {}));
});

test('enqueueWhatsApp sem Evolution configurada cria mensagem já como FALHOU (sem ficar tentando pra sempre)', async () => {
  // Ambiente de teste não define EVOLUTION_API_URL/KEY/INSTANCE.
  const created = await enqueueWhatsApp({ phone: '5534999990000', templateKey: 'nova_escala', variables: { referencia: 'x', funcao: 'y', data: 'z', local: '' } });
  assert.ok(created);
  createdMessageIds.push(created.id);
  assert.equal(created.status, 'FALHOU');
  assert.match(created.error, /não configurada/i);
});

test('notify() com whatsapp enfileira mensagem quando o usuário tem telefone cadastrado', async () => {
  const user = await prisma.user.create({
    data: { name: 'Teste Telefone WhatsApp', email: `telefone-teste-${Date.now()}@compex.com.br`, password: 'x', role: 'MARKETING', phone: '5534988887777' },
  });
  try {
    await notify({
      email: user.email, title: 'Teste', message: 'Mensagem de teste', kind: 'INFORMATIVA',
      whatsapp: { templateKey: 'nova_escala', variables: { referencia: 'Jogo teste', funcao: 'APOIO_JOGO', data: '01/01/2027', local: '' } },
    });
    const message = await prisma.whatsAppMessage.findFirst({ where: { toPhone: user.phone }, orderBy: { createdAt: 'desc' } });
    assert.ok(message, 'deveria ter enfileirado uma mensagem de WhatsApp');
    createdMessageIds.push(message.id);
    const notification = await prisma.notification.findFirst({ where: { userEmail: user.email }, orderBy: { createdAt: 'desc' } });
    if (notification) await prisma.notification.delete({ where: { id: notification.id } }).catch(() => {});
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});

test('notify() informativa não enfileira WhatsApp quando associado desativou (Member.preferences.whatsapp=false)', async () => {
  const user = await prisma.user.create({ data: { name: 'Associado Opt Out', email: `optout-${Date.now()}@compex.com.br`, password: 'x', role: 'ASSOCIADO' } });
  const member = await prisma.member.create({ data: { userId: user.id, course: 'ECOMP', plan: 'Mensal', status: 'ACTIVE', phone: '5534966665555', preferences: { whatsapp: false } } });
  try {
    await notify({ email: user.email, title: 'Notícia', message: 'x', kind: 'INFORMATIVA', whatsapp: { templateKey: 'resultado_enquete', variables: { pergunta: 'x', vencedora: 'y' } } });
    const message = await prisma.whatsAppMessage.findFirst({ where: { toPhone: member.phone } });
    assert.equal(message, null, 'não deveria ter enfileirado — usuário desativou WhatsApp informativo');
  } finally {
    await prisma.notification.deleteMany({ where: { userEmail: user.email } });
    await prisma.member.delete({ where: { id: member.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});

test('notify() acionável ignora a preferência de opt-out (operacional sempre chega)', async () => {
  const user = await prisma.user.create({ data: { name: 'Associado Opt Out Acionavel', email: `optout-acionavel-${Date.now()}@compex.com.br`, password: 'x', role: 'ASSOCIADO' } });
  const member = await prisma.member.create({ data: { userId: user.id, course: 'ECOMP', plan: 'Mensal', status: 'ACTIVE', phone: '5534955554444', preferences: { whatsapp: false } } });
  try {
    await notify({ email: user.email, title: 'Convocação', message: 'x', kind: 'ACIONAVEL', whatsapp: { templateKey: 'convocacao', variables: { evento: 'x', data: 'x', horario: 'x' } } });
    const message = await prisma.whatsAppMessage.findFirst({ where: { toPhone: member.phone } });
    assert.ok(message, 'acionável deveria ter sido enfileirado mesmo com opt-out de informativas');
    createdMessageIds.push(message.id);
  } finally {
    await prisma.notification.deleteMany({ where: { userEmail: user.email } });
    await prisma.member.delete({ where: { id: member.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});

test('GET /api/whatsapp/status é restrito à Presidência', async () => {
  const res = await fetch(`${baseUrl}/api/whatsapp/status`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  assert.equal(res.status, 403);
});

test('GET /api/whatsapp/status com Presidência retorna configured:false neste ambiente de teste', async () => {
  const res = await fetch(`${baseUrl}/api/whatsapp/status`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.configured, false);
});

test('GET /api/whatsapp/messages é restrito à Presidência', async () => {
  const res = await fetch(`${baseUrl}/api/whatsapp/messages`, { headers: { Authorization: `Bearer ${ESPORTES_TOKEN}` } });
  assert.equal(res.status, 403);
});

test('isQuietHoursNow respeita a janela padrão (21h-8h) sem bloquear o horário comercial', () => {
  assert.equal(isQuietHoursNow(22), true);
  assert.equal(isQuietHoursNow(3), true);
  assert.equal(isQuietHoursNow(7), true);
  assert.equal(isQuietHoursNow(8), false);
  assert.equal(isQuietHoursNow(14), false);
  assert.equal(isQuietHoursNow(20), false);
  assert.equal(isQuietHoursNow(21), true);
});

test('convocação de treino/jogo notifica os inscritos com template whatsapp de convocação', async () => {
  const { createAttendanceCalls } = require('../lib/finance');
  const user = await prisma.user.create({ data: { name: 'Atleta Teste Convocação', email: `atleta-convocacao-${Date.now()}@compex.com.br`, password: 'x', role: 'ASSOCIADO', phone: '5534977776666' } });
  const member = await prisma.member.create({ data: { userId: user.id, course: 'ECOMP', plan: 'Mensal', status: 'ACTIVE' } });
  const team = await prisma.team.create({ data: { name: 'Time Teste Convocação', sport: 'Futsal', gender: 'MISTA' } });
  const session = await prisma.teamSession.create({ data: { teamId: team.id, type: 'TREINO', date: new Date() }, include: { team: true } });
  try {
    await createAttendanceCalls(session, [{ memberId: member.id, member: { user } }]);
    const attendance = await prisma.sessionAttendance.findFirst({ where: { sessionId: session.id, memberId: member.id } });
    assert.ok(attendance, 'deveria ter criado a convocação (SessionAttendance)');
    const whatsapp = await prisma.whatsAppMessage.findFirst({ where: { toPhone: user.phone, templateKey: 'convocacao' } });
    assert.ok(whatsapp, 'deveria ter enfileirado WhatsApp de convocação');
    createdMessageIds.push(whatsapp.id);
    const notification = await prisma.notification.findFirst({ where: { userEmail: user.email, entity: 'SessionAttendance' } });
    assert.ok(notification);
    await prisma.notification.delete({ where: { id: notification.id } }).catch(() => {});
  } finally {
    await prisma.sessionAttendance.deleteMany({ where: { sessionId: session.id } });
    await prisma.teamSession.delete({ where: { id: session.id } }).catch(() => {});
    await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
    await prisma.member.delete({ where: { id: member.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
});

test('POST /api/webhooks/evolution sem token configurado aceita e atualiza status', async () => {
  const res = await fetch(`${baseUrl}/api/webhooks/evolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'connection.update', data: { state: 'open' } }),
  });
  assert.equal(res.status, 200);
  const status = await fetch(`${baseUrl}/api/whatsapp/status`, { headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` } });
  const statusData = await status.json();
  assert.equal(statusData.connected, true);
});
