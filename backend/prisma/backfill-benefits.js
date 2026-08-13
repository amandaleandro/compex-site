// One-off script: migrates the 4 hand-written benefit records (and the 2 default
// plans) that used to live in backend/data.json into the new Prisma-backed
// Benefit/Plan tables. Safe to re-run: it upserts by name so it won't duplicate rows.
require('dotenv/config');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');

async function main() {
  if (!prisma) throw new Error('Prisma indisponível — verifique DATABASE_URL.');

  const dataFile = path.join(__dirname, '..', 'data.json');
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const benefits = Array.isArray(raw.benefits) ? raw.benefits : [];
  const plans = Array.isArray(raw.plans) ? raw.plans : [];

  let benefitCount = 0;
  for (const b of benefits) {
    const existing = await prisma.benefit.findFirst({ where: { name: b.name } });
    if (existing) continue;
    await prisma.benefit.create({
      data: {
        name: b.name,
        category: b.category,
        discount: b.discount,
        description: b.description || null,
        icon: b.icon || null,
      },
    });
    benefitCount++;
  }

  let planCount = 0;
  for (const p of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: p.name } });
    if (existing) continue;
    await prisma.plan.create({
      data: {
        name: p.name,
        price: p.price,
        period: p.period || '/ano',
        slots: p.slots !== undefined ? Number(p.slots) : 1,
        icon: p.icon || null,
        description: p.description || null,
      },
    });
    planCount++;
  }

  console.log(`Benefícios inseridos: ${benefitCount}/${benefits.length}`);
  console.log(`Planos inseridos: ${planCount}/${plans.length}`);
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Erro no backfill:', error);
  process.exit(1);
});
