-- Fluxo de compras dentro da Central de Solicitações (cotação de fornecedores, nota fiscal
-- e confirmação de recebimento), sem criar um módulo separado. Aditiva.

ALTER TABLE "Request" ADD COLUMN "items" JSONB;
ALTER TABLE "Request" ADD COLUMN "quotations" JSONB;
ALTER TABLE "Request" ADD COLUMN "invoiceUrl" TEXT;
ALTER TABLE "Request" ADD COLUMN "purchaseResponsibleName" TEXT;
ALTER TABLE "Request" ADD COLUMN "receivedByName" TEXT;
ALTER TABLE "Request" ADD COLUMN "receivedAt" TIMESTAMP(3);
