require('dotenv/config');
const { PrismaClient } = require('./generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const emails = ['financeiro@compex.com.br', 'esportes@compex.com.br', 'eventos@compex.com.br', 'marketing@compex.com.br'];

async function main() {
  console.log('\nSenhas rotacionadas — guarde e distribua com segurança (não aparecem de novo):');
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    const password = crypto.randomBytes(9).toString('base64url');
    await prisma.user.update({ where: { email }, data: { password: await bcrypt.hash(password, 10) } });
    console.log(`  ${email} · ${password}`);
  }
  console.log('');
}

main().catch(error => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
