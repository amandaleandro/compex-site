# Banco de dados

O projeto agora possui o schema inicial do PostgreSQL em `prisma/schema.prisma`.

Fluxo de configuração:

```bash
npm install prisma @prisma/client
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

Antes, copie `.env.example` para `.env` e ajuste `DATABASE_URL`.

Para subir um PostgreSQL local com Docker Desktop:

```bash
docker compose up -d postgres
```

O `data.json` continua sendo usado pela API local atual. A próxima migração deve substituir as funções de leitura e escrita do `server.js` pelo Prisma.

O Prisma 7 usa `prisma.config.ts` para a URL do banco e gera o cliente em `generated/prisma`.

O seed cria a conta de demonstração da presidência e dados iniciais do portal.
