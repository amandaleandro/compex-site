# Registro de Alterações

> Ler este arquivo antes de iniciar qualquer tarefa. Registrar cada entrega ao final.

## Formato de cada entrada

```
## AAAA-MM-DD - Título curto
- O que foi feito:
- Arquivos alterados:
- Validações executadas:
- Pendências:
```

## 2026-08-17 - Correções P0 e gestão real de planos de sócio
- O que foi feito:
  - Corrigido bug que quebrava (500) o download de documento privado (`INTERNAL_ROLES` não importado).
  - `GET /api/events` público não retorna mais `revenue`/`expenses`/`financialNotes`.
  - `Plan` ganhou `priceCents`, `active`, `periodicity`, `durationMonths`, `benefits` (migration aditiva, sem apagar dados).
  - `Member` ganhou `planId` opcional (relação com `Plan`), campo `plan` (string) preservado.
  - `/api/plans`: escrita restrita a PRESIDENCIA/FINANCEIRO; leitura pública só retorna planos ativos; exclusão vira desativação se houver sócio vinculado.
  - `/api/checkout/mensalidade` passou a buscar preço/plano no banco (nunca confia em valor enviado pelo frontend).
  - Nova tela `/gestao/planos` (Presidência/Financeiro) para cadastrar, editar e ativar/desativar planos.
  - `/cadastro` e `/beneficios` passaram a consumir `/api/plans` em vez de valores hardcoded (eliminada divergência de preço entre telas e cobrança real).
  - Sidebar de `/gestao` agora filtra itens do menu pela role logada (evita clique em link que só redireciona).
- Arquivos alterados: `backend/routes/static.js`, `backend/routes/collections.js`, `backend/associate.js`, `backend/lib/sessions.js`, `backend/prisma/schema.prisma` + migration nova, `frontend/public-next/src/app/cadastro/page.tsx`, `frontend/public-next/src/app/beneficios/page.tsx`, `frontend/public-next/src/app/gestao/planos/page.tsx` (novo), `frontend/public-next/src/components/gestao/GestaoShell.tsx`.
- Validações executadas: `npm test` (backend, 25/25 ok), `npm run lint` (frontend, sem novos erros além do padrão pré-existente de `setState` em `useEffect` já usado no restante do projeto), `npm run build` (frontend, sucesso).
- Pendências: `Member.plan` (string) ainda coexiste com `Member.planId`; migração completa para relação obrigatória fica para rodada futura. Teste funcional tela-por-tela ainda não foi feito (próxima rodada, conforme combinado).

## 2026-08-17 - Reconciliação de migrations + fluxo de compras/cotação + alertas da Presidência
- O que foi feito:
  - **Bug bloqueador**: banco (`compex-postgres`, porta 15432) estava parado e o histórico de migrations do Prisma estava dessincronizado (banco criado via `db push` em algum momento, sem registro de `migrate`). Isso quebrava 2 testes (`Document.linkedEntity` ausente) e impedia `migrate deploy`. Reconciliado com `prisma migrate resolve --applied` migration a migration até a base ficar sincronizada com `schema.prisma`; nenhuma alteração de dado.
  - **Fluxo de compras (§7 do pedido)**: `Request` ganhou `items`, `quotations` (cotações de fornecedores), `invoiceUrl` (nota fiscal), `purchaseResponsibleName`, `receivedByName`/`receivedAt` (recebimento). Nova ação `add_quote` (registra cotação sem mudar status, permitida ao solicitante ou a quem aprova). Ação `finalize` para tipos de compra (`COMPRA_MATERIAIS`, `MATERIAL_ESPORTIVO`, `FERRAMENTA_SOFTWARE`, `CONTRATACAO_FORNECEDOR`) agora registra quem recebeu e quando, e pode ser feita pelo próprio solicitante (fecha o ciclo "recebimento" sem depender só do financeiro). UI em `/gestao/solicitacoes` ganhou botão "Registrar cotação" e exibição de cotações/recebimento.
  - **Central da Presidência (§17)**: nova seção "Alertas" — material do patrimônio não devolvido no prazo (`AssetLoan`), pagamentos marcados como pagos sem comprovante (`Transaction`), solicitações com vencimento passado sem finalizar, atletas sem confirmação de presença em jogos publicados nos próximos 7 dias (`SessionAttendance`). Tudo calculado a partir de models existentes, sem duplicar dado.
  - Confirmado por auditoria que indicadores de departamento (§14) já estavam 100% implementados (backend `/api/department-indicators` + frontend `/gestao/departamentos`) — nenhuma ação necessária.
- Arquivos alterados: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260817170000_add_purchase_flow_to_request/` (novo), `backend/routes/requests.js`, `backend/routes/presidencia.js`, `frontend/public-next/src/app/gestao/solicitacoes/page.tsx`, `frontend/public-next/src/app/gestao/presidencia/page.tsx`.
- Validações executadas: `npx prisma migrate status` (up to date), `npm test` no backend (25/25), `npx tsc --noEmit` e `npm run build` no frontend (sem erros).
- Pendências: nada versionado nesta sessão nem em sessões anteriores recentes — há um volume grande de arquivos novos (rotas, migrations, telas de `/gestao/*`) sem commit; recomendo revisar e commitar em lotes lógicos antes de seguir. Lint do frontend mantém avisos pré-existentes (`setState` em `useEffect`) não relacionados a esta mudança.
