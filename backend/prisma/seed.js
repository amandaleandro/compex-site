require('dotenv/config');
const { PrismaClient, Role, Status, TransactionType } = require('../generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://compex:senha@localhost:55432/compex?schema=public' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'diretoria@compex.com.br' },
    update: {},
    create: { name: 'Amanda Silva', email: 'diretoria@compex.com.br', password: 'compex2026', role: Role.PRESIDENCIA }
  });

  await prisma.member.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, course: 'Computação', plan: 'Anual', status: Status.ACTIVE, registration: '20231234' }
  });

  const associado = await prisma.user.upsert({
    where: { email: 'associado@compex.com.br' },
    update: { name: 'Lucas Associado', password: 'compex2026', role: Role.ASSOCIADO },
    create: { name: 'Lucas Associado', email: 'associado@compex.com.br', password: 'compex2026', role: Role.ASSOCIADO }
  });
  await prisma.member.upsert({
    where: { userId: associado.id },
    update: { course: 'Computação', plan: 'Anual', status: Status.ACTIVE, registration: '20264567' },
    create: { userId: associado.id, course: 'Computação', plan: 'Anual', status: Status.ACTIVE, registration: '20264567' }
  });

  // Contas de diretoria por área — cada uma recebe senha própria gerada na hora (nunca
  // compartilhada) só quando a conta ainda não existe. O login da diretoria/associado
  // continua aceitando as duas contas fixas legadas em server.js.
  const directors = [
    { name: 'Financeiro COMPEX', email: 'financeiro@compex.com.br', role: Role.FINANCEIRO },
    { name: 'Esportes COMPEX', email: 'esportes@compex.com.br', role: Role.ESPORTES },
    { name: 'Eventos COMPEX', email: 'eventos@compex.com.br', role: Role.EVENTOS },
    { name: 'Marketing COMPEX', email: 'marketing@compex.com.br', role: Role.MARKETING }
  ];
  const createdCredentials = [];
  for (const director of directors) {
    const existing = await prisma.user.findUnique({ where: { email: director.email } });
    if (existing) continue;
    const password = crypto.randomBytes(9).toString('base64url');
    await prisma.user.create({ data: { name: director.name, email: director.email, password: await bcrypt.hash(password, 10), role: director.role } });
    createdCredentials.push({ email: director.email, password });
  }
  if (createdCredentials.length) {
    console.log('\nContas de diretoria criadas — guarde essas senhas, elas não aparecem de novo:');
    createdCredentials.forEach(c => console.log(`  ${c.email} · ${c.password}`));
    console.log('');
  }

  if (!await prisma.event.findFirst({ where: { name: 'Intercomp 2026' } })) await prisma.event.create({ data: { name: 'Intercomp 2026', type: 'Campeonato', date: new Date('2026-09-20T08:00:00-03:00'), location: 'Uberlândia, MG', description: 'O maior encontro esportivo da Computação e Exatas.', boraFestUrl: 'https://borafest.com.br', published: true } });
  if (!await prisma.transaction.findFirst({ where: { description: 'Patrocínio Empresa A' } })) await prisma.transaction.create({ data: { description: 'Patrocínio Empresa A', amount: 2000, type: TransactionType.INCOME, category: 'Patrocínio' } });
  if (!await prisma.transaction.findFirst({ where: { description: 'Material esportivo' } })) await prisma.transaction.create({ data: { description: 'Material esportivo', amount: 620, type: TransactionType.EXPENSE, category: 'Esportes' } });
  if (!await prisma.news.findFirst({ where: { title: 'COMPEX confirma presença no Intercomp 2026' } })) await prisma.news.create({ data: { title: 'COMPEX confirma presença no Intercomp 2026', category: 'Eventos', content: 'Nossa equipe já está se preparando para viver mais uma grande edição do campeonato.', published: true } });
  if (!await prisma.athlete.findFirst({ where: { name: 'Amanda Silva' } })) await prisma.athlete.create({ data: { name: 'Amanda Silva', course: 'Computação', sport: 'Futsal', position: 'Ala', attendance: 12 } });
  if (!await prisma.document.findFirst({ where: { name: 'Estatuto da Atlética COMPEX' } })) await prisma.document.create({ data: { name: 'Estatuto da Atlética COMPEX', category: 'Estatuto e atas', url: '', isPublic: true } });

  const teams = [
    { name: 'Futsal', sport: 'Futsal', description: 'Time principal, treinos duas vezes por semana.', trainingDay: 'Terças e quintas · 19h30' },
    { name: 'Vôlei', sport: 'Vôlei', description: 'Time misto, todos os níveis são bem-vindos.', trainingDay: 'Quartas · 18h' },
    { name: 'Peteca', sport: 'Peteca', description: 'Modalidade mais tradicional da atlética.', trainingDay: 'Sextas · 17h' },
    { name: 'E-sports', sport: 'E-sports', description: 'Competições online, inscrições abertas.', trainingDay: 'Combinado no grupo' }
  ];
  for (const team of teams) if (!await prisma.team.findFirst({ where: { name: team.name } })) await prisma.team.create({ data: team });

  const products = [
    { name: 'Camisa oficial 2026', description: 'Camisa de jogo, tecido dry-fit.', priceCents: 8900, category: 'Vestuário', imageUrl: '' },
    { name: 'Ingresso Calourada COMPEX', description: 'Lote 2 — festa de recepção dos calouros.', priceCents: 4000, category: 'Eventos', imageUrl: '' },
    { name: 'Boné COMPEX', description: 'Boné bordado, edição limitada.', priceCents: 5500, category: 'Vestuário', imageUrl: '' }
  ];
  for (const product of products) if (!await prisma.product.findFirst({ where: { name: product.name } })) await prisma.product.create({ data: product });
}

main().catch(error => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
