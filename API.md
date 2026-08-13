# API local da COMPEX

Inicie o portal com:

```bash
npm start
```

Depois abra `http://localhost:3100`.

No Windows, você também pode iniciar pelo arquivo `start-compex.ps1`.

Para testar o acesso, abra `http://localhost:3100/public/login.html` e use a conta de demonstração informada na tela.

Endpoints disponíveis:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me` com `Authorization: Bearer <token>`
- `GET /api/stats`
- `GET /api/events` e `POST /api/events`
- `GET /api/members` e `POST /api/members`
- `GET /api/news` e `POST /api/news`
- `GET /api/athletes` e `POST /api/athletes`
- `GET /api/documents` e `POST /api/documents`
- `GET /api/transactions` e `POST /api/transactions`

Todos os recursos também aceitam `PUT /api/{recurso}` para edição e `DELETE /api/{recurso}` com um corpo JSON no formato `{ "id": "..." }`.

Os dados são persistidos em `data.json`. Esta é uma base local para a próxima etapa: autenticação, banco PostgreSQL e armazenamento de arquivos.

No navegador, o arquivo `/shared/api-client.js` expõe `window.CompexAPI` com os métodos `health()`, `list(resource)` e `create(resource, data)`.

Quando as páginas são abertas pelo servidor (`http://localhost:3100`), `/shared/api-bridge.js` sincroniza os dados das telas com a API e o PostgreSQL.
