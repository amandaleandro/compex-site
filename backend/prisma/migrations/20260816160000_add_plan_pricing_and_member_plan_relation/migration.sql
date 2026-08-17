-- Adiciona priceCents (fonte de verdade monetária) e metadados de gestão ao Plan,
-- e relação opcional Member.planId -> Plan.id. Aditiva; nenhuma coluna existente é removida.
ALTER TABLE "Plan" ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "periodicity" TEXT NOT NULL DEFAULT 'ANUAL';
ALTER TABLE "Plan" ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Plan" ADD COLUMN "benefits" JSONB;
ALTER TABLE "Plan" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Member" ADD COLUMN "planId" TEXT;
ALTER TABLE "Member" ADD CONSTRAINT "Member_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
