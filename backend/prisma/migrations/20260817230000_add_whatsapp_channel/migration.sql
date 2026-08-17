-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'ENTREGUE', 'FALHOU', 'CANCELADO');

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "variables" JSONB,
    "content" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'PENDENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "externalId" TEXT,
    "linkedEntity" TEXT,
    "linkedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_externalId_idx" ON "WhatsAppMessage"("externalId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_linkedEntity_linkedId_idx" ON "WhatsAppMessage"("linkedEntity", "linkedId");

-- CreateTable
CREATE TABLE "WhatsAppInstanceStatus" (
    "id" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastEventType" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInstanceStatus_pkey" PRIMARY KEY ("id")
);
