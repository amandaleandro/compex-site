import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js'
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://compex:senha@localhost:55432/compex?schema=public'
  }
});
