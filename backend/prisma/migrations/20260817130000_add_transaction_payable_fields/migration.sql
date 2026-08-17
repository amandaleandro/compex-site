-- Fase 2 (Financeiro): transforma Transaction em base de contas a pagar/receber —
-- status (aberto/pago), vencimento, forma de pagamento, comprovante e vínculo com
-- a solicitação de origem. Aditiva; lançamentos existentes assumem status PAID (comportamento anterior).

CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "Transaction" ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'PAID';
ALTER TABLE "Transaction" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "favorecido" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "responsibleName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "requestId" TEXT;
