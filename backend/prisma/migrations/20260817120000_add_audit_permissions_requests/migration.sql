-- Fase 1 do sistema operacional: permissões extras por usuário, trilha de auditoria e
-- Central de Solicitações genérica. Aditiva; nenhuma coluna/tabela existente é alterada.

ALTER TABLE "User" ADD COLUMN "permissions" JSONB;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TYPE "RequestType" AS ENUM ('PAGAMENTO_TECNICO', 'PAGAMENTO_ARBITRAGEM', 'COMPRA_MATERIAIS', 'FERRAMENTA_SOFTWARE', 'CONTRATACAO_FORNECEDOR', 'TRANSPORTE', 'ALIMENTACAO', 'INSCRICAO_CAMPEONATO', 'REEMBOLSO', 'EVENTO', 'MATERIAL_ESPORTIVO', 'DESPESA_ADMINISTRATIVA', 'OUTRAS_DESPESAS');
CREATE TYPE "RequestPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
CREATE TYPE "RequestStatus" AS ENUM ('RASCUNHO', 'SOLICITADO', 'APROVACAO_DIRETOR', 'FINANCEIRO', 'PRESIDENCIA', 'APROVADO', 'PAGO', 'FINALIZADO', 'REJEITADO');

CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT,
    "valuePlanned" DECIMAL(12,2),
    "valueFinal" DECIMAL(12,2),
    "favorecido" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIA',
    "attachments" JSONB,
    "observations" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'RASCUNHO',
    "proofUrl" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);
