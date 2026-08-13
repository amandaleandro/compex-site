require('dotenv/config');

let prisma = null;
try {
  const { PrismaClient } = require('./generated/prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
} catch (error) {
  console.warn('Prisma indisponível; usando data.json como fallback.', error.message);
}

module.exports = { prisma };
