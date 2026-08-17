'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { sweepTaskReminders } = require('../lib/reminders');

const createdTaskIds = [];
const createdUserIds = [];

after(async () => {
  for (const id of createdTaskIds) await prisma.task.delete({ where: { id } }).catch(() => {});
  for (const id of createdUserIds) {
    await prisma.notification.deleteMany({ where: { entity: 'Task' } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
});

test('sweepTaskReminders notifica dono de tarefa atrasada e não repete o mesmo estágio', async () => {
  const owner = await prisma.user.create({ data: { name: `Dono Tarefa Teste ${Date.now()}`, email: `dono-tarefa-${Date.now()}@compex.com.br`, password: 'x', role: 'MARKETING', phone: '5534944443333' } });
  createdUserIds.push(owner.id);

  const task = await prisma.task.create({
    data: { title: 'Tarefa atrasada de teste', team: 'Marketing', owner: owner.name, status: 'todo', dueDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
  });
  createdTaskIds.push(task.id);

  await sweepTaskReminders();

  const overdueNotification = await prisma.notification.findFirst({ where: { entity: 'Task', entityId: task.id, remindStage: 'OVERDUE' } });
  assert.ok(overdueNotification, 'deveria ter criado notificação OVERDUE');
  assert.equal(overdueNotification.kind, 'ACIONAVEL');

  const escalated = await prisma.notification.findMany({ where: { entity: 'Task', entityId: task.id, remindStage: 'ESCALATED' } });
  assert.ok(escalated.length > 0, 'atraso de 4 dias (>= 3 configurado) deveria ter escalado para a Presidência');

  const whatsapp = await prisma.whatsAppMessage.findFirst({ where: { toPhone: owner.phone, templateKey: 'atividade_atrasada' } });
  assert.ok(whatsapp, 'deveria ter enfileirado WhatsApp de atividade atrasada');
  await prisma.whatsAppMessage.delete({ where: { id: whatsapp.id } }).catch(() => {});

  const countBefore = await prisma.notification.count({ where: { entity: 'Task', entityId: task.id, remindStage: 'OVERDUE' } });
  await sweepTaskReminders();
  const countAfter = await prisma.notification.count({ where: { entity: 'Task', entityId: task.id, remindStage: 'OVERDUE' } });
  assert.equal(countAfter, countBefore, 'não deveria duplicar o lembrete OVERDUE numa segunda varredura');
});

test('sweepTaskReminders ignora tarefa sem dono cadastrado como User (não quebra)', async () => {
  const task = await prisma.task.create({
    data: { title: 'Tarefa sem dono cadastrado', team: 'Marketing', owner: 'Pessoa Sem Conta De Sistema', status: 'todo', dueDate: new Date(Date.now() - 86400000) },
  });
  createdTaskIds.push(task.id);
  await assert.doesNotReject(sweepTaskReminders());
});
