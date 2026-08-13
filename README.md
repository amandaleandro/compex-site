# COMPEX Portal

Portal da Atlética Computação e Exatas.

## Estrutura

- `frontend/`: páginas, estilos e scripts do navegador
- `backend/`: servidor HTTP, API, Prisma, seed e dados locais
- `prisma/`: schema e migrações do banco ficam dentro de `backend/`

## Iniciar pela primeira vez

No PowerShell, dentro desta pasta:

```powershell
npm install
docker compose up -d postgres
npm run db:migrate -- --name init
npm run db:seed
npm start
```

Abra no navegador:

```text
http://localhost:3100
```

## Acessos

- Site público: `http://localhost:3100`
- Portal da diretoria: `http://localhost:3100/portal.html`
- Login: `http://localhost:3100/login.html`
- API: `http://localhost:3100/api/health`

Conta de demonstração:

```text
E-mail: diretoria@compex.com.br
Senha: compex2026
```

## Banco

O PostgreSQL local roda no container `compex-postgres` e usa a porta `55432` no computador. O Prisma usa `prisma.config.ts` e o schema em `prisma/schema.prisma`.

## Se algo não abrir

Confirme que o servidor está rodando com:

```powershell
npm start
```

Não abra os arquivos HTML com duplo clique. Use sempre o endereço `http://localhost:3100`, pois a API só funciona pelo servidor.
