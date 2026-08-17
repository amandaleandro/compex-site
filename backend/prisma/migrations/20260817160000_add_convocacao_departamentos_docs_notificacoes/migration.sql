-- Fecha as pendências da Fase 5: convocação com publicação (TeamSession.published),
-- vínculo de documentos com o registro de origem, planejamento/indicadores por
-- departamento e notificações internas. Aditiva.

ALTER TABLE "TeamSession" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Document" ADD COLUMN "linkedEntity" TEXT;
ALTER TABLE "Document" ADD COLUMN "linkedId" TEXT;

CREATE TYPE "DepartmentPlanStatus" AS ENUM ('PLANEJADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO');

CREATE TABLE "DepartmentPlan" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "actions" JSONB,
    "responsible" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "DepartmentPlanStatus" NOT NULL DEFAULT 'PLANEJADO',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userEmail_read_idx" ON "Notification"("userEmail", "read");
